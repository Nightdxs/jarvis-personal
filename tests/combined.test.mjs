import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createEngine } from '../core.mjs';
import { selectMemory, recentHistory } from '../memory.mjs';
import { RealtimeVoice } from '../public/realtime.js';

const testRoot = path.resolve(process.env.JARVIS_TEST_ROOT || path.join(os.tmpdir(), 'jarvis-personal-tests'));
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
async function fixture(t, request = fetch) {
  await fs.mkdir(testRoot, { recursive: true }); const root = await fs.mkdtemp(path.join(testRoot, 'combined-'));
  const engine = createEngine({ root, request, environment: { JARVIS_PROVIDER: 'openai', JARVIS_ALLOW_PAID_API: '1' } }); await engine.init();
  t.after(async () => { await engine.stopVoice(); assert.ok(path.resolve(root).startsWith(testRoot + path.sep)); await fs.rm(root, { recursive: true, force: true }); });
  return { root, engine };
}
function realtimeMock(network) {
  return async (url, options) => {
    network.push({ url, options });
    if (url.endsWith('/realtime/calls')) return new Response('v=0\r\ns=mock-answer\r\n', { status: 201, headers: { Location: '/v1/realtime/calls/rtc_test123' } });
    if (url.endsWith('/hangup')) return new Response(null, { status: 200 });
    throw new Error('Unexpected network request in test.');
  };
}

test('Selective memory includes a relevant note and excludes unrelated bulk', async t => {
  const { engine } = await fixture(t);
  await engine.runTool('write_note', { file: 'proyectos/cafeteria.md', content: '# Cafetería Aurora\nLa cafetería vende café de especialidad y abre a las 8.' });
  await engine.runTool('write_note', { file: 'guitarra.md', content: '# Guitarra\n' + 'Practicar escalas y acordes. '.repeat(2500) });
  const context = await selectMemory(engine.vault, 'Qué recuerdos tienes de mi cafetería Aurora', 2500);
  assert.ok(context.files.includes('proyectos/cafeteria.md')); assert.ok(!context.files.includes('guitarra.md')); assert.ok(!context.files.includes('ESTILO.md'));
  assert.ok(context.characters <= 2500); assert.match(context.text, /especialidad/);
  const design = await selectMemory(engine.vault, 'Diseña una landing web para Aurora', 6000); assert.ok(design.files.includes('ESTILO.md'));
  const result = await engine.runTool('search_notes', { query: 'CAFETERIA' }); assert.equal(result.results[0].file, 'proyectos/cafeteria.md');
});
test('Long notes and conversation history remain bounded and readable in chunks', async t => {
  const { engine } = await fixture(t);
  await engine.runTool('write_note', { file: 'larga.md', content: 'A'.repeat(15000) + 'Fin de la nota' });
  const first = await engine.runTool('read_note', { file: 'larga.md', offset: 0 }); assert.equal(first.content.length, 12000); assert.equal(first.nextOffset, 12000);
  const second = await engine.runTool('read_note', { file: 'larga.md', offset: first.nextOffset }); assert.match(second.content, /Fin de la nota/); assert.equal(second.nextOffset, null);
  const history = recentHistory(Array.from({ length: 20 }, (_, index) => ({ role: index % 2 ? 'assistant' : 'user', content: String(index) + 'x'.repeat(10000) })), 12000);
  assert.ok(history.reduce((sum, x) => sum + x.content.length, 0) <= 12000); assert.ok(history.at(-1).content.startsWith('19'));
});
test('Realtime negotiation keeps permanent key on backend and shares guarded tools', async t => {
  const network = []; const { engine } = await fixture(t, realtimeMock(network));
  await engine.configure({ openai: 'permanent-secret', realtimeModel: 'gpt-realtime', contextBudget: 3000 });
  const session = await engine.startVoice('v=0\r\ns=test-offer\r\n');
  assert.ok(!JSON.stringify(session).includes('permanent-secret')); assert.equal(network[0].options.headers.Authorization, 'Bearer permanent-secret');
  const config = JSON.parse(network[0].options.body.get('session'));
  assert.equal(config.model, 'gpt-realtime'); assert.equal(config.audio.input.turn_detection.interrupt_response, true);
  assert.ok(config.tools.some(x => x.name === 'search_notes')); assert.ok(config.tools.every(x => !Object.hasOwn(x, 'strict')));
  await assert.rejects(engine.chat('Hola'), /voz/); await assert.rejects(engine.configure({ voice: 'cedar' }), /voz/);
  await assert.rejects(engine.voiceTool('bad-session', 'call_test', 'list_notes', {}), /terminó/);
  await Promise.all([engine.voiceTranscript(session.sessionId, 'item_1', 'user', 'Mi objetivo es aprender.'), engine.voiceTranscript(session.sessionId, 'item_1', 'user', 'Mi objetivo es aprender.')]);
  await engine.voiceTranscript(session.sessionId, 'item_2', 'assistant', 'permanent-secret');
  const state = await engine.state(); assert.equal(state.history.length, 2); assert.match(state.history[1].content, /OCULTA/);
  await engine.stopVoice(session.sessionId); assert.equal((await engine.state()).voiceActive, false); assert.ok(network.at(-1).url.endsWith('/rtc_test123/hangup'));
});
test('Duplicate Realtime calls do not repeat writes or queue approvals twice', async t => {
  const network = []; const { engine } = await fixture(t, realtimeMock(network));
  await engine.configure({ openai: 'secret', ha: 'ha-secret', haUrl: 'http://homeassistant.local:8123', allowedEntities: ['light.salon'] });
  const session = await engine.startVoice('v=0\r\ns=test-offer\r\n');
  const args = { entity: 'light.salon', action: 'turn_on' };
  const [a, b] = await Promise.all([engine.voiceTool(session.sessionId, 'call_device', 'control_device', args), engine.voiceTool(session.sessionId, 'call_device', 'control_device', args)]);
  assert.equal(a.id, b.id); assert.equal((await engine.state()).pending.length, 1); assert.equal(network.length, 1);
  await assert.rejects(engine.voiceTool(session.sessionId, 'call_device', 'control_device', { ...args, action: 'turn_off' }), /argumentos/);
});
test('Failed Realtime authentication leaves no active session or exposed key', async t => {
  const { engine } = await fixture(t, async () => json({ error: { message: 'Invalid key permanent-secret' } }, 401));
  await engine.configure({ openai: 'permanent-secret' });
  await assert.rejects(engine.startVoice('v=0\r\ns=test\r\n'), e => e.message.includes('401') && !e.message.includes('permanent-secret'));
  assert.equal((await engine.state()).voiceActive, false);
});
test('Weather uses real service response data and never sends OpenAI credentials', async t => {
  const network = [];
  const { engine } = await fixture(t, async (url, options) => {
    network.push({ url, options });
    if (url.includes('geocoding-api')) return json({ results: [{ name: 'Madrid', admin1: 'Madrid', country: 'España', latitude: 40.4, longitude: -3.7 }] });
    return json({ timezone: 'Europe/Madrid', current: { time: '2026-10-13T12:00', temperature_2m: 18 }, current_units: { temperature_2m: '°C' }, daily: { time: ['2026-10-13'], temperature_2m_min: [12], temperature_2m_max: [23], precipitation_probability_max: [10] }, daily_units: {} });
  });
  await engine.configure({ openai: 'secret-not-for-weather' });
  const weather = await engine.runTool('get_weather', { city: 'Madrid', country: 'ES' });
  assert.equal(weather.current.temperature_2m, 18); assert.ok(network[0].url.includes('countryCode=ES')); assert.equal(network[0].options.headers, undefined);
  assert.match(weather.location, /España/); assert.equal(weather.source, 'https://open-meteo.com/');
});
function browserRuntime() {
  const track = { enabled: true, stopped: false, stop() { this.stopped = true; } };
  const media = { getTracks: () => [track] };
  class Peer {
    constructor() { this.connectionState = 'new'; this.channel = { readyState: 'connecting', sent: [], send(value) { this.sent.push(JSON.parse(value)); }, close() { this.readyState = 'closed'; this.onclose?.(); } }; }
    addTrack() {} createDataChannel() { return this.channel; }
    async createOffer() { return { type: 'offer', sdp: 'v=0\r\ns=mock\r\n' }; }
    async setLocalDescription(value) { this.localDescription = value; }
    async setRemoteDescription(value) { this.remoteDescription = value; this.channel.readyState = 'open'; this.channel.onopen?.(); }
    close() { this.connectionState = 'closed'; }
  }
  const audio = { autoplay: false, removed: false, async play() {}, pause() {}, remove() { this.removed = true; } };
  return { track, media, audio, runtime: { RTCPeerConnection: Peer, navigator: { mediaDevices: { getUserMedia: async () => media } }, document: { createElement: () => audio, body: { append() {} } } } };
}
test('Voice controller releases microphone and connection when negotiation fails', async () => {
  const { runtime, track, audio } = browserRuntime();
  const voice = new RealtimeVoice({ rpc: async () => { throw new Error('mock-network-failure'); } }, runtime);
  await assert.rejects(voice.start(), /mock-network-failure/); assert.equal(track.stopped, true); assert.equal(audio.removed, true); assert.equal(voice.phase, 'idle'); assert.equal(voice.pc, null);
});
test('Voice controller returns function outputs once and explicitly hangs up', async () => {
  const { runtime, track } = browserRuntime(); const calls = [], transcripts = [];
  const voice = new RealtimeVoice({ rpc: async (route, body) => { calls.push({ route, body }); if (route.endsWith('/start')) return { sdp: 'v=0\r\ns=answer\r\n', sessionId: 'session-test', maxDurationSeconds: 600 }; if (route.endsWith('/tool')) return { files: ['PERFIL.md'] }; return { saved: true, closed: true }; }, onTranscript: (role, text) => transcripts.push({ role, text }) }, runtime);
  await voice.start(); assert.equal(voice.phase, 'active'); assert.equal(track.enabled, true);
  const channel = voice.channel;
  const event = { type: 'response.done', response: { status: 'completed', output: [{ type: 'function_call', call_id: 'call_test', name: 'list_notes', arguments: '{}' }] } };
  await voice.handleEvent(event); await voice.handleEvent(event);
  assert.equal(calls.filter(x => x.route.endsWith('/tool')).length, 1); assert.ok(channel.sent.some(x => x.item?.type === 'function_call_output')); assert.ok(channel.sent.some(x => x.type === 'response.create'));
  await voice.handleEvent({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'item_1', transcript: 'Hola, JARVIS' }); assert.equal(transcripts[0].text, 'Hola, JARVIS');
  await voice.stop(); assert.equal(track.stopped, true); assert.equal(channel.readyState, 'closed'); assert.ok(calls.some(x => x.route.endsWith('/stop')));
});
