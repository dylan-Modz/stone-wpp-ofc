import fs from 'node:fs/promises'
import path from 'node:path'
import makeWASocket, { useMultiFileAuthState } from '../lib/index.js'
import { createWebhookService } from './webhooks.js'

const ID = /^[a-zA-Z0-9_-]{1,40}$/
const PHONE = /^\d{10,15}$/

function fail(message, status = 400) { throw Object.assign(new Error(message), { status }) }

export async function createSessionManager({ dataDir = path.resolve('.stone-gateway'), logger = console, socketFactory = makeWASocket, authFactory = useMultiFileAuthState, qrEncoder } = {}) {
  await fs.mkdir(path.join(dataDir, 'sessions'), { recursive: true, mode: 0o700 })
  const webhooks = await createWebhookService(dataDir, { logger })
  const sessions = new Map()
  const maxSessions = 10
  const safe = id => {
    if (typeof id !== 'string' || !ID.test(id)) fail('invalid_session_id')
    return id
  }
  const summary = session => ({
    id: session.id, status: session.status, user: session.user,
    received: session.received, sent: session.sent, updatedAt: session.updatedAt
  })
  function record(session, status) { session.status = status; session.updatedAt = new Date().toISOString() }
  async function start(id) {
    safe(id)
    const existing = sessions.get(id)
    if (existing) {
      if (existing.status !== 'close' && existing.status !== 'error') fail('session_already_running', 409)
      await existing.socket?.end?.(new Error('Stone Gateway reconnect')).catch?.(() => {})
      sessions.delete(id)
    }
    if (sessions.size >= maxSessions) fail('session_limit_reached', 409)
    const dir = path.join(dataDir, 'sessions', id)
    await fs.mkdir(dir, { recursive: true, mode: 0o700 })
    const { state, saveCreds } = await authFactory(dir)
    const session = { id, status: 'connecting', user: null, received: 0, sent: 0, qr: null, pairingCode: null, socket: null, updatedAt: new Date().toISOString() }
    sessions.set(id, session)
    try {
      const socket = socketFactory({ auth: state, printQRInTerminal: false })
      session.socket = socket
      socket.ev.on('creds.update', saveCreds)
      socket.ev.on('connection.update', update => {
        if (sessions.get(id) !== session) return
        if (update.qr) { session.qr = update.qr; session.pairingCode = null }
        if (update.connection === 'open') {
          session.qr = null
          session.pairingCode = null
          session.user = socket.user?.id || null
          record(session, 'open')
        } else if (update.connection === 'close') {
          session.qr = null
          record(session, 'close')
        } else if (update.connection === 'connecting') record(session, 'connecting')
        webhooks.emit('connection.update', { sessionId: id, connection: update.connection || session.status, user: session.user })
      })
      socket.ev.on('messages.upsert', update => {
        const messages = (update.messages || []).slice(0, 20)
        session.received += (update.messages || []).filter(m => !m.key?.fromMe).length
        webhooks.emit('messages.upsert', { sessionId: id, type: update.type, messages: messages.map(m => ({
          id: m.key?.id, chatId: m.key?.remoteJid, fromMe: Boolean(m.key?.fromMe),
          text: String(m.message?.conversation || m.message?.extendedTextMessage?.text || '').slice(0, 4096)
        })) })
      })
      socket.ev.on('groups.update', items => webhooks.emit('groups.update', { sessionId: id, groups: (Array.isArray(items) ? items : [items]).slice(0, 30) }))
      socket.ev.on('call', calls => webhooks.emit('call', { sessionId: id, calls: (Array.isArray(calls) ? calls : [calls]).slice(0, 10) }))
    } catch (error) {
      sessions.delete(id)
      record(session, 'error')
      throw error
    }
    return summary(session)
  }
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
      } catch { logger.warn?.('[stone-gateway] QR indisponível: confira a dependência qrcode') }
    }
    return { ...summary(session), pairingCode: session.pairingCode, qrImage }
  }
  function list() { return [...sessions.values()].map(summary).sort((a, b) => a.id.localeCompare(b.id)) }
  async function pair(id, phoneNumber) {
    const session = sessions.get(safe(id))
    if (!session) fail('session_not_found', 404)
    if (session.status === 'open') fail('session_already_connected', 409)
    if (typeof phoneNumber !== 'string' || !PHONE.test(phoneNumber)) fail('invalid_phone_number')
    if (typeof session.socket?.requestPairingCode !== 'function') fail('pairing_not_supported', 409)
    const code = await session.socket.requestPairingCode(phoneNumber)
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
    const base = path.join(dataDir, 'sessions')
    for (const entry of await fs.readdir(base, { withFileTypes: true })) {
      if (!entry.isDirectory() || !ID.test(entry.name)) continue
      try {
        const creds = path.join(base, entry.name, 'creds.json')
        await fs.access(creds)
        await start(entry.name)
      } catch (e) {
        if (e.code !== 'ENOENT') logger.warn?.('[stone-gateway] Não foi possível restaurar sessão ' + entry.name)
      }
    }
  }
  async function shutdown() {
    for (const session of sessions.values()) {
      try { await session.socket?.end?.(new Error('Gateway shutdown')) } catch { /* already disconnected */ }
    }
    sessions.clear()
  }
  return { start, get, list, pair, send, restore, shutdown,
    getWebhook: () => webhooks.getConfig(), setWebhook: value => webhooks.setConfig(value) }
}
