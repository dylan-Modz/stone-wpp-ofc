import { EventEmitter } from 'node:events'
import { buildGroupCallRejectStanza } from './stone-call-signaling.js'
import { createStoneVoipBridge } from './stone-voip-bridge.js'

const ENDED_STATES = new Set(['reject', 'terminate', 'timeout'])
const CALL_STATES = Object.freeze({
  offer: 'incoming_ringing',
  accept: 'signaled',
  reject: 'ended',
  terminate: 'ended',
  timeout: 'ended'
})

const requiredText = (value, label) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`Informe ${label} válido`)
  }
  return value.trim()
}

/**
 * Gerenciamento de eventos e operações de chamada já suportadas pelo socket
 * nativo da Stone. Usa a MESMA conexão e credenciais do bot.
 *
 * Este gerenciador não cria uma sessão VoIP nem implementa codificação,
 * criptografia SRTP ou transporte da mídia de chamadas.
 */
export function createStoneCalls(socket) {
  if (!socket?.ev || typeof socket.ev.on !== 'function' ||
      typeof socket.ev.off !== 'function' ||
      typeof socket.rejectCall !== 'function' ||
      typeof socket.createCallLink !== 'function') {
    throw new TypeError('É necessário um socket Stone com eventos e operações de chamadas')
  }

  const emitter = new EventEmitter()
  const tracked = new Map()
  const MAX_TRACKED_CALLS = 128
  let destroyed = false
  let bridge = null
  let initializing = null
  let lastVoipError = null

  const assertReady = () => {
    if (destroyed) throw new Error('Gerenciador de chamadas encerrado')
  }

  const mediaUnavailable = (method) => {
    assertReady()
    const error = new Error(
      `stone.calls.${method} ainda não está disponível no motor nativo. ` +
      'A Stone já detecta chamadas e envia convites, mas atender, iniciar, ' +
      'entrar em chamadas ou transmitir mídia exigem sinalização e transporte VoIP completos.'
    )
    error.code = 'STONE_CALL_MEDIA_NOT_IMPLEMENTED'
    throw error
  }

  const onCall = (incoming) => {
    if (destroyed || bridge) return
    const batch = Array.isArray(incoming) ? incoming : [incoming]
    for (const call of batch) {
      if (!call?.id || typeof call.id !== 'string') continue

      const previous = tracked.get(call.id)
      const status = String(call.status || 'unknown')
      const known = {
        ...previous,
        callId: call.id,
        id: call.id,
        chatId: call.chatId ?? previous?.chatId ?? null,
        peerJid: call.from ?? previous?.peerJid ?? null,
        from: call.from ?? previous?.from ?? null,
        groupJid: call.groupJid ?? previous?.groupJid ?? null,
        callerPn: call.callerPn ?? previous?.callerPn ?? null,
        callCreator: call.callCreator ?? previous?.callCreator ?? null,
        sourceJid: call.sourceJid ?? previous?.sourceJid ?? null,
        stanzaId: call.stanzaId ?? previous?.stanzaId ?? null,
        joinable: call.joinable ?? previous?.joinable ?? false,
        reRing: call.reRing ?? false,
        latencyMs: call.latencyMs ?? previous?.latencyMs ?? null,
        isGroupCall: Boolean(call.isGroup ?? previous?.isGroupCall),
        isVideo: Boolean(call.isVideo ?? previous?.isVideo),
        status,
        date: call.date ?? previous?.date ?? new Date(),
        stateData: {
          state: CALL_STATES[status] ?? previous?.stateData?.state ?? 'unknown',
          ...(ENDED_STATES.has(status) ? { endReason: status } : {})
        }
      }

      tracked.delete(call.id)
      tracked.set(call.id, known)
      if (tracked.size > MAX_TRACKED_CALLS) {
        tracked.delete(tracked.keys().next().value)
      }

      const snapshot = { ...known, stateData: { ...known.stateData } }
      emitter.emit('state', snapshot)
      if (status === 'offer') emitter.emit('incoming', snapshot)
      if (ENDED_STATES.has(status)) emitter.emit('ended', snapshot)
    }
  }

  socket.ev.on('call', onCall)

  const voipState = call => {
    if (destroyed || !call?.callId) return
    const state = String(call.stateData?.state || 'unknown')
    const previous = tracked.get(call.callId)
    const safe = {
      ...previous,
      id: call.callId, callId: call.callId,
      from: call.peerJid || previous?.from || null,
      peerJid: call.peerJid || previous?.peerJid || null,
      callCreator: call.callCreator || previous?.callCreator || null,
      groupJid: call.groupJid || previous?.groupJid || null,
      isGroupCall: Boolean(call.isGroupCall),
      isVideo: call.mediaType === 'video',
      date: call.createdAt || previous?.date || new Date(),
      status: state,
      stateData: {
        state,
        ...(call.stateData?.endReason ? { endReason: call.stateData.endReason } : {})
      }
    }
    tracked.delete(call.callId)
    tracked.set(call.callId, safe)
    if (tracked.size > MAX_TRACKED_CALLS) tracked.delete(tracked.keys().next().value)
    const value = { ...safe, stateData: { ...safe.stateData } }
    emitter.emit('state', value)
    if (state === 'incoming_ringing') emitter.emit('incoming', value)
    if (state === 'ended') emitter.emit('ended', value)
  }

  const onConnection = ({ connection } = {}) => {
    if (connection === 'open' && process.env.STONE_VOIP_ENABLED === '1') {
      void api.enableVoip().catch(error => {
        lastVoipError = error
        socket.ev.emit('stone.voip.error', { code: error.code || 'STONE_VOIP_FAILED', message: error.message })
      })
    }
  }
  socket.ev.on('connection.update', onConnection)

  const api = {
    on(event, handler) { assertReady(); emitter.on(event, handler); return api },
    once(event, handler) { assertReady(); emitter.once(event, handler); return api },
    off(event, handler) { emitter.off(event, handler); return api },

    /** Inicializa a camada VoIP experimental na MESMA conexão Stone. */
    async enableVoip(options = {}) {
      assertReady()
      if (bridge) return api.getCapabilities()
      if (initializing) return initializing
      initializing = (async () => {
        const candidate = await createStoneVoipBridge(socket, options)
        if (destroyed) { await candidate.dispose(); throw new Error('Socket encerrado antes do VoIP iniciar') }
        bridge = candidate
        candidate.events.on('voip_call_state', voipState)
        candidate.events.on('voip_call_incoming', voipState)
        candidate.events.on('voip_call_ended', voipState)
        candidate.events.on('voip_call_error', error => {
          lastVoipError = error
          socket.ev.emit('stone.voip.error', { code: error?.code || 'STONE_VOIP_ERROR', message: error?.message || String(error) })
        })
        lastVoipError = null
        return api.getCapabilities()
      })().catch(error => {
        lastVoipError = error
        throw error
      }).finally(() => { initializing = null })
      return initializing
    },

    getVoipStatus() {
      return { initialized: Boolean(bridge), initializing: Boolean(initializing),
        error: lastVoipError ? { code: lastVoipError.code || 'STONE_VOIP_ERROR', message: lastVoipError.message } : null }
    },

    /** Disponibilidade explícita de recursos, sem anunciar chamadas inexistentes. */
    getCapabilities() {
      return Object.freeze({
        sharedSocket: true,
        incomingEvents: true,
        rejectIncomingCall: true,
        groupCallReject: typeof socket.sendNode === 'function',
        incomingMetadata: true,
        callLinks: true,
        groupCallInvites: typeof socket.sendGroupCallInvite === 'function',
        startCall: Boolean(bridge),
        acceptCall: Boolean(bridge),
        joinCall: Boolean(bridge),
        liveAudio: Boolean(bridge),
        audioFiles: Boolean(bridge),
        videoMedia: Boolean(bridge)
      })
    },

    getCall(callId) {
      assertReady()
      const id = requiredText(callId, 'callId')
      const value = tracked.get(id)
      return value ? { ...value, stateData: { ...value.stateData } } : null
    },

    getCalls() {
      assertReady()
      return [...tracked.values()].map(value => ({
        ...value, stateData: { ...value.stateData }
      }))
    },

    /** Recusa uma oferta que o socket recebeu e ainda reconhece. */
    async rejectCall(callId) {
      assertReady()
      const id = requiredText(callId, 'callId')
      const call = tracked.get(id)
      if (bridge) return bridge.coordinator.rejectCall(id)
      if (!call || call.status !== 'offer' || !call.from) {
        throw new Error('Chamada recebida não encontrada ou não disponível para recusa')
      }
      if (call.isGroupCall) {
        if (typeof socket.sendNode !== 'function') {
          throw new Error('Envio de sinalização para chamadas em grupo indisponível')
        }
        await socket.sendNode(buildGroupCallRejectStanza(id, call.callCreator || call.from))
      } else {
        await socket.rejectCall(id, call.from)
      }
      onCall([{ id, status: 'reject', from: call.from }])
    },

    async createCallLink(type = 'audio', event, timeoutMs) {
      assertReady()
      if (type !== 'audio' && type !== 'video') {
        throw new TypeError('O tipo de chamada deve ser audio ou video')
      }
      return socket.createCallLink(type, event, timeoutMs)
    },

    async sendGroupCallInvite(groupJid, options = {}) {
      assertReady()
      if (typeof socket.sendGroupCallInvite !== 'function') {
        throw new Error('O envio de convites não está disponível neste socket')
      }
      return socket.sendGroupCallInvite(groupJid, options)
    },

    startCall(options) { return bridge ? bridge.coordinator.startCall(options) : mediaUnavailable('startCall') },
    startGroupCall(options) {
      return bridge ? bridge.coordinator.startCall(options) : mediaUnavailable('startGroupCall')
    },
    acceptCall(id) { return bridge ? bridge.coordinator.acceptCall(id) : mediaUnavailable('acceptCall') },
    joinCall(id) { return bridge ? bridge.coordinator.joinCall(id) : mediaUnavailable('joinCall') },
    leaveCall(id) { return bridge ? bridge.coordinator.leaveCall(id) : mediaUnavailable('leaveCall') },
    endCall(id) { return bridge ? bridge.coordinator.endCall(id) : mediaUnavailable('endCall') },
    loadAudio(id, file) { return bridge ? bridge.coordinator.loadAudio(id, file) : mediaUnavailable('loadAudio') },
    playAudio() { return mediaUnavailable('playAudio') },
    setExternalAudioMode(id, flag) { return bridge ? bridge.coordinator.setExternalAudioMode(id, flag) : mediaUnavailable('setExternalAudioMode') },
    feedLiveAudio(id, chunk) { return bridge ? bridge.coordinator.feedLiveAudio(id, chunk) : mediaUnavailable('feedLiveAudio') },
    getLiveBufferMs(id) { return bridge ? bridge.coordinator.getLiveBufferMs(id) : mediaUnavailable('getLiveBufferMs') },
    getFeedWatermarksMs(id) { return bridge ? bridge.coordinator.getFeedWatermarksMs(id) : mediaUnavailable('getFeedWatermarksMs') },
    setMute(id, flag) { return bridge ? bridge.coordinator.setMute(id, flag) : mediaUnavailable('setMute') },

    /** Remove os listeners desta API sem encerrar a conexão principal. */
    destroy() {
      if (destroyed) return
      destroyed = true
      socket.ev.off('call', onCall)
      socket.ev.off('connection.update', onConnection)
      if (bridge) void bridge.dispose().catch(() => {})
      emitter.removeAllListeners()
      tracked.clear()
    }
  }

  return api
}
