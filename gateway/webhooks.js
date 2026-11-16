import fs from 'node:fs/promises'
import path from 'node:path'
import { createHmac } from 'node:crypto'
import { isIP } from 'node:net'

const EVENTS = new Set(['connection.update', 'messages.upsert', 'groups.update', 'call'])

function validateURL(value) {
  if (value === '') return ''
  let url
  try { url = new URL(value) } catch { throw Object.assign(new Error('invalid_webhook_url'), { status: 400 }) }
  const host = url.hostname.toLowerCase().replace(/\.$/, '')
  if (url.protocol !== 'https:' || url.username || url.password || !host || isIP(host) ||
      host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') ||
      host.endsWith('.internal')) {
    throw Object.assign(new Error('webhook_requires_public_https_hostname'), { status: 400 })
  }
  return url.toString()
}

export async function createWebhookService(dataDir, { logger = console, fetchImpl = fetch } = {}) {
  const file = path.join(dataDir, 'gateway-webhook.json')
  let config = { url: '', secret: '', events: [...EVENTS] }
  try {
    const saved = JSON.parse(await fs.readFile(file, 'utf8'))
    config = { url: validateURL(saved.url || ''), secret: typeof saved.secret === 'string' ? saved.secret : '', events: [...EVENTS].filter(e => (saved.events || [...EVENTS]).includes(e)) }
  } catch (error) {
    if (error.code !== 'ENOENT') logger.warn?.('[stone-gateway] Configuração de webhook inválida; desabilitando até revisão.')
  }
  function publicConfig() { return { url: config.url, events: [...config.events], signed: Boolean(config.secret) } }
  async function setConfig(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.url !== 'string') {
      throw Object.assign(new Error('invalid_webhook_configuration'), { status: 400 })
    }
    const url = validateURL(body.url.trim())
    let secret = config.secret
    if (body.secret !== undefined) {
      if (typeof body.secret !== 'string' || body.secret.length < 16 || body.secret.length > 256) {
        throw Object.assign(new Error('webhook_secret_minimum_16_characters'), { status: 400 })
      }
      secret = body.secret
    }
    const events = body.events === undefined ? [...config.events] : body.events
    if (!Array.isArray(events) || !events.length || events.some(e => !EVENTS.has(e))) {
      throw Object.assign(new Error('invalid_webhook_events'), { status: 400 })
    }
    const next = { url, secret, events: [...new Set(events)] }
    const tmp = file + '.tmp'
    await fs.writeFile(tmp, JSON.stringify(next), { mode: 0o600 })
    await fs.rename(tmp, file)
    await fs.chmod(file, 0o600).catch(() => {})
    config = next
    return publicConfig()
  }
  async function deliver(event, data) {
    if (!config.url || !config.events.includes(event)) return
    const body = JSON.stringify({ id: cryptoRandomId(), event, timestamp: new Date().toISOString(), data })
    const headers = { 'Content-Type': 'application/json', 'User-Agent': 'Stone-WPP-Gateway/1.0', 'X-Stone-Event': event }
    if (config.secret) headers['X-Stone-Signature'] = 'sha256=' + createHmac('sha256', config.secret).update(body).digest('hex')
    try {
      const r = await fetchImpl(config.url, { method: 'POST', headers, body, redirect: 'error', signal: AbortSignal.timeout(5000) })
      if (!r.ok) logger.warn?.('[stone-gateway] Falha no webhook: HTTP ' + r.status)
    } catch {
      logger.warn?.('[stone-gateway] Falha no envio do webhook: ' + event)
    }
  }
  function emit(event, data) { if (config.url && config.events.includes(event)) void deliver(event, data) }
  return { getConfig: publicConfig, setConfig, emit }
}
function cryptoRandomId() { return globalThis.crypto?.randomUUID?.() || String(Date.now()) + '-' + Math.random().toString(36).slice(2) }
