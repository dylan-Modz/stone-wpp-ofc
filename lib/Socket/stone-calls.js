import { EventEmitter } from 'node:events'

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
    if (destroyed) return
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

  const api = {
    on(event, handler) { assertReady(); emitter.on(event, handler); return api },
    once(event, handler) { assertReady(); emitter.once(event, handler); return api },
    off(event, handler) { emitter.off(event, handler); return api },

    /** Disponibilidade explícita de recursos, sem anunciar chamadas inexistentes. */
    getCapabilities() {
      return Object.freeze({
        sharedSocket: true,
        incomingEvents: true,
        rejectIncomingCall: true,
        callLinks: true,
        groupCallInvites: typeof socket.sendGroupCallInvite === 'function',
        startCall: false,
        acceptCall: false,
        joinCall: false,
        liveAudio: false,
        audioFiles: false,
        videoMedia: false
      })
    },

    getCall(callId) {
      assertReady()
      const value = tracked.get(requiredText(callId, 'callId'))
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
      if (!call || call.status !== 'offer' || !call.from) {
        throw new Error('Chamada recebida não encontrada ou não disponível para recusa')
      }
      await socket.rejectCall(id, call.from)
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

    startCall() { return mediaUnavailable('startCall') },
    startGroupCall() { return mediaUnavailable('startGroupCall') },
    acceptCall() { return mediaUnavailable('acceptCall') },
    joinCall() { return mediaUnavailable('joinCall') },
    leaveCall() { return mediaUnavailable('leaveCall') },
    endCall() { return mediaUnavailable('endCall') },
    loadAudio() { return mediaUnavailable('loadAudio') },
    playAudio() { return mediaUnavailable('playAudio') },
    setExternalAudioMode() { return mediaUnavailable('setExternalAudioMode') },
    feedLiveAudio() { return mediaUnavailable('feedLiveAudio') },
    getLiveBufferMs() { return mediaUnavailable('getLiveBufferMs') },
    getFeedWatermarksMs() { return mediaUnavailable('getFeedWatermarksMs') },
    setMute() { return mediaUnavailable('setMute') },

    /** Remove os listeners desta API sem encerrar a conexão principal. */
    destroy() {
      if (destroyed) return
      destroyed = true
      socket.ev.off('call', onCall)
      emitter.removeAllListeners()
      tracked.clear()
    }
  }

  return api
}
