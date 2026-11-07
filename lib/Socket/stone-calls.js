import { EventEmitter } from 'node:events'
import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const STORE_PROVIDERS = Object.fromEntries([
  'auth', 'signal', 'preKey', 'session', 'identity', 'senderKey',
  'appState', 'privacyToken', 'messages', 'threads', 'contacts'
].map(name => [name, 'sqlite']))

const FORWARDED_EVENTS = {
  auth_qr: 'qr',
  auth_paired: 'paired',
  connection: 'connection',
  voip_call_incoming: 'incoming',
  voip_call_state: 'state',
  voip_call_ended: 'ended',
  voip_call_error: 'call-error',
  voip_call_outbound_audio_finished: 'audio-finished',
  voip_call_inbound_audio: 'inbound-audio',
  voip_call_participants_changed: 'participants-changed'
}

const nonempty = (value, field) => {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${field} precisa ser texto não vazio`)
  return value.trim()
}

const userJid = (value, field = 'JID') => {
  const jid = nonempty(value, field)
  if (!/^[^@\s]+@(s\.whatsapp\.net|lid|hosted|hosted\.lid)$/.test(jid)) {
    throw new TypeError(`${field} precisa ser JID de usuário válido`)
  }
  return jid
}

async function loadEngine() {
  try {
    const [base, sqlite, voip] = await Promise.all([
      import('zapo-js'),
      import('@zapo-js/store-sqlite'),
      import('@zapo-js/voip')
    ])
    return { ...base, ...sqlite, ...voip }
  } catch (error) {
    const failedImport = new Error('Módulo de chamadas não instalado. Instale as dependências opcionais de VoIP antes de conectar a sessão de chamadas.', { cause: error })
    failedImport.code = 'STONE_CALLS_DEPENDENCY_MISSING'
    throw failedImport
  }
}

/**
 * Recurso opcional de chamadas. A sessão de chamadas é um dispositivo vinculado
 * distinto: NÃO reutiliza os arquivos ou as chaves da sessão principal da Stone.
 */
export function createStoneCalls({ engineLoader = loadEngine } = {}) {
  const events = new EventEmitter()
  // Decoded inbound audio is opt-in and may generate many events per second.
  events.setMaxListeners(30)
  let client = null
  let connecting = null
  let disconnecting = false
  let handlers = []
  const pendingAudio = new Map()

  const voip = () => {
    if (!client?.voip) throw new Error('Conecte a sessão de chamadas com stone.calls.connect() antes de usar este recurso')
    return client.voip
  }

  const cancelPending = (reason) => {
    for (const [id, pending] of pendingAudio) {
      pending.reject(reason)
      pendingAudio.delete(id)
    }
  }

  const api = {
    on(event, handler) { events.on(event, handler); return api },
    off(event, handler) { events.off(event, handler); return api },
    once(event, handler) { events.once(event, handler); return api },

    /** Pareie uma segunda sessão de dispositivo para transportar chamadas. */
    async connect({ authPath, sessionId = 'stone-calls', maxConcurrentCalls = 1, logLevel = 'warn', autoAccept = false, driver = 'auto' } = {}) {
      if (client) return { connected: true, sessionId }
      if (connecting) return connecting
      const file = resolve(nonempty(authPath, 'authPath'))
      nonempty(sessionId, 'sessionId')
      if (!Number.isSafeInteger(maxConcurrentCalls) || maxConcurrentCalls < 1 || maxConcurrentCalls > 8) {
        throw new RangeError('maxConcurrentCalls deve ser de 1 a 8')
      }
      connecting = (async () => {
        const { createStore, createPinoLogger, WaClient, createSqliteStore, voipPlugin } = await engineLoader()
        await mkdir(dirname(file), { recursive: true })
        const store = createStore({
          backends: { sqlite: createSqliteStore({ path: file, driver }) },
          providers: { ...STORE_PROVIDERS }
        })
        const logger = await createPinoLogger({ level: logLevel, pretty: false })
        const nextClient = new WaClient({
          store,
          sessionId,
          connectTimeoutMs: 15000,
          deviceBrowser: 'Chrome',
          deviceOsDisplayName: 'Windows',
          plugins: [voipPlugin({ maxConcurrentCalls })]
        }, logger)
        const localHandlers = []
        for (const [sourceEvent, localEvent] of Object.entries(FORWARDED_EVENTS)) {
          const handler = (payload) => {
            events.emit(localEvent, payload)
            if (sourceEvent === 'voip_call_incoming' && autoAccept && payload?.canAccept) {
              Promise.resolve().then(() => nextClient.voip.acceptCall(payload.callId)).catch(err => events.emit('call-error', err))
            }
            if (sourceEvent === 'voip_call_ended' && payload?.callId) {
              pendingAudio.get(payload.callId)?.reject(new Error('A chamada terminou antes do início da reprodução'))
              pendingAudio.delete(payload.callId)
            }
            if (sourceEvent === 'connection' && ['closed', 'disconnected'].includes(payload?.status)) {
              cancelPending(new Error('A sessão de chamadas foi desconectada'))
            }
          }
          nextClient.on(sourceEvent, handler)
          localHandlers.push([sourceEvent, handler])
        }
        try {
          await nextClient.connect()
          client = nextClient
          handlers = localHandlers
          return { connected: true, sessionId }
        } catch (error) {
          for (const [event, handler] of localHandlers) nextClient.off?.(event, handler)
          await Promise.resolve(nextClient.disconnect?.()).catch(() => {})
          throw error
        }
      })().finally(() => { connecting = null })
      return connecting
    },

    /** Inicia chamada de voz ou vídeo para uma pessoa. */
    startCall(peerJid, { isVideo = false } = {}) {
      return voip().startCall({ peerJid: userJid(peerJid), isVideo: !!isVideo })
    },

    /** Inicia chamada em grupo convidando apenas os participantes indicados. */
    startGroupCall(groupJid, participants, { isVideo = false } = {}) {
      const group = nonempty(groupJid, 'groupJid')
      if (!/^[^@\s]+@g\.us$/.test(group)) throw new TypeError('JID do grupo inválido')
      if (!Array.isArray(participants) || participants.length < 1) {
        throw new TypeError('Informe pelo menos um participante para convidar')
      }
      const normalized = participants.map(value => {
        if (typeof value === 'string') return { jid: userJid(value, 'participante') }
        if (!value || typeof value !== 'object') throw new TypeError('Participante inválido')
        const jid = userJid(value.jid, 'participante')
        if (value.devices !== undefined && !Array.isArray(value.devices)) {
          throw new TypeError('devices deve ser lista de JIDs')
        }
        return { jid, ...(value.devices ? { devices: value.devices.map(d => userJid(d, 'device')) } : {}) }
      })
      return voip().startCall({ groupJid: group, participants: normalized, isVideo: !!isVideo })
    },

    acceptCall(callId) { return voip().acceptCall(nonempty(callId, 'callId')) },
    rejectCall(callId) { return voip().rejectCall(nonempty(callId, 'callId')) },
    /** Só funciona para ligação em grupo já conhecida por esta sessão. */
    joinCall(callId) { return voip().joinCall(nonempty(callId, 'callId')) },
    leaveCall(callId) { return voip().leaveCall(nonempty(callId, 'callId')) },
    endCall(callId) { return voip().endCall(nonempty(callId, 'callId')) },
    getCall(callId) { return voip().getCall(nonempty(callId, 'callId')) },
    getCalls() { return voip().getCalls() },
    setMute(callId, muted) { return voip().setMute(nonempty(callId, 'callId'), !!muted) },

    /** Carrega MP3/arquivo com FFmpeg quando a chamada ficar ativa. */
    async playAudio(callId, path, { timeoutMs = 60000 } = {}) {
      const id = nonempty(callId, 'callId')
      const audioPath = nonempty(path, 'caminho do áudio')
      const engine = voip()
      const call = engine.getCall(id)
      if (!call) throw new Error('Chamada não conhecida pela sessão de VoIP')
      if (call.stateData?.state === 'ended') throw new Error('A chamada já foi encerrada')
      if (call.stateData?.state === 'active') return engine.loadAudio(id, audioPath)
      if (pendingAudio.has(id)) throw new Error('Já existe uma reprodução aguardando esta chamada')
      if (!Number.isFinite(timeoutMs) || timeoutMs < 100) throw new RangeError('timeoutMs inválido')
      return new Promise((resolve, reject) => {
        let timer
        const cleanup = () => {
          clearTimeout(timer)
          events.off('state', onState)
          pendingAudio.delete(id)
        }
        const fail = error => { cleanup(); reject(error) }
        const onState = state => {
          if (state?.callId !== id) return
          if (state.stateData?.state === 'ended') return fail(new Error('Chamada encerrada antes da reprodução'))
          if (state.stateData?.state === 'active') {
            cleanup()
            Promise.resolve().then(() => engine.loadAudio(id, audioPath)).then(resolve, reject)
          }
        }
        events.on('state', onState)
        timer = setTimeout(() => fail(new Error('Tempo esgotado aguardando a chamada ficar ativa')), timeoutMs)
        pendingAudio.set(id, { reject: fail })
        // Handles a call becoming active in between getCall and adding the listener.
        onState(engine.getCall(id))
      })
    },

    /** PCM Float32Array, 16 kHz, mono. Para áudio ao vivo, ative o modo externo. */
    setExternalAudioMode(callId, enabled = true) {
      return voip().setExternalAudioMode(nonempty(callId, 'callId'), !!enabled)
    },
    feedLiveAudio(callId, pcmChunk) {
      if (!(pcmChunk instanceof Float32Array)) throw new TypeError('PCM precisa ser Float32Array, mono 16 kHz')
      return voip().feedLiveAudio(nonempty(callId, 'callId'), pcmChunk)
    },
    getLiveBufferMs(callId) { return voip().getLiveBufferMs(nonempty(callId, 'callId')) },
    getFeedWatermarksMs() { return voip().getFeedWatermarksMs() },

    /** Desconecta apenas o dispositivo de chamadas. A Stone principal continua online. */
    async disconnect() {
      if (connecting) await connecting.catch(() => {})
      if (!client || disconnecting) return
      disconnecting = true
      const current = client
      client = null
      cancelPending(new Error('A sessão de chamadas foi desconectada'))
      for (const [event, handler] of handlers) current.off?.(event, handler)
      handlers = []
      try { await current.disconnect() } finally { disconnecting = false }
    }
  }
  return api
}
