import { RealtimeVoice } from './realtime.js';
const $ = (id) => document.getElementById(id);
let state, sending = false, selectedProject = null, toastTimer, recognition;
const titles = { chat: 'Conversación', memory: 'Memoria', projects: 'Proyectos', devices: 'Mi casa', settings: 'Conexiones' };
function node(tag, text, className) { const element = document.createElement(tag); if (text !== undefined) element.textContent = text; if (className) element.className = className; return element; }
function toast(message, error = false) {
  clearTimeout(toastTimer); $('toast').textContent = message; $('toast').className = `toast${error ? ' error' : ''}`;
  toastTimer = setTimeout(() => $('toast').classList.add('hidden'), error ? 15000 : 6500);
}
async function api(route, body) {
  const response = await fetch(route, { ...(body !== undefined ? { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Jarvis': '1' }, body: JSON.stringify(body) } : {}), credentials: 'same-origin' });
  const data = await response.json();
  if (!response.ok) {
    const detail = data.error || 'No se pudo completar la solicitud.';
    if (/no credits remaining|insufficient_quota|exceeded your current quota/i.test(detail)) throw new Error('Tu cuenta de OpenAI no tiene saldo de API disponible. Añade créditos en platform.openai.com/settings/organization/billing/ y vuelve a probar.');
    throw new Error(detail);
  }
  return data;
}
function handle(action) { return async (event) => { try { await action(event); } catch (e) { toast(e.message, true); } }; }
function view(name) {
  document.querySelectorAll('.view').forEach(x => x.classList.toggle('hidden', x.id !== `view-${name}`));
  document.querySelectorAll('.nav').forEach(x => x.classList.toggle('active', x.dataset.view === name));
  $('view-title').textContent = titles[name];
}
document.querySelectorAll('[data-view]').forEach(x => x.addEventListener('click', () => view(x.dataset.view)));
document.querySelectorAll('[data-prompt]').forEach(x => x.addEventListener('click', () => { $('message').value = x.dataset.prompt; $('message').focus(); }));
function renderMessage(role, text, traces, tokens) {
  const wrapper = node('article', undefined, `message ${role}`);
  wrapper.append(node('div', role === 'user' ? 'TÚ' : 'J', 'avatar'));
  const body = node('div', undefined, 'message-body');
  body.append(node('div', role === 'user' ? 'TÚ' : 'JARVIS', 'message-name'), node('div', text, 'message-text'));
  if (traces?.length) {
    const details = node('details'); details.append(node('summary', `${traces.length} herramientas utilizadas${tokens ? ` · ${tokens.toLocaleString('es')} tokens` : ''}`));
    details.append(node('pre', traces.map(x => `${x.tool}\n${x.result}`).join('\n\n'))); body.append(details);
  } else if (tokens) body.append(node('div', `${tokens.toLocaleString('es')} tokens en esta tarea`, 'field-hint'));
  wrapper.append(body); $('messages').append(wrapper); $('welcome').classList.add('hidden');
  $('messages').scrollTop = $('messages').scrollHeight;
}
function renderHistory() {
  $('messages').querySelectorAll('.message, .weather-card').forEach(x => x.remove());
  $('welcome').classList.toggle('hidden', state.history.length > 0);
  state.history.forEach(x => renderMessage(x.role, x.content));
}
function button(text, action, className = 'secondary') { const element = node('button', text, className); element.type = 'button'; element.addEventListener('click', handle(action)); return element; }
function pendingCards(container) {
  container.replaceChildren();
  state.pending.forEach(item => {
    const card = node('div', undefined, 'action-card'); card.append(node('h3', item.title), node('p', item.detail));
    const resolve = (allowed) => async () => {
      card.querySelectorAll('button').forEach(x => x.disabled = true);
      try {
        const result = await api('/api/approve', { id: item.id, allowed });
        if (voice.phase === 'active') {
          voice.send({ type: 'conversation.item.create', item: { type: 'message', role: 'user', content: [{ type: 'input_text', text: `Resultado verificado de la acción ${allowed ? 'aprobada' : 'cancelada'} en el panel: ${JSON.stringify(result)}` }] } });
        }
        toast(result.message); state = await api('/api/state'); renderState(); renderHistory();
        if (result.id) renderDeployment(result.id, result.url, result.state);
      } catch (e) { state = await api('/api/state'); renderState(); throw e; }
    };
    card.append(button('Aprobar y ejecutar', resolve(true), 'primary'), button('Cancelar', resolve(false))); container.append(card);
    if (['deploy_vercel', 'publish_github'].includes(item.type)) {
      card.append(button('Revisar archivos preparados', async () => {
        const result = await api(`/api/review-files?id=${encodeURIComponent(item.id)}`);
        $('project-preview').classList.remove('hidden'); $('preview-title').textContent = `${item.title} · versión preparada`;
        $('project-file-select').replaceChildren(); selectedProject = null;
        $('project-code').textContent = result.files.map(file => `--- ${file.file} ---\n${file.data}`).join('\n\n');
        $('preview').src = `/review/${encodeURIComponent(item.id)}/index.html`; $('preview').classList.remove('hidden');
        view('projects'); $('project-preview').scrollIntoView({ behavior: 'smooth', block: 'start' });
      }));
    }
  });
}
function renderState() {
  $('note-count').textContent = state.notes.length; $('project-count').textContent = state.projects.length;
  const plusMode = state.settings.provider === 'codex';
  document.querySelector('#view-settings .section-intro p').textContent = plusMode ? 'Usa tu sesión de ChatGPT con Codex. Las demás conexiones son opcionales.' : 'Empieza con OpenAI. Las demás conexiones son opcionales.';
  const connected = plusMode ? state.connections.codex : state.connections.openai;
  $('connection-status').classList.toggle('connected', connected);
  $('connection-status').querySelector('span').textContent = plusMode ? connected ? 'ChatGPT · Codex conectado' : 'Codex pendiente' : connected ? 'API key configurada' : 'Sin API key';
  $('model-label').textContent = plusMode ? 'Codex · usa tu plan de ChatGPT · API de pago bloqueada' : `OpenAI · ${state.settings.model}`;
  $('openai-state').closest('.settings-card').classList.toggle('hidden', plusMode);
  $('plus-card').classList.toggle('hidden', !plusMode);
  $('plus-status').textContent = state.codex?.message || 'Verifica el inicio de sesión de Codex.';
  $('realtime-model').closest('.settings-card').classList.toggle('hidden', plusMode);
  if (plusMode) { $('realtime-status').textContent = 'Voz del navegador · sin API de pago'; $('realtime-usage').textContent = 'Dicta tu mensaje y activa Leer respuestas. Disponibilidad según navegador.'; $('realtime-toggle').textContent = 'Cómo usar la voz'; }
  $('memory-context').textContent = state.context ? `Última petición: ${state.context.characters.toLocaleString('es')} / ${state.context.budget.toLocaleString('es')} caracteres de memoria · ${state.context.files.join(', ')}` : `Presupuesto de memoria: ${state.settings.contextBudget.toLocaleString('es')} caracteres. Las notas se seleccionan según tu petición.`;
  if (state.voiceActive && voice.phase === 'idle') $('realtime-toggle').textContent = 'Terminar sesión anterior';
  for (const service of ['openai', 'github', 'vercel', 'ha']) {
    $(`${service}-state`).textContent = state.connections[service] ? 'Configurado' : service === 'openai' ? 'Pendiente' : 'Opcional';
    $(`${service}-state`).classList.toggle('connected', state.connections[service]);
    $(`${service}-key`).placeholder = state.connections[service] ? 'Configurado · vacío conserva la clave' : service === 'openai' ? 'sk-…' : `Token de ${service}`;
  }
  $('notes').replaceChildren();
  state.notes.forEach(file => $('notes').append(button(file, () => openNote(file), `file-button${$('note-file').value === file ? ' selected' : ''}`)));
  pendingCards($('pending-actions')); pendingCards($('device-actions')); renderProjects();
}
function populateSettings() {
  $('model').value = state.settings.model;
  $('realtime-model').value = state.settings.realtimeModel; $('realtime-voice').value = state.settings.voice; $('context-budget').value = state.settings.contextBudget;
  $('ha-url').value = state.settings.haUrl;
  $('ha-entities').value = state.settings.allowedEntities.join(', ');
  $('vercel-team').value = state.settings.vercelTeam;
  $('profile').value = state.settings.profile;
  $('style').value = state.settings.style;
}
async function refresh() { state = await api('/api/state'); renderState(); }
function setBusy(value) {
  sending = value; $('send').disabled = value; $('chat-progress').classList.toggle('hidden', !value);
  document.querySelectorAll('.action-card button').forEach(x => x.disabled = value);
}
$('chat-form').addEventListener('submit', handle(async event => {
  event.preventDefault(); if (sending) return;
  if (voice.phase !== 'idle' || state.voiceActive) { toast('Termina la conversación por voz para enviar un mensaje escrito.'); return; }
  const message = $('message').value.trim(); if (!message) return;
  if (state.settings.provider === 'codex' ? !state.connections.codex : !state.connections.openai) { toast(state.settings.provider === 'codex' ? 'Inicia sesión en Codex con tu cuenta de ChatGPT y verifica la conexión.' : 'Crea tu API key e introdúcela en OpenAI para activar JARVIS.'); view('settings'); return; }
  setBusy(true); $('message').value = ''; renderMessage('user', message);
  try {
    const result = await api('/api/chat', { message });
    renderMessage('assistant', result.text, result.traces, result.tokens); state = result.state; renderState();
    if (result.context) $('messages').lastElementChild?.querySelector('.message-body')?.append(node('p', `Memoria consultada: ${result.context.files.join(', ')} · ${result.context.characters.toLocaleString('es')} caracteres.`, 'field-hint'));
    for (const trace of result.traces) if (trace.tool === 'get_weather') { try { renderWeather(JSON.parse(trace.result)); } catch {} }
    if ($('speak').checked && 'speechSynthesis' in window) {
      speakText(result.text.slice(0, 5000));
    }
  } catch (e) {
    renderMessage('assistant', `No pude completar la tarea: ${e.message}`); $('message').value = message;
    await refresh(); toast(e.message, true);
  } finally { setBusy(false); }
}));
$('message').addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); $('chat-form').requestSubmit(); } });

let savedBrowserVoice = '';
let browserDictationFallback = false;
function dictationHelp() {
  recognition?.abort();
  $('message').focus();
  $('dictation-help').classList.remove('hidden');
  $('dictation-status').textContent = 'Pulsa Windows + H, activa el micrófono de Windows y habla. Revisa el texto y pulsa Enviar. El dictado de Windows usa reconocimiento en línea de Microsoft.';
}
try { savedBrowserVoice = localStorage.getItem('jarvis-browser-voice') || ''; } catch {}
function loadBrowserVoices() {
  const voices = speechSynthesis.getVoices().slice().sort((a,b) => Number(b.lang.startsWith('es')) - Number(a.lang.startsWith('es')) || a.name.localeCompare(b.name));
  $('browser-voice').replaceChildren(new Option('Automática · español', ''));
  voices.forEach(v => $('browser-voice').append(new Option(v.name + ' · ' + v.lang, v.voiceURI)));
  $('browser-voice').value = voices.some(v => v.voiceURI === savedBrowserVoice) ? savedBrowserVoice : '';
}
function speakText(text) {
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voices = speechSynthesis.getVoices();
  const selected = voices.find(v => v.voiceURI === $('browser-voice').value) || voices.find(v => v.lang.startsWith('es'));
  utterance.lang = selected?.lang || 'es-ES';
  if (selected) utterance.voice = selected;
  utterance.pitch = Number($('voice-pitch').value);
  utterance.rate = Number($('voice-rate').value);
  utterance.onerror = event => { if (!['canceled', 'interrupted'].includes(event.error)) toast('No se pudo reproducir la voz. Comprueba el audio del navegador.', true); };
  speechSynthesis.speak(utterance);
}
$('browser-voice').addEventListener('change', () => {
  savedBrowserVoice = $('browser-voice').value;
  try { localStorage.setItem('jarvis-browser-voice', savedBrowserVoice); } catch {}
  if ('speechSynthesis' in window) speechSynthesis.cancel();
});
$('preview-voice').addEventListener('click', () => speakText('Hola, soy JARVIS. Estoy listo para ayudarte.'));
for (const id of ['voice-pitch', 'voice-rate']) {
  try { const saved = Number(localStorage.getItem(`jarvis-${id}`)); if (saved >= Number($(id).min) && saved <= Number($(id).max)) $(id).value = saved; } catch {}
  $(id).addEventListener('change', () => { try { localStorage.setItem(`jarvis-${id}`, $(id).value); } catch {} });
}
$('voice-style').addEventListener('click', () => {
  const male = speechSynthesis.getVoices().find(v => v.lang.startsWith('es') && /raul/i.test(v.name));
  if (male) { $('browser-voice').value = male.voiceURI; $('browser-voice').dispatchEvent(new Event('change')); }
  $('voice-pitch').value = '0.8'; $('voice-rate').value = '0.9';
  for (const id of ['voice-pitch', 'voice-rate']) $(id).dispatchEvent(new Event('change'));
  toast('Voz más grave y pausada. Es una aproximación con tu voz instalada, no la voz exacta de Marvel. Pulsa Probar voz.');
});
$('windows-dictation').addEventListener('click', dictationHelp);
if ('speechSynthesis' in window) {
  loadBrowserVoices(); speechSynthesis.addEventListener('voiceschanged', loadBrowserVoices);
} else { for (const id of ['browser-voice', 'preview-voice', 'voice-style', 'voice-pitch', 'voice-rate']) $(id).disabled = true; }

$('speak').addEventListener('change', () => { if (!$('speak').checked && 'speechSynthesis' in window) speechSynthesis.cancel(); });
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
  recognition = new SpeechRecognition(); recognition.lang = 'es-ES'; recognition.continuous = false; recognition.interimResults = false;
  recognition.onresult = event => { $('message').value += ($('message').value ? ' ' : '') + event.results[0][0].transcript; $('message').focus(); };
  recognition.onend = () => { $('mic').classList.remove('listening'); $('mic').querySelector('span').textContent = 'Dictar'; };
  recognition.onerror = event => {
    if (event.error === 'aborted') return;
    const messages = {
      network: 'El servicio de dictado del navegador no responde (network). En Brave puede no estar disponible. Usa Dictado Windows y pulsa Windows + H.',
      'not-allowed': 'El navegador no tiene permiso para usar el micrófono. Revisa el permiso de micrófono de localhost o usa Dictado Windows.',
      'service-not-allowed': 'El navegador no permite este servicio de dictado. Usa Dictado Windows.',
      'audio-capture': 'No se encuentra un micrófono disponible. Comprueba que esté conectado y habilitado en Windows.',
      'no-speech': 'No se detectó voz. Vuelve a pulsar Dictar y habla cerca del micrófono.'
    };
    const message = messages[event.error] || `El dictado no está disponible (${event.error}). Usa Dictado Windows.`;
    $('dictation-help').classList.remove('hidden'); $('dictation-status').textContent = message;
    toast(message, true);
  };
  $('mic').addEventListener('click', handle(() => {
    if (browserDictationFallback) { dictationHelp(); return; }
    if ($('mic').classList.contains('listening')) recognition.stop();
    else { if (voice.phase !== 'idle') throw new Error('Termina la voz Realtime antes de usar dictado.'); if ('speechSynthesis' in window) speechSynthesis.cancel(); recognition.start(); $('mic').classList.add('listening'); $('mic').querySelector('span').textContent = 'Escuchando…'; }
  }));
} else { browserDictationFallback = true; $('mic').addEventListener('click', dictationHelp); $('mic').title = 'Usar el dictado de Windows con Windows + H.'; }
if (navigator.brave?.isBrave) navigator.brave.isBrave().then(isBrave => {
  if (isBrave) {
    browserDictationFallback = true;
    $('mic').querySelector('span').textContent = 'Dictar · Win + H';
    $('mic').title = 'El dictado web puede fallar en Brave. Pulsa aquí y después Windows + H.';
    $('dictation-help').classList.remove('hidden');
    $('dictation-status').textContent = 'En Brave usa Dictado Windows: pulsa en el mensaje y después Windows + H. No se utiliza una API de pago de OpenAI.';
  }
}).catch(() => {});
if (!('speechSynthesis' in window)) { $('speak').disabled = true; }
$('settings-form').addEventListener('submit', handle(async event => {
  event.preventDefault();
  const saveButton = event.submitter; saveButton.disabled = true;
  try {
    const values = { model: $('model').value.trim(), realtimeModel: $('realtime-model').value.trim(), voice: $('realtime-voice').value, contextBudget: Number($('context-budget').value), haUrl: $('ha-url').value.trim(), allowedEntities: $('ha-entities').value.split(',').map(x => x.trim()).filter(Boolean), vercelTeam: $('vercel-team').value.trim(), profile: $('profile').value, style: $('style').value };
    for (const service of ['openai', 'github', 'vercel', 'ha']) values[service] = $(`${service}-key`).value.trim();
    state = await api('/api/settings', values);
    for (const service of ['openai', 'github', 'vercel', 'ha']) $(`${service}-key`).value = '';
    renderState(); toast('Ajustes guardados. Las claves quedan en memoria del servidor.');
  } finally { saveButton.disabled = false; }
}));
$('save-openai').addEventListener('click', handle(async () => {
  if (!$('openai-key').value.trim() && !state.connections.openai) throw new Error('Introduce tu API key antes de guardar.');
  $('save-openai').disabled = true;
  try {
    state = await api('/api/settings', { openai: $('openai-key').value.trim(), model: $('model').value.trim() });
    $('openai-key').value = ''; renderState(); toast('Clave guardada en memoria. Pulsa Verificar clave guardada.');
  } finally { $('save-openai').disabled = false; }
}));
$('verify-key').addEventListener('click', handle(async () => {
  $('verify-key').disabled = true;
  try { const result = await api('/api/verify-key', {}); toast(result.modelAvailable ? 'Clave válida y modelo disponible. Falta comprobar el saldo de API con un mensaje de prueba.' : 'Clave válida. El modelo elegido no aparece en tu cuenta: cambia el modelo antes de conversar.', !result.modelAvailable); }
  finally { $('verify-key').disabled = false; }
}));
async function openNote(file) { const note = await api(`/api/note?file=${encodeURIComponent(file)}`); $('note-file').value = file; $('note-content').value = note.content; renderState(); }
$('new-note').addEventListener('click', () => { $('note-file').value = ''; $('note-content').value = ''; $('note-file').focus(); renderState(); });
$('note-form').addEventListener('submit', handle(async event => {
  event.preventDefault(); state = await api('/api/note', { file: $('note-file').value.trim(), content: $('note-content').value }); renderState(); toast('Nota guardada en tu vault.');
}));
function renderProjects() {
  $('projects').replaceChildren();
  if (!state.projects.length) { $('projects').append(node('div', 'Todavía no hay proyectos. Pídele a JARVIS que cree tu primera landing y aparecerá aquí con su código y vista previa.', 'empty')); return; }
  for (const project of state.projects) {
    const card = node('article', undefined, 'project-card'); const info = node('div');
    info.append(node('h3', project.name), node('p', `${project.files.length} archivos · ${project.files.slice(0, 5).join(', ')}`));
    const buttons = node('div', undefined, 'project-buttons');
    buttons.append(button('Vista previa / código', () => openProject(project)), button('GitHub', async () => { await api('/api/action', { tool: 'publish_github', args: { project: project.name, repository: project.name } }); await refresh(); view('chat'); toast('Revisa y aprueba la tarjeta para subirlo a GitHub.'); }), button('Vercel', async () => { await api('/api/action', { tool: 'deploy_vercel', args: { project: project.name } }); await refresh(); view('chat'); toast('Revisa la tarjeta antes de desplegar la web.'); }));
    card.append(info, buttons); $('projects').append(card);
  }
}
async function openProject(project) {
  selectedProject = project.name; $('preview-title').textContent = project.name; $('project-preview').classList.remove('hidden');
  $('project-file-select').replaceChildren(); project.files.forEach(file => { const option = node('option', file); option.value = file; $('project-file-select').append(option); });
  if (project.files.includes('index.html')) { $('project-file-select').value = 'index.html'; $('preview').src = `/preview/${encodeURIComponent(project.name)}/index.html`; $('preview').classList.remove('hidden'); }
  else { $('preview').removeAttribute('src'); $('preview').classList.add('hidden'); }
  await showCode(); $('project-preview').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
async function showCode() {
  if (!selectedProject || !$('project-file-select').value) return;
  const result = await api(`/api/project-file?project=${encodeURIComponent(selectedProject)}&file=${encodeURIComponent($('project-file-select').value)}`); $('project-code').textContent = result.content;
}
$('project-file-select').addEventListener('change', handle(showCode));
$('close-preview').addEventListener('click', () => { $('project-preview').classList.add('hidden'); $('preview').removeAttribute('src'); });
function renderDeployment(id, url, initialState) {
  const card = node('div', undefined, 'action-card'); card.append(node('h3', `Despliegue ${id}`));
  const status = node('p', `Estado: ${initialState || 'QUEUED'}`); card.append(status);
  const link = node('a', 'Abrir URL del despliegue ↗', 'text-link'); link.target = '_blank'; link.rel = 'noreferrer';
  if (url?.startsWith('https://')) link.href = url; else link.classList.add('hidden');
  card.append(link, button('Consultar estado', async () => {
    const result = await api('/api/action', { tool: 'deployment_status', args: { id } }); status.textContent = `Estado: ${result.state}${result.error ? ` · ${result.error}` : ''}`;
    if (result.url?.startsWith('https://')) { link.href = result.url; link.classList.remove('hidden'); }
    if (result.state === 'READY') toast('Vercel confirmó READY. Tu web ya está desplegada.');
  })); $('projects').prepend(card);
}
$('refresh-devices').addEventListener('click', handle(async () => {
  $('refresh-devices').disabled = true;
  try {
    const result = await api('/api/action', { tool: 'list_devices', args: {} }); $('devices').replaceChildren();
    if (!Array.isArray(result) || !result.length) { $('devices').append(node('div', result.message || 'No hay dispositivos autorizados.', 'empty')); return; }
    for (const device of result) {
      const card = node('div', undefined, 'device-card'), info = node('div'); info.append(node('h3', device.name), node('p', `${device.entity} · ${device.state}`));
      const controls = node('div', undefined, 'project-buttons');
      for (const action of device.entity.startsWith('scene.') ? ['turn_on'] : ['turn_on', 'turn_off']) controls.append(button(action === 'turn_on' ? 'Activar' : 'Apagar', async () => { await api('/api/action', { tool: 'control_device', args: { entity: device.entity, action } }); await refresh(); toast('Acción preparada. Aprueba la tarjeta para ejecutarla.'); }));
      card.append(info, controls); $('devices').append(card);
    }
  } finally { $('refresh-devices').disabled = false; }
}));
$('disconnect').addEventListener('click', handle(async () => { state = await api('/api/disconnect', {}); renderState(); toast('Claves desconectadas del servidor.'); }));
$('clear-history').addEventListener('click', handle(async () => { if (!confirm('¿Vaciar la conversación local? Tus notas y proyectos se conservarán.')) return; state = await api('/api/clear-history', {}); renderState(); renderHistory(); toast('Conversación vaciada.'); }));
function renderWeather(result) {
  if (!result?.current || !Number.isFinite(result.current.temperature_2m)) return;
  const card = node('div', undefined, 'weather-card');
  card.append(node('h3', result.location), node('div', `${result.current.temperature_2m} ${result.units?.temperature_2m || '°C'}`, 'temperature'));
  card.append(node('p', `Dato: ${result.current.time} · ${result.timezone}`));
  for (let i = 0; i < (result.forecast?.time?.length || 0); i++) card.append(node('p', `${result.forecast.time[i]} · ${result.forecast.temperature_2m_min[i]}–${result.forecast.temperature_2m_max[i]} °C · probabilidad de lluvia ${result.forecast.precipitation_probability_max[i]} %`));
  const link = node('a', 'Datos meteorológicos: Open-Meteo ↗'); link.href = 'https://open-meteo.com/'; link.target = '_blank'; link.rel = 'noreferrer'; card.append(link);
  $('messages').append(card); $('messages').scrollTop = $('messages').scrollHeight;
}
const voice = new RealtimeVoice({
  rpc: api,
  onStatus: status => {
    if (state && voice.phase === 'idle') state.voiceActive = !!voice.sessionId;
    $('realtime-status').textContent = status;
    document.querySelector('.realtime-bar').classList.toggle('active', voice.phase === 'active');
    $('realtime-toggle').textContent = voice.phase === 'active' || voice.sessionId ? 'Terminar voz' : voice.phase === 'connecting' ? 'Conectando…' : 'Iniciar voz Realtime';
    $('send').disabled = voice.phase !== 'idle';
  },
  onTranscript: (role, text) => renderMessage(role, text),
  onTool: async (name, result) => {
    if (name === 'get_weather') renderWeather(result);
    else renderMessage('assistant', result.status === 'pendiente_de_aprobacion' ? `${result.title}. Revisa y aprueba la tarjeta para ejecutarla.` : `Herramienta: ${name}${result.error ? ` · ${result.error}` : ' · completada'}`, [{ tool: name, result: JSON.stringify(result).slice(0, 1500) }]);
    await refresh();
  },
  onError: error => toast(error.message, true),
  onUsage: tokens => { $('realtime-usage').textContent = `${tokens.toLocaleString('es')} tokens reportados en esta sesión · máximo 10 minutos`; }
});
$('realtime-toggle').addEventListener('click', handle(async () => {
  if (state.settings.provider === 'codex') { $('speak').checked = true; toast('Pulsa Dictar, revisa el mensaje y envíalo. JARVIS leerá su respuesta si el navegador admite voz. No se utiliza Realtime ni una API de pago.'); return; }
  if (voice.phase === 'active' || voice.sessionId || state.voiceActive) {
    await voice.stop(); await api('/api/realtime/stop', {}); await refresh(); return;
  }
  if (sending || voice.phase !== 'idle') return;
  if (!state.connections.openai) { toast('Introduce y verifica tu API key de OpenAI antes de iniciar la voz.'); view('settings'); $('openai-key').focus(); return; }
  $('realtime-toggle').disabled = true;
  try { recognition?.abort(); if ('speechSynthesis' in window) speechSynthesis.cancel(); const result = await voice.start(); if (result) { state.voiceActive = true; toast('Voz activa. Habla con JARVIS; puedes interrumpirlo y terminar cuando quieras.'); } }
  catch (error) { $('realtime-status').textContent = `No se pudo iniciar: ${error.message}`; throw error; }
  finally { $('realtime-toggle').disabled = false; }
}));
window.addEventListener('pagehide', () => { voice.media?.getTracks().forEach(track => track.stop()); voice.pc?.close(); if (voice.sessionId) fetch('/api/realtime/stop', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Jarvis': '1' }, body: JSON.stringify({ sessionId: voice.sessionId }), keepalive: true }).catch(() => {}); });
$('memory-search').addEventListener('submit', handle(async event => {
  event.preventDefault(); const result = await api('/api/action', { tool: 'search_notes', args: { query: $('memory-query').value } }); $('memory-results').replaceChildren();
  if (!result.results.length) { $('memory-results').append(node('p', 'No encontré notas sobre ese tema.', 'field-hint')); return; }
  for (const note of result.results) {
    const card = node('div', undefined, 'memory-result'); card.append(button(note.file, () => openNote(note.file)), node('p', note.excerpt)); $('memory-results').append(card);
  }
}));
const billingLink = node('a', 'Revisar facturación y saldo de API ↗', 'text-link'); billingLink.href = 'https://platform.openai.com/settings/organization/billing/'; billingLink.target = '_blank'; billingLink.rel = 'noreferrer'; $('verify-key').parentElement.after(billingLink);
const plusCard = node('div', undefined, 'settings-card featured wide'); plusCard.id = 'plus-card';
plusCard.append(node('h3', 'ChatGPT Plus mediante Codex'), node('p', 'JARVIS usa tu sesión de Codex con ChatGPT. No necesita una API key y las llamadas a la API de pago están bloqueadas. Se aplican los límites de uso de tu plan.'));
const plusStatus = node('p', '', 'field-hint'); plusStatus.id = 'plus-status'; plusCard.append(plusStatus, button('Verificar conexión con ChatGPT', async () => { const result = await api('/api/verify-codex', {}); toast(result.message, !result.authenticated); await refresh(); }));
document.querySelector('.settings-grid').prepend(plusCard);
async function init() { await refresh(); populateSettings(); renderHistory(); if (state.settings.provider === 'codex') { if (!state.connections.codex) toast('Abre Conexiones y verifica tu sesión de Codex con ChatGPT.'); } else if (!state.connections.openai) toast('Bienvenido. Abre Conexiones para crear e introducir tu API key.'); }
$('login-form').addEventListener('submit', handle(async event => { event.preventDefault(); await api('/api/login', { code: $('access-code').value }); $('access-code').value = ''; $('login').classList.add('hidden'); await init(); }));
try { const access = await api('/api/access'); if (access.locked) $('login').classList.remove('hidden'); else await init(); }
catch (e) { toast(`No pude conectar con el servidor: ${e.message}`, true); }
