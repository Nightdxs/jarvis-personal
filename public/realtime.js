export class RealtimeVoice {
  constructor({ rpc, onStatus = () => {}, onTranscript = () => {}, onTool = () => {}, onError = () => {}, onUsage = () => {} }, runtime = globalThis) {
    Object.assign(this, { rpc, onStatus, onTranscript, onTool, onError, onUsage, runtime });
    this.phase = 'idle'; this.sessionId = null; this.events = Promise.resolve(); this.seen = new Set(); this.tokens = 0; this.generation = 0;
  }
  send(event) { if (this.channel?.readyState === 'open') this.channel.send(JSON.stringify(event)); }
  async start() {
    if (this.phase !== 'idle') throw new Error('Ya hay una sesión de voz.');
    if (!this.runtime.RTCPeerConnection || !this.runtime.navigator?.mediaDevices?.getUserMedia) throw new Error('La voz Realtime requiere un navegador con WebRTC y micrófono, en HTTPS o localhost.');
    const generation = ++this.generation;
    this.phase = 'connecting'; this.seen.clear(); this.tokens = 0; this.onStatus('Conectando voz…');
    try {
      this.media = await this.runtime.navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      if (generation !== this.generation) { this.media.getTracks().forEach(x => x.stop()); return; }
      this.pc = new this.runtime.RTCPeerConnection();
      this.audio = this.runtime.document.createElement('audio'); this.audio.autoplay = true; this.audio.className = 'hidden'; this.runtime.document.body.append(this.audio);
      this.pc.ontrack = event => { this.audio.srcObject = event.streams[0]; this.audio.play().catch(() => this.onError(new Error('El navegador bloqueó el audio. Revisa sus permisos de reproducción.'))); };
      this.media.getTracks().forEach(track => { track.enabled = false; this.pc.addTrack(track, this.media); });
      this.channel = this.pc.createDataChannel('oai-events');
      const channelReady = new Promise((resolve, reject) => {
        this.openTimer = setTimeout(() => reject(new Error('No se estableció la conexión de voz. Revisa la red y el acceso al modelo.')), 35000);
        this.channel.onopen = () => { clearTimeout(this.openTimer); resolve(); };
        this.channel.onerror = () => reject(new Error('Falló el canal de voz.'));
      });
      // Attach rejection immediately while SDP negotiation is in flight.
      channelReady.catch(() => {});
      this.channel.onmessage = event => {
        let data; try { data = JSON.parse(event.data); } catch { return; }
        if (data.type === 'response.created') this.responding = true;
        if (data.type === 'response.done') this.responding = false;
        this.events = this.events.then(() => this.handleEvent(data)).catch(e => this.onError(e));
      };
      this.channel.onclose = () => { if (this.phase === 'active') this.stop().catch(e => this.onError(e)); };
      this.pc.onconnectionstatechange = () => {
        if (this.pc?.connectionState === 'failed' && this.phase !== 'idle' && this.phase !== 'stopping') { this.onError(new Error('La conexión de audio se interrumpió.')); this.stop().catch(e => this.onError(e)); }
      };
      const offer = await this.pc.createOffer(); await this.pc.setLocalDescription(offer);
      const result = await this.rpc('/api/realtime/start', { sdp: this.pc.localDescription.sdp }); this.sessionId = result.sessionId;
      if (generation !== this.generation) { await this.rpc('/api/realtime/stop', { sessionId: result.sessionId }); return; }
      await this.pc.setRemoteDescription({ type: 'answer', sdp: result.sdp }); await channelReady;
      this.phase = 'active'; this.media.getTracks().forEach(track => track.enabled = true); this.onStatus('Voz activa · puedes hablar');
      this.durationTimer = setTimeout(() => { this.onStatus('Se alcanzaron 10 minutos. Cerrando voz…'); this.stop().catch(e => this.onError(e)); }, result.maxDurationSeconds * 1000);
      return result;
    } catch (e) { await this.stop().catch(closeError => this.onError(closeError)); throw e.name === 'NotAllowedError' ? new Error('Permite el micrófono en el navegador para conversar por voz.') : e; }
  }
  async transcript(role, itemId, text) {
    if (!text || !this.sessionId || this.seen.has(`${role}:${itemId}`)) return;
    this.seen.add(`${role}:${itemId}`);
    await this.rpc('/api/realtime/transcript', { sessionId: this.sessionId, role, itemId, content: text.slice(0, 12000) });
    this.onTranscript(role, text);
  }
  async handleEvent(event) {
    if (this.phase === 'idle' || this.phase === 'stopping') return;
    if (event.type === 'error') { this.onError(new Error(event.error?.message || 'OpenAI informó de un error de voz.')); return; }
    if (event.type === 'input_audio_buffer.speech_started') this.onStatus('Te escucho…');
    if (event.type === 'response.created') this.onStatus('JARVIS está respondiendo…');
    if (event.type === 'conversation.item.input_audio_transcription.completed') await this.transcript('user', event.item_id, event.transcript);
    if (['response.output_audio_transcript.done', 'response.audio_transcript.done'].includes(event.type)) await this.transcript('assistant', event.item_id, event.transcript);
    if (event.type !== 'response.done') return;
    const response = event.response || {}; this.tokens += response.usage?.total_tokens || 0; this.onUsage(this.tokens);
    if (response.status === 'failed') { this.onError(new Error(response.status_details?.error?.message || 'La respuesta de voz falló.')); return; }
    if (response.status === 'cancelled') return;
    const calls = (response.output || []).filter(x => x.type === 'function_call');
    for (const call of calls) {
      if (this.seen.has(`tool:${call.call_id}`)) continue;
      this.seen.add(`tool:${call.call_id}`);
      let result;
      try { result = await this.rpc('/api/realtime/tool', { sessionId: this.sessionId, callId: call.call_id, name: call.name, args: JSON.parse(call.arguments) }); }
      catch (e) { result = { error: e.message }; }
      await this.onTool(call.name, result);
      this.send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: call.call_id, output: JSON.stringify(result) } });
      this.followUp = true;
    }
    for (const item of response.output || []) if (item.type === 'message') {
      const text = (item.content || []).map(x => x.transcript || x.text || '').filter(Boolean).join('\n');
      if (text) await this.transcript('assistant', item.id, text);
    }
    if (this.followUp && !this.responding) { this.followUp = false; this.send({ type: 'response.create' }); }
    this.onStatus('Voz activa · puedes hablar');
  }
  async stop() {
    if (this.phase === 'stopping') return;
    this.phase = 'stopping'; ++this.generation;
    clearTimeout(this.openTimer); clearTimeout(this.durationTimer);
    this.media?.getTracks().forEach(track => track.stop()); this.channel?.close(); this.pc?.close();
    if (this.audio) { this.audio.pause(); this.audio.srcObject = null; this.audio.remove(); }
    this.media = null; this.channel = null; this.pc = null; this.audio = null;
    try { if (this.sessionId) await this.rpc('/api/realtime/stop', { sessionId: this.sessionId }); this.sessionId = null; }
    finally { this.phase = 'idle'; this.responding = false; this.followUp = false; this.onStatus(this.sessionId ? 'Cierre pendiente · pulsa Terminar voz' : 'Voz desconectada'); }
  }
}
