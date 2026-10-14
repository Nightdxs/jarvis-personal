import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { EventEmitter } from 'node:events';
import { createEngine } from '../core.mjs';
import { createCodexBridge } from '../codex-bridge.mjs';
const base = path.resolve(process.env.JARVIS_TEST_ROOT || path.join(os.tmpdir(), 'jarvis-personal-tests'));
async function folder(t) { await fs.mkdir(base, { recursive: true }); const root = await fs.mkdtemp(path.join(base, 'plus-')); t.after(async () => { assert.ok(root.startsWith(base + path.sep)); await fs.rm(root, { recursive: true, force: true }); }); return root; }
const account = { installed: true, authenticated: true, method: 'chatgpt', message: 'Conectado con ChatGPT.' };
test('Plus mode uses Codex without an API key and preserves application tool controls', async t => {
  const root = await folder(t); let requests = 0, paidRequests = 0;
  const codex = { status: async () => account, response: async () => {
    requests++;
    return { status: 'completed', output: requests === 1 ? [{ type: 'function_call', name: 'write_note', call_id: 'call_1', arguments: JSON.stringify({ file: 'objetivo.md', content: '# Mi objetivo\nAprender programación.' }) }] : [{ type: 'message', content: [{ type: 'output_text', text: 'Guardé tu objetivo.' }] }] };
  } };
  const engine = createEngine({ root, environment: { JARVIS_NO_PAID_API: '1' }, codex, request: async () => { paidRequests++; throw new Error('Paid API must not be called.'); } }); await engine.init();
  const result = await engine.chat('Recuerda mi objetivo.'); assert.equal(result.text, 'Guardé tu objetivo.'); assert.equal(requests, 2); assert.equal(paidRequests, 0); assert.ok(result.state.notes.includes('objetivo.md'));
  assert.equal(result.state.connections.openai, false); assert.equal(result.state.connections.codex, true);
  await assert.rejects(engine.startVoice('v=0'), /bloqueado/); await assert.rejects(engine.configure({ provider: 'openai' }), /bloqueada/); assert.equal(paidRequests, 0);
});
test('No-paid mode overrides previously saved API configuration', async t => {
  const root = await folder(t); await fs.mkdir(path.join(root, 'data')); await fs.writeFile(path.join(root, 'data/settings.json'), JSON.stringify({ provider: 'openai', allowPaidApi: true }));
  const engine = createEngine({ root, environment: { JARVIS_NO_PAID_API: '1' }, codex: { status: async () => account } }); await engine.init(); const state = await engine.state(); assert.equal(state.settings.provider, 'codex'); assert.equal(state.settings.allowPaidApi, false);
});
test('Codex bridge strips API credentials and disables native execution and delegation', async t => {
  const root = await folder(t); const launches = [];
  const launch = (binary, args, options) => {
    launches.push({ binary, args, options }); const child = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter(); child.kill = () => {};
    child.stdin = new EventEmitter(); child.stdin.end = () => queueMicrotask(() => {
      child.stdout.emit('data', args[0] === 'login' ? 'Logged in using ChatGPT' : JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: JSON.stringify({ text: 'Hola.', calls: [] }) } }) + '\n' + JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 10, output_tokens: 5 } })); child.emit('close', 0);
    }); return child;
  };
  const bridge = createCodexBridge({ root, launch, environment: { JARVIS_CODEX_PATH: 'codex.exe', OPENAI_API_KEY: 'do-not-use', CODEX_API_KEY: 'do-not-use', CODEX_ACCESS_TOKEN: 'do-not-use' } });
  const response = await bridge.response({ instructions: 'Contesta.', input: [], tools: [] }); assert.equal(response.output[0].content[0].text, 'Hola.'); assert.equal(response.usage.total_tokens, 15);
  assert.ok(launches[1].args.includes('read-only')); assert.ok(launches[1].args.includes('shell_tool')); assert.ok(launches[1].args.includes('multi_agent')); assert.ok(launches[1].args.includes('forced_login_method="chatgpt"'));
  assert.equal(launches[1].options.shell, false); for (const key of ['OPENAI_API_KEY', 'CODEX_API_KEY', 'CODEX_ACCESS_TOKEN']) assert.equal(launches[1].options.env[key], undefined);
});
