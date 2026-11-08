import { EventEmitter } from 'node:events'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { dirname, delimiter } from 'node:path'
import pino from 'pino'

const require = createRequire(import.meta.url)

function jidFromAddress(address) {
  if (!address || typeof address.user !== 'string' || typeof address.server !== 'string') {
    throw new TypeError('Endereço Signal de chamada inválido')
  }
  const device = Number(address.device || 0)
  if (!Number.isSafeInteger(device) || device < 0) throw new TypeError('Dispositivo Signal inválido')
  return address.user + (device ? ':' + device : '') + '@' + address.server
}
function addressFromJid(jid) {
  if (typeof jid !== 'string') throw new TypeError('JID esperado')
  const m = /^([^:@\s]+)(?::(\d+))?@([^@\s]+)$/.exec(jid)
  if (!m) throw new TypeError('JID Signal inválido')
  return { user: m[1], device: Number(m[2] || 0), server: m[3] }
}
function normalizeError(error, code) {
  const next = new Error(error?.message || String(error))
  next.code = code
  next.cause = error
  return next
}

/**
 * Adaptador experimental do motor MIT de chamadas para o socket ORIGINAL
 * Stone WPP. Não cria outro WaClient, socket WhatsApp ou sessão de login.
 *
 * É indispensável ter os componentes de codec/relay instalados no host.
 * A ativação NÃO significa que uma chamada passou por testes ponta-a-ponta.
 */
export async function createStoneVoipBridge(socket, options = {}) {
  if (!socket?.ws?.on || !socket?.sendNode || !socket?.signalRepository ||
      !socket?.authState?.creds || !socket?.assertSessions ||
      !socket?.getUSyncDevices) {
    throw new TypeError('Socket Stone sem as primitivas necessárias para VoIP')
  }

  let voipPlugin
  try {
    ;({ voipPlugin } = await import('@zapo-js/voip'))
  } catch (error) {
    throw normalizeError(error, 'STONE_VOIP_RUNTIME_MISSING')
  }
  if (typeof voipPlugin !== 'function') {
    throw new Error('Módulo VoIP instalado não exporta voipPlugin')
  }
  try {
    require.resolve('libmlow-wasm-fork')
  } catch (error) {
    throw normalizeError(error, 'STONE_VOIP_CODEC_MISSING')
  }
  if (options.useRawUdpTransport !== true) {
    try { require.resolve('@roamhq/wrtc') }
    catch (error) { throw normalizeError(error, 'STONE_VOIP_WEBRTC_MISSING') }
  }

  const logger = options.logger || pino({ level: process.env.STONE_VOIP_LOG_LEVEL || 'warn' })
  const signal = socket.signalRepository
  const hostEvents = new EventEmitter()
  const disposeHandlers = []
  const creds = () => socket.authState.creds
  const getCurrentCredentials = () => ({
    meJid: creds().me?.id || '',
    meLid: creds().me?.lid || '',
    signedIdentity: creds().account || null
  })
  const syncDeviceList = async (accounts) => Promise.all(accounts.map(async jid => {
    const devices = await socket.getUSyncDevices([jid], true, false)
    const deviceJids = [...new Set(devices.map(x => x.jid).filter(Boolean))]
    return { jid, deviceJids }
  }))

  const deps = {
    authClient: { getCurrentCredentials },
    isMobilePrimary: () => false,
    lowLevelCoordinator: {
      sendNode: node => socket.sendNode(node),
      query: (node, timeoutMs) => socket.query(node, timeoutMs)
    },
    signalDeviceSync: {
      syncDeviceList,
      queryLidsByPhoneJids: async jids => Promise.all(jids.map(async pnJid => {
        const lidJid = await signal.lidMapping?.getLIDForPN?.(pnJid)
        return { pnJid, lidJid: lidJid || null }
      }))
    },
    sessionResolver: {
      ensureSessionsBatch: async jids => {
        await socket.assertSessions(jids)
        return jids.map(jid => ({ address: addressFromJid(jid), session: null }))
      }
    },
    signalProtocol: {
      decryptMessage: async (address, { type, ciphertext }) =>
        signal.decryptMessage({ jid: jidFromAddress(address), type, ciphertext }),
      encryptMessagesBatch: async messages => {
        const encrypted = []
        for (const { address, plaintext } of messages) {
          encrypted.push(await signal.encryptMessage({
            jid: jidFromAddress(address),
            data: Buffer.from(plaintext)
          }))
        }
        return encrypted
      }
    },
    messageDispatch: {
      syncSignalSession: jid => socket.assertSessions([jid])
    }
  }
  const stores = {
    privacyToken: {
      getByJid: async jid => {
        const entry = (await socket.authState.keys.get('tctoken', [jid]))?.[jid]
        return entry?.token ? { tcToken: entry.token } : null
      }
    }
  }

  const registerIncomingHandler = ({ tag, handler, prepend = false }) => {
    const event = tag === 'call' ? 'CB:call' : tag === 'ack' ? 'CB:ack,class:call' :
      tag === 'receipt' ? 'CB:receipt' : null
    if (!event || typeof handler !== 'function') throw new TypeError('Handler de chamada inválido')
    const receive = node => {
      Promise.resolve().then(() => handler(node)).catch(error => {
        hostEvents.emit('voip_call_error', error)
        logger.warn({ err: error, tag }, 'falha no handler VoIP')
      })
    }
    if (prepend && typeof socket.ws.prependListener === 'function') {
      socket.ws.prependListener(event, receive)
    } else socket.ws.on(event, receive)
    const off = () => socket.ws.off(event, receive)
    disposeHandlers.push(off)
    return off
  }

  const context = {
    client: hostEvents,
    options: Object.freeze({}),
    logger,
    deps,
    stores,
    emit: hostEvents.emit.bind(hostEvents),
    on: hostEvents.on.bind(hostEvents),
    off: hostEvents.off.bind(hostEvents),
    once: hostEvents.once.bind(hostEvents),
    queryWithContext: (_context, node, timeoutMs) => socket.query(node, timeoutMs),
    registerIncomingHandler,
    registerIncomingStanzaFilter: () => () => {},
    registerDispose: fn => disposeHandlers.push(fn)
  }
  let plugin, coordinator
  try {
    plugin = voipPlugin({
      maxConcurrentCalls: options.maxConcurrentCalls || 1,
      useRawUdpTransport: options.useRawUdpTransport === true,
      logLevel: options.logLevel || 'warn'
    })
    coordinator = plugin.setup(context)
    socket.ws._stoneVoipActive = true
  } catch (error) {
    for (const off of disposeHandlers.splice(0)) {
      try { off() } catch {}
    }
    throw normalizeError(error, 'STONE_VOIP_INITIALIZATION_FAILED')
  }
  let disposed = false
  const dispose = async () => {
    if (disposed) return
    disposed = true
    socket.ws._stoneVoipActive = false
    for (const off of disposeHandlers.splice(0)) {
      try { await off() } catch {}
    }
    try {
      if (typeof plugin.dispose === 'function') await plugin.dispose(coordinator, context)
      else coordinator?.dispose?.()
    } finally {
      hostEvents.removeAllListeners()
    }
  }

  let audioFilesAvailable = false
  for (const candidate of [options.ffmpegPath || process.env.FFMPEG_PATH || 'ffmpeg', (() => {
    try { return require('ffmpeg-static') } catch { return null }
  })()]) {
    if (!candidate) continue
    try {
      if (spawnSync(candidate, ['-version'], { stdio: 'ignore', timeout: 4000 }).status === 0) {
        audioFilesAvailable = true
        if (candidate !== 'ffmpeg') process.env.PATH = dirname(candidate) + delimiter + process.env.PATH
        break
      }
    } catch {}
  }
  return { coordinator, events: hostEvents, dispose, audioFilesAvailable }
}
