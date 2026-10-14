import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createEngine, safePath } from './core.mjs';

const APP_ROOT = path.dirname(fileURLToPath(import.meta.url));
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.md': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
const equals = (a, b) => { const x = Buffer.from(a || ''), y = Buffer.from(b || ''); return x.length === y.length && crypto.timingSafeEqual(x, y); };
export async function startServer({ root = APP_ROOT, port = Number(process.env.PORT || 8787), request, environment = process.env } = {}) {
  const engine = createEngine({ root, request, environment });
  await engine.init();
  const remoteOrigin = environment.JARVIS_PUBLIC_ORIGIN || '';
  const accessCode = environment.JARVIS_ACCESS_CODE || '';
  if (remoteOrigin && (!accessCode || accessCode.length < 12)) throw new Error('Para acceso remoto define JARVIS_ACCESS_CODE con al menos 12 caracteres.');
  if (remoteOrigin && new URL(remoteOrigin).protocol !== 'https:') throw new Error('El acceso remoto requiere una URL HTTPS privada.');
  const cookieToken = crypto.randomBytes(32).toString('hex');
  const failedLogins = new Map();
  let actualPort = port;
  const cookie = () => `jarvis_session=${cookieToken}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${remoteOrigin ? '; Secure' : ''}`;
  const allowedHost = (host) => [`localhost:${actualPort}`, `127.0.0.1:${actualPort}`, ...(remoteOrigin ? [new URL(remoteOrigin).host] : [])].includes(host);
  const authenticated = (req) => (req.headers.cookie || '').split(';').some(x => equals(x.trim(), `jarvis_session=${cookieToken}`));
  const send = (res, status, body, type = 'application/json; charset=utf-8') => {
    res.writeHead(status, { 'Content-Type': type }); res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
  };
  async function readBody(req) {
    if (!String(req.headers['content-type']).startsWith('application/json')) throw new Error('Se requiere JSON.');
    const chunks = []; let bytes = 0;
    for await (const chunk of req) { bytes += chunk.length; if (bytes > 1_000_000) throw new Error('Solicitud demasiado grande.'); chunks.push(chunk); }
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  }
  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'self'");
    try {
      if (!allowedHost(req.headers.host)) return send(res, 403, { error: 'Host no autorizado.' });
      const pathname = new URL(req.url, 'http://localhost').pathname;
      if (req.method === 'POST') {
        const allowedOrigins = [`http://localhost:${actualPort}`, `http://127.0.0.1:${actualPort}`, ...(remoteOrigin ? [new URL(remoteOrigin).origin] : [])];
        if (!allowedOrigins.includes(req.headers.origin) || req.headers['x-jarvis'] !== '1') return send(res, 403, { error: 'Origen no autorizado.' });
      }
      if (req.method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
        if (!accessCode) res.setHeader('Set-Cookie', cookie());
        return send(res, 200, await fs.readFile(path.join(APP_ROOT, 'public/index.html')), mime['.html']);
      }
      if (req.method === 'GET' && ['/app.js', '/realtime.js', '/style.css'].includes(pathname)) return send(res, 200, await fs.readFile(path.join(APP_ROOT, 'public', pathname.slice(1))), mime[path.extname(pathname)]);
      if (pathname === '/favicon.ico') return send(res, 204, '');
      if (req.method === 'GET' && pathname === '/api/access') return send(res, 200, { locked: !!accessCode && !authenticated(req) });
      if (req.method === 'POST' && pathname === '/api/login') {
        const address = req.socket.remoteAddress;
        let rate = failedLogins.get(address);
        if (!rate || rate.reset < Date.now()) rate = { attempts: 0, reset: Date.now() + 60_000 };
        if (rate.attempts >= 5) return send(res, 429, { error: 'Espera un minuto antes de volver a intentar.' });
        const body = await readBody(req);
        if (accessCode && !equals(body.code, accessCode)) { rate.attempts++; failedLogins.set(address, rate); return send(res, 401, { error: 'Código de acceso incorrecto.' }); }
        res.setHeader('Set-Cookie', cookie());
        return send(res, 200, { ok: true });
      }
      if (!authenticated(req)) return send(res, 401, { error: 'Abre JARVIS desde su página principal o introduce el código de acceso.' });
      if (req.method === 'GET' && pathname === '/api/state') return send(res, 200, await engine.state());
      if (req.method === 'GET' && pathname === '/api/review-files') {
        const id = new URL(req.url, 'http://localhost').searchParams.get('id');
        return send(res, 200, { files: engine.reviewFiles(id) });
      }
      if (req.method === 'GET' && pathname.startsWith('/review/')) {
        const [id, ...parts] = decodeURIComponent(pathname.slice('/review/'.length)).split('/');
        const relative = parts.join('/');
        const file = engine.reviewFiles(id).find(x => x.file === relative);
        if (!file) return send(res, 404, { error: 'Archivo no encontrado.' });
        res.setHeader('Content-Security-Policy', "sandbox allow-scripts; default-src 'self' data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'");
        return send(res, 200, file.data, mime[path.extname(relative)] || 'text/plain');
      }
      if (req.method === 'GET' && pathname === '/api/note') {
        const file = new URL(req.url, 'http://localhost').searchParams.get('file');
        return send(res, 200, { file, content: await fs.readFile(await safePath(engine.vault, file, ['.md']), 'utf8') });
      }
      if (req.method === 'GET' && pathname === '/api/project-file') {
        const query = new URL(req.url, 'http://localhost').searchParams;
        return send(res, 200, await engine.runTool('read_project_file', { project: query.get('project'), file: query.get('file') }));
      }
      if (req.method === 'GET' && pathname.startsWith('/preview/')) {
        const relative = decodeURIComponent(pathname.slice('/preview/'.length));
        const target = await safePath(engine.projects, relative, ['.html', '.css', '.js', '.json', '.svg', '.txt']);
        res.setHeader('Content-Security-Policy', "sandbox allow-scripts; default-src 'self' data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'");
        return send(res, 200, await fs.readFile(target), mime[path.extname(target)]);
      }
      if (req.method === 'POST') {
        const body = await readBody(req);
        if (pathname === '/api/settings') return send(res, 200, await engine.configure(body));
        if (pathname === '/api/verify-key') return send(res, 200, await engine.verifyKey());
        if (pathname === '/api/verify-codex') return send(res, 200, await engine.verifyCodex());
        if (pathname === '/api/chat') return send(res, 200, await engine.chat(body.message));
        if (pathname === '/api/realtime/start') return send(res, 200, await engine.startVoice(body.sdp));
        if (pathname === '/api/realtime/stop') return send(res, 200, await engine.stopVoice(body.sessionId));
        if (pathname === '/api/realtime/tool') return send(res, 200, await engine.voiceTool(body.sessionId, body.callId, body.name, body.args));
        if (pathname === '/api/realtime/transcript') return send(res, 200, await engine.voiceTranscript(body.sessionId, body.itemId, body.role, body.content));
        if (pathname === '/api/approve') {
          if (typeof body.allowed !== 'boolean') throw new Error('Aprobación inválida.');
          return send(res, 200, await engine.approve(body.id, body.allowed));
        }
        if (pathname === '/api/note') { await engine.runTool('write_note', body); return send(res, 200, await engine.state()); }
        if (pathname === '/api/clear-history') { await engine.clearHistory(); return send(res, 200, await engine.state()); }
        if (pathname === '/api/disconnect') { await engine.disconnect(); return send(res, 200, await engine.state()); }
        if (pathname === '/api/action') {
          if (!['publish_github', 'deploy_vercel', 'deployment_status', 'control_device', 'list_devices', 'get_weather', 'search_notes'].includes(body.tool)) throw new Error('Acción no permitida.');
          return send(res, 200, await engine.runTool(body.tool, body.args || {}));
        }
      }
      return send(res, 404, { error: 'Recurso no encontrado.' });
    } catch (e) { return send(res, e.code === 'ENOENT' ? 404 : 400, { error: engine.redact(e.message) }); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  actualPort = server.address().port;
  return { server, engine, port: actualPort };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  startServer().then(({ port }) => console.log(`JARVIS listo: http://localhost:${port}\nLas claves permanecen en memoria hasta detener el servidor.`)).catch(e => { console.error(e.code === 'EADDRINUSE' ? 'El puerto está ocupado. Abre http://localhost:8787 si JARVIS ya está iniciado, o configura PORT.' : e.message); process.exitCode = 1; });
}
