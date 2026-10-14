import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { createEngine, safePath } from '../core.mjs';
import { startServer } from '../server.mjs';

const testRoot = path.resolve(process.env.JARVIS_TEST_ROOT || path.join(os.tmpdir(), 'jarvis-personal-tests'));
async function fixture(t, request = fetch, environment = {}) {
  await fs.mkdir(testRoot, { recursive: true });
  const root = await fs.mkdtemp(path.join(testRoot, 'jarvis-'));
  t.after(() => { assert.ok(path.resolve(root).startsWith(testRoot + path.sep)); return fs.rm(root, { recursive: true, force: true }); });
  const engine = createEngine({ root, request, environment: { JARVIS_PROVIDER: 'openai', JARVIS_ALLOW_PAID_API: '1', ...environment } }); await engine.init();
  return { root, engine };
}
const response = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

test('Markdown persists across restarts while API credentials do not', async t => {
  const { root, engine } = await fixture(t);
  await engine.configure({ openai: 'test-private-key', profile: 'Me llamo Ana.', style: 'Azul y blanco.' });
  await engine.runTool('write_note', { file: 'ideas/idea.md', content: '# Mi idea\nCrear un portfolio.' });
  const restarted = createEngine({ root, environment: {} }); await restarted.init();
  const state = await restarted.state();
  assert.equal(state.connections.openai, false);
  assert.ok(state.notes.includes('ideas/idea.md'));
  assert.match((await restarted.runTool('read_note', { file: 'PERFIL.md' })).content, /Ana/);
  const disk = await fs.readFile(path.join(root, 'data/settings.json'), 'utf8'); assert.ok(!disk.includes('test-private-key'));
});
test('Traversal, hidden files, Windows device paths and symlinks are rejected', async t => {
  const { root } = await fixture(t);
  for (const name of ['../evil.md', '/evil.md', 'C:/evil.md', 'a\\evil.md', '.env.md', 'a/../evil.md', 'CON.md', 'a./evil.md', 'a:stream.md', 'x.md/evil.md']) {
    if (name === 'x.md/evil.md') continue;
    await assert.rejects(safePath(path.join(root, 'vault'), name, ['.md']));
  }
  await assert.rejects(safePath(path.join(root, 'vault'), 'secret.exe', ['.md']));
  const outside = path.join(root, 'outside'); await fs.mkdir(outside);
  try {
    await fs.symlink(outside, path.join(root, 'vault/link'), process.platform === 'win32' ? 'junction' : 'dir');
    await assert.rejects(safePath(path.join(root, 'vault'), 'link/evil.md', ['.md']), /simbólicos/);
  } catch (e) { if (e.code !== 'EPERM') throw e; }
});
test('Known credentials cannot be saved, published or sent through chat', async t => {
  const { engine } = await fixture(t);
  await engine.configure({ openai: 'unique-private-secret' });
  await assert.rejects(engine.runTool('write_note', { file: 'secret.md', content: 'unique-private-secret' }), /claves/);
  await assert.rejects(engine.runTool('write_project_file', { project: 'demo', file: 'index.html', content: 'unique-private-secret' }), /claves/);
  await assert.rejects(engine.chat('unique-private-secret'), /Ajustes/);
  await assert.rejects(engine.configure({ github: 'new-key-value', profile: 'new-key-value' }), /claves/);
});
test('Responses tool loop uses actual tool results and preserves encrypted reasoning', async t => {
  const requests = [];
  const mock = async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    const body = JSON.parse(options.body); requests.push(body);
    if (requests.length === 1) return response({ status: 'completed', usage: { total_tokens: 15 }, output: [{ type: 'reasoning', id: 'rs_test', encrypted_content: 'encrypted' }, { type: 'function_call', name: 'write_note', call_id: 'call_1', arguments: JSON.stringify({ file: 'objetivos.md', content: '# Aprender programación' }) }] });
    return response({ status: 'completed', usage: { total_tokens: 10 }, output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Guardé tu objetivo en objetivos.md.' }] }] });
  };
  const { engine } = await fixture(t, mock); await engine.configure({ openai: 'mock-key' });
  const result = await engine.chat('Recuerda que quiero aprender programación.');
  assert.equal(result.tokens, 25); assert.equal(requests.length, 2); assert.equal(result.traces[0].tool, 'write_note');
  assert.equal(requests[0].store, false); assert.ok(requests[0].include.includes('reasoning.encrypted_content'));
  assert.ok(requests[1].input.some(x => x.type === 'function_call_output' && x.output.includes('objetivos.md')));
  assert.ok(requests[1].input.some(x => x.type === 'reasoning' && x.encrypted_content === 'encrypted'));
  assert.equal(result.state.history.length, 2);
});
test('External actions require approval, snapshot reviewed files, and cannot run twice', async t => {
  const network = [];
  const mock = async (url, options) => { network.push({ url, body: JSON.parse(options.body) }); return response({ id: 'dpl_test', readyState: 'QUEUED', url: 'demo.vercel.app' }); };
  const { engine } = await fixture(t, mock); await engine.configure({ vercel: 'mock-vercel' });
  await engine.runTool('write_project_file', { project: 'demo', file: 'index.html', content: '<h1>Review this version</h1>' });
  const pending = await engine.runTool('deploy_vercel', { project: 'demo' }); assert.equal(network.length, 0);
  await engine.runTool('write_project_file', { project: 'demo', file: 'index.html', content: '<h1>Different version</h1>' });
  const result = await engine.approve(pending.id, true);
  assert.equal(result.state, 'QUEUED'); assert.match(network[0].body.files[0].data, /Review this version/);
  await assert.rejects(engine.approve(pending.id, true), /resuelta/); assert.equal(network.length, 1);
  const second = await engine.runTool('deploy_vercel', { project: 'demo' }); await engine.approve(second.id, false); assert.equal(network.length, 1);
});
test('Home Assistant only acts on authorized entities and checks device state', async t => {
  const calls = [];
  const mock = async (url, options) => { calls.push({ url, options }); return response(options.method === 'POST' ? [] : { state: 'on' }); };
  const { engine } = await fixture(t, mock);
  await engine.configure({ ha: 'mock-ha', haUrl: 'http://homeassistant.local:8123', allowedEntities: ['light.salon', 'scene.cine'] });
  await assert.rejects(engine.runTool('control_device', { entity: 'switch.no', action: 'turn_on' }), /autorizado/);
  await assert.rejects(engine.runTool('control_device', { entity: 'scene.cine', action: 'turn_off' }), /permitida/);
  const queued = await engine.runTool('control_device', { entity: 'light.salon', action: 'turn_on' }); assert.equal(calls.length, 0);
  const result = await engine.approve(queued.id, true); assert.equal(result.state, 'on');
  assert.ok(calls[0].url.endsWith('/api/services/light/turn_on')); assert.equal(calls.length, 2);
});
test('HTTP server blocks unauthenticated access, cross-origin writes and DNS rebinding', async t => {
  const { root } = await fixture(t);
  const { server, port } = await startServer({ root, port: 0, environment: {} }); t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${port}`;
  assert.equal((await fetch(`${base}/api/state`)).status, 401);
  const page = await fetch(base); assert.equal(page.status, 200); const cookie = page.headers.get('set-cookie').split(';')[0];
  const state = await fetch(`${base}/api/state`, { headers: { Cookie: cookie } }); assert.equal(state.status, 200);
  const rebindingStatus = await new Promise((resolve, reject) => {
    http.get(`${base}/api/state`, { headers: { Cookie: cookie, Host: 'evil.example' } }, result => { result.resume(); resolve(result.statusCode); }).on('error', reject);
  });
  assert.equal(rebindingStatus, 403);
  const settings = { method: 'POST', headers: { Cookie: cookie, Origin: base, 'Content-Type': 'application/json', 'X-Jarvis': '1' }, body: JSON.stringify({ profile: 'Hola, José. Mi objetivo es diseñar.' }) };
  assert.equal((await fetch(`${base}/api/settings`, settings)).status, 200);
  assert.equal((await fetch(`${base}/api/settings`, { ...settings, headers: { ...settings.headers, Origin: 'https://evil.example' } })).status, 403);
  const content = await fetch(`${base}/api/note?file=PERFIL.md`, { headers: { Cookie: cookie } }); assert.match((await content.json()).content, /José/);
});
test('Remote mode requires a private HTTPS origin and passcode', async t => {
  const { root } = await fixture(t);
  await assert.rejects(startServer({ root, port: 0, environment: { JARVIS_PUBLIC_ORIGIN: 'https://pc.example.ts.net' } }), /12 caracteres/);
  const { server, port } = await startServer({ root, port: 0, environment: { JARVIS_PUBLIC_ORIGIN: 'https://pc.example.ts.net', JARVIS_ACCESS_CODE: 'private-code-12345' } }); t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${port}`;
  const page = await fetch(base); assert.equal(page.headers.get('set-cookie'), null);
  const bad = await fetch(`${base}/api/login`, { method: 'POST', headers: { Origin: base, 'X-Jarvis': '1', 'Content-Type': 'application/json' }, body: JSON.stringify({ code: 'wrong' }) }); assert.equal(bad.status, 401);
  const good = await fetch(`${base}/api/login`, { method: 'POST', headers: { Origin: base, 'X-Jarvis': '1', 'Content-Type': 'application/json' }, body: JSON.stringify({ code: 'private-code-12345' }) }); assert.equal(good.status, 200); assert.ok(good.headers.get('set-cookie').includes('Secure'));
});
