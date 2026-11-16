import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '../lib/index.js'
import { createWebhookService } from './webhooks.js'

const ID = /^[a-zA-Z0-9_-]{1,40}$/
const PHONE = /^\d{10,15}$/
const PERMANENT = new Set([
  DisconnectReason.loggedOut,
  DisconnectReason.badSession,
  DisconnectReason.connectionReplaced,
  DisconnectReason.multideviceMismatch,
  DisconnectReason.forbidden
])

function fail(message, status = 400) { throw Object.assign(new Error(message), { status }) }
const serial = value => String(value || '')
const reasonText = code => ({
  [DisconnectReason.restartRequired]: 'O WhatsApp solicitou reinício da conexão após o pareamento.',
  [DisconnectReason.loggedOut]: 'A conta foi desvinculada do WhatsApp. Vincule-a novamente.',
  [DisconnectReason.connectionReplaced]: 'Outra conexão assumiu esta sessão. Encerre o outro processo.',
  [DisconnectReason.badSession]: 'A autenticação da sessão foi recusada. Revise o vínculo antes de tentar novamente.',
  [DisconnectReason.forbidden]: 'A conexão foi recusada pelo WhatsApp.',
  [DisconnectReason.multideviceMismatch]: 'A conta não aceitou esta modalidade de dispositivo.',
  [DisconnectReason.connectionLost]: 'A comunicação com o WhatsApp foi interrompida.',
  [DisconnectReason.connectionClosed]: 'O socket do WhatsApp foi encerrado.',
  [DisconnectReason.unavailableService]: 'O serviço do WhatsApp está temporariamente indisponível.'
})[code] || 'A conexão foi encerrada antes de ficar disponível.'

async function acquireLock(dataDir) {
  const file = path.join(dataDir, '.gateway.lock')
  const marker = String(process.pid) + ':' + randomUUID()
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const handle = await fs.open(file, 'wx', 0o600)
      try { await handle.writeFile(marker) } finally { await handle.close() }
      return async () => {
        try {
          if ((await fs.readFile(file, 'utf8')) === marker) await fs.unlink(file)
        } catch (error) {
          if (error.code !== 'ENOENT') throw error
        }
      }
    } catch (error) {
      if (error.code !== 'EEXIST') throw error
      const content = await fs.readFile(file, 'utf8').catch(() => '')
      const pid = Number.parseInt(content.split(':')[0], 10)
      // Never remove a lock belonging to a live process, even if it uses another port.
      if (pid > 0) {
        try { process.kill(pid, 0); fail('gateway_data_directory_in_use', 409) }
        catch (checkError) {
          if (checkError.message === 'gateway_data_directory_in_use' || checkError.code === 'EPERM') throw checkError
          if (checkError.code !== 'ESRCH') throw checkError
        }
      }
      await fs.unlink(file).catch(error => { if (error.code !== 'ENOENT') throw error })
    }
  }
  fail('gateway_data_directory_in_use', 409)
}

export async function createSessionManager({
  dataDir = path.resolve('.stone-gateway'), logger = console,
  socketFactory = makeWASocket, authFactory = useMultiFileAuthState, qrEncoder,
  reconnectDelayMs = (attempt, code) => code === DisconnectReason.restartRequired ? 600 : Math.min(30000, 1000 * 2 ** (attempt - 1)),
  connectionTimeoutMs = 60000, maxReconnectAttempts = 6
} = {}) {
  if (connectionTimeoutMs < 1 || maxReconnectAttempts < 0) throw new Error('invalid_gateway_reconnect_options')
  await fs.mkdir(dataDir, { recursive: true, mode: 0o700 })
  const releaseLock = await acquireLock(dataDir)
  let stopped = false
  const sessions = new Map()
  const maxSessions = 10
  let webhooks
  try {
    await fs.mkdir(path.join(dataDir, 'sessions'), { recursive: true, mode: 0o700 })
    webhooks = await createWebhookService(dataDir, { logger })
  } catch (error) {
    await releaseLock()
    throw error
  }
  const safe = id => {
    if (typeof id !== 'string' || !ID.test(id)) fail('invalid_session_id')
    return id
  }
  const blockedMarker = id => path.join(dataDir, 'sessions', id, '.stone-relink-required.json')
  function record(session, status) {
    session.status = status
    session.updatedAt = new Date().toISOString()
  }
  function summary(session) {
    return {
      id: session.id, status: session.status, user: session.user,
      received: session.received, sent: session.sent, updatedAt: session.updatedAt,
      lastError: session.lastError || null,
      disconnectCode: session.disconnectCode || null,
      reconnectAttempts: session.reconnectAttempts,
      nextRetryAt: session.nextRetryAt || null
    }
  }
  function clearTimers(session) {
    if (session.retryTimer) clearTimeout(session.retryTimer)
    if (session.connectTimer) clearTimeout(session.connectTimer)
    session.retryTimer = null
    session.connectTimer = null
    session.nextRetryAt = null
  }
  function notify(session, state) {
    webhooks.emit('connection.update', {
      sessionId: session.id, connection: state, status: session.status,
      user: session.user, disconnectCode: session.disconnectCode
    })
  }
  function scheduleReconnect(session, code, reason) {
    if (stopped || sessions.get(session.id) !== session) return
    if (session.retryTimer) return
    session.disconnectCode = Number.isFinite(code) ? code : null
    session.lastError = reason || reasonText(code)
    if (PERMANENT.has(code)) {
      record(session, 'error')
      if (code === DisconnectReason.loggedOut) {
        // Credentials were rejected: don't auto-restore them on every reboot.
        // Preserve all files for diagnosis or manual re-pairing.
        void fs.writeFile(blockedMarker(session.id), JSON.stringify({
          disconnectCode: code, failedAt: new Date().toISOString()
        }), { mode: 0o600 }).catch(() => logger.warn?.('[stone-gateway] Não foi possível registrar sessão desvinculada: ' + session.id))
        logger.warn?.('[stone-gateway] Sessão ' + session.id + ' desvinculada (401); pareamento necessário. Não será restaurada automaticamente.')
      }
      notify(session, 'close')
      return
    }
    if (session.reconnectAttempts >= maxReconnectAttempts) {
      session.lastError = 'A conexão não foi concluída após várias tentativas. Verifique rede, pareamento e logs do Gateway.'
      record(session, 'error')
      notify(session, 'close')
      return
    }
    session.reconnectAttempts++
    const delay = Math.max(1, Number(reconnectDelayMs(session.reconnectAttempts, code)) || 600)
    session.nextRetryAt = new Date(Date.now() + delay).toISOString()
    record(session, 'reconnecting')
    logger.warn?.('[stone-gateway] Reconexão agendada para ' + session.id + ' (' + serial(code || 'sem código') + ', tentativa ' + session.reconnectAttempts + ')')
    notify(session, 'reconnecting')
    session.retryTimer = setTimeout(async () => {
      session.retryTimer = null
      session.nextRetryAt = null
      if (stopped || sessions.get(session.id) !== session) return
      try { await spawn(session) }
      catch {
        scheduleReconnect(session, DisconnectReason.connectionClosed, 'Não foi possível reiniciar o socket da sessão.')
      }
    }, delay)
  }
  async function spawn(session) {
    if (stopped) return
    clearTimers(session)
    session.qr = null
    session.pairingCode = null
    record(session, 'connecting')
    // Keep the same in-memory auth state across a pairing-required socket restart.
    // It already contains the signed account produced by the pair-success event.
    const socket = socketFactory({ auth: session.authState, printQRInTerminal: false })
    session.socket = socket
    socket.ev.on('creds.update', () => {
      void Promise.resolve().then(session.saveCreds).catch(() => {
        logger.warn?.('[stone-gateway] Falha ao salvar credenciais da sessão ' + session.id)
      })
    })
    socket.ev.on('connection.update', update => {
      if (stopped || sessions.get(session.id) !== session || session.socket !== socket) return
      if (update.qr) {
        session.qr = update.qr
        session.pairingCode = null
        record(session, 'waiting_pairing')
      }
      if (update.isNewLogin) {
        session.qr = null
        record(session, 'pairing')
        session.lastError = null
      }
      if (update.connection === 'open') {
        clearTimers(session)
        session.qr = null
        session.pairingCode = null
        session.user = socket.user?.id || null
        session.lastError = null
        session.disconnectCode = null
        session.reconnectAttempts = 0
        void fs.unlink(blockedMarker(session.id)).catch(error => {
          if (error.code !== 'ENOENT') logger.warn?.('[stone-gateway] Não foi possível limpar marca da sessão ' + session.id)
        })
        record(session, 'open')
      } else if (update.connection === 'close') {
        if (session.connectTimer) clearTimeout(session.connectTimer)
        session.connectTimer = null
        session.qr = null
        const error = update.lastDisconnect?.error
        const code = Number(error?.output?.statusCode ?? error?.statusCode)
        session.socket = null
        scheduleReconnect(session, code, reasonText(code))
        return
      } else if (update.connection === 'connecting' && session.status !== 'pairing' && session.status !== 'waiting_pairing') {
        record(session, 'connecting')
      }
      notify(session, update.connection || session.status)
    })
    socket.ev.on('messages.upsert', update => {
      if (session.socket !== socket) return
      const messages = (update.messages || []).slice(0, 20)
      session.received += (update.messages || []).filter(m => !m.key?.fromMe).length
      webhooks.emit('messages.upsert', {
        sessionId: session.id, type: update.type,
        messages: messages.map(m => ({
          id: m.key?.id, chatId: m.key?.remoteJid, fromMe: Boolean(m.key?.fromMe),
          text: String(m.message?.conversation || m.message?.extendedTextMessage?.text || '').slice(0, 4096)
        }))
      })
    })
    socket.ev.on('groups.update', items => {
      if (session.socket === socket) webhooks.emit('groups.update', { sessionId: session.id, groups: (Array.isArray(items) ? items : [items]).slice(0, 30) })
    })
    socket.ev.on('call', calls => {
      if (session.socket === socket) webhooks.emit('call', { sessionId: session.id, calls: (Array.isArray(calls) ? calls : [calls]).slice(0, 10) })
    })
    session.connectTimer = setTimeout(() => {
      if (stopped || sessions.get(session.id) !== session || session.socket !== socket || session.status === 'open') return
      session.socket = null
      session.qr = null
      scheduleReconnect(session, DisconnectReason.timedOut, 'Tempo limite de conexão excedido. Confira a internet e a etapa de pareamento.')
      void Promise.resolve().then(() => socket.end?.(new Error('Stone Gateway connection timeout'))).catch(() => {})
    }, connectionTimeoutMs)
  }
  async function start(id) {
    safe(id)
    if (stopped) fail('gateway_stopping', 503)
    let session = sessions.get(id)
    if (session) {
      if (!['close', 'error'].includes(session.status)) fail('session_already_running', 409)
      clearTimers(session)
      const oldSocket = session.socket
      session.socket = null
      if (oldSocket) {
        try { await oldSocket.end?.(new Error('Stone Gateway reconnect')) }
        catch { /* already closed */ }
      }
      session.reconnectAttempts = 0
      session.lastError = null
      session.disconnectCode = null
      try { await spawn(session) }
      catch (error) {
        record(session, 'error')
        session.lastError = 'Não foi possível iniciar o socket desta sessão.'
        throw error
      }
      return summary(session)
    }
    if (sessions.size >= maxSessions) fail('session_limit_reached', 409)
    const dir = path.join(dataDir, 'sessions', id)
    await fs.mkdir(dir, { recursive: true, mode: 0o700 })
    // An explicit POST /v1/sessions is a manual retry, even for a marked session.
    await fs.unlink(blockedMarker(id)).catch(error => { if (error.code !== 'ENOENT') throw error })
    const { state, saveCreds } = await authFactory(dir)
    session = {
      id, authState: state, saveCreds,
      status: 'connecting', user: null, received: 0, sent: 0,
      qr: null, pairingCode: null, socket: null, updatedAt: new Date().toISOString(),
      lastError: null, disconnectCode: null, reconnectAttempts: 0,
      nextRetryAt: null, retryTimer: null, connectTimer: null
    }
    sessions.set(id, session)
    try { await spawn(session) }
    catch (error) {
      sessions.delete(id)
      clearTimers(session)
      throw error
    }
    return summary(session)
  }
  function list() { return [...sessions.values()].map(summary).sort((a, b) => a.id.localeCompare(b.id)) }
  async function get(id) {
    const session = sessions.get(safe(id))
    if (!session) fail('session_not_found', 404)
    let qrImage = null
    if (session.qr) {
      try {
        if (qrEncoder) qrImage = await qrEncoder(session.qr)
        else {
          const { default: QRCode } = await import('qrcode')
          qrImage = await QRCode.toDataURL(session.qr, { margin: 2, width: 260, errorCorrectionLevel: 'L' })
        }
      } catch { logger.warn?.('[stone-gateway] QR indisponível; verifique a dependência qrcode') }
    }
    return { ...summary(session), pairingCode: session.pairingCode, qrImage }
  }
  async function pair(id, phoneNumber) {
    const session = sessions.get(safe(id))
    if (!session) fail('session_not_found', 404)
    if (session.status === 'open') fail('session_already_connected', 409)
    if (session.status === 'pairing') fail('pairing_in_progress', 409)
    if (!session.socket || !['connecting', 'waiting_pairing'].includes(session.status)) fail('session_not_ready_for_pairing', 409)
    if (typeof phoneNumber !== 'string' || !PHONE.test(phoneNumber)) fail('invalid_phone_number')
    if (typeof session.socket.requestPairingCode !== 'function') fail('pairing_not_supported', 409)
    // Allow the low-level websocket to finish its initial handshake.
    const socket = session.socket
    if (typeof socket.waitForSocketOpen === 'function') {
      let timer
      try {
        await Promise.race([
          socket.waitForSocketOpen(),
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(Object.assign(new Error('connection_not_ready_for_pairing'), { status: 409 })), 20000)
          })
        ])
      } finally { clearTimeout(timer) }
    }
    if (session.socket !== socket) fail('session_reconnecting_try_again', 409)
    const code = await socket.requestPairingCode(phoneNumber)
    if (typeof code !== 'string' || !code) fail('pairing_code_unavailable', 502)
    session.pairingCode = code
    return { id, code }
  }
  async function send(id, to, text) {
    const session = sessions.get(safe(id))
    if (!session) fail('session_not_found', 404)
    if (session.status !== 'open') fail('session_not_connected', 409)
    if (typeof to !== 'string' || !/^\d{8,15}@s\.whatsapp\.net$/.test(to)) fail('invalid_destination')
    if (typeof text !== 'string' || !text.trim() || text.length > 4096) fail('invalid_message')
    const result = await session.socket.sendMessage(to, { text })
    if (!result?.key?.id) fail('send_not_confirmed', 502)
    session.sent++
    return { id: result.key.id, to, sessionId: id }
  }
  async function restore() {
    for (const entry of await fs.readdir(path.join(dataDir, 'sessions'), { withFileTypes: true })) {
      if (!entry.isDirectory() || !ID.test(entry.name)) continue
      try {
        await fs.access(path.join(dataDir, 'sessions', entry.name, 'creds.json'))
        try {
          await fs.access(blockedMarker(entry.name))
          logger.warn?.('[stone-gateway] Sessão antiga ' + entry.name + ' ignorada na inicialização: vínculo recusado anteriormente.')
          continue
        } catch (error) {
          if (error.code !== 'ENOENT') throw error
        }
        await start(entry.name)
      } catch (error) {
        if (error.code !== 'ENOENT') logger.warn?.('[stone-gateway] Não foi possível restaurar sessão ' + entry.name)
      }
    }
  }
  async function shutdown() {
    if (stopped) return
    stopped = true
    for (const session of sessions.values()) {
      clearTimers(session)
      const socket = session.socket
      session.socket = null
      try { await socket?.end?.(new Error('Gateway shutdown')) }
      catch { /* already disconnected */ }
    }
    sessions.clear()
    await releaseLock()
  }
  return {
    start, get, list, pair, send, restore, shutdown,
    getWebhook: () => webhooks.getConfig(), setWebhook: value => webhooks.setConfig(value)
  }
}
