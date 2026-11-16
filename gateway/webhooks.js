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
  let config = { url: '', secret: '', events: [...EVENTS], disabledReason: '' }
  let lastFailureLoggedAt = 0
  let configRevision = 0
  let writeQueue = Promise.resolve()
  try {
    const saved = JSON.parse(await fs.readFile(file, 'utf8'))
    config = { url: validateURL(saved.url || ''), secret: typeof saved.secret === 'string' ? saved.secret : '', events: [...EVENTS].filter(e => (saved.events || [...EVENTS]).includes(e)), disabledReason: typeof saved.disabledReason === 'string' ? saved.disabledReason : '' }
  } catch (error) {
    if (error.code !== 'ENOENT') logger.warn?.('[stone-gateway] Configuração de webhook inválida; desabilitando até revisão.')
  }
  function publicConfig() { return { url: config.url, events: [...config.events], signed: Boolean(config.secret), disabledReason: config.disabledReason || null } }
  function saveConfig(next) {
    // Manual saves and automatic disable may overlap. Serialize disk writes so
    // a failed request cannot corrupt a new valid webhook configuration.
    const task = writeQueue.then(async () => {
      const tmp = file + '.tmp'
      await fs.writeFile(tmp, JSON.stringify(next), { mode: 0o600 })
      await fs.rename(tmp, file)
      await fs.chmod(file, 0o600).catch(() => {})
    })
    writeQueue = task.catch(() => {})
    return task
  }
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
    const next = { url, secret, events: [...new Set(events)], disabledReason: '' }
    // Invalidate pending webhook deliveries before writing the new setup.
    // Keep the previous working config if the disk write fails.
    const revision = ++configRevision
    try { await saveConfig(next) }
    catch {
      throw Object.assign(new Error('webhook_save_failed'), {status:500})
    }
    if (revision !== configRevision) {
      throw Object.assign(new Error('webhook_configuration_changed_retry'), {status:409})
    }
    config = next
    lastFailureLoggedAt = 0
    return publicConfig()
  }
  function logFailure(message) {
    const now = Date.now()
    // Avoid flooding Termux on a receiver that is temporarily unavailable.
    if (now - lastFailureLoggedAt >= 60000 || !lastFailureLoggedAt) {
      logger.warn?.(message)
      lastFailureLoggedAt = now
    }
  }
  async function disableUnauthorized(target, status, revision) {
    // 401/403 means the receiver rejected our request, not a temporary WA issue.
    // Immediately stop retries, including concurrent in-flight callbacks.
    if (!config.url || config.url !== target || revision !== configRevision) return
    const next = { ...config, url: '', disabledReason: 'HTTP ' + status + ': webhook desativado automaticamente; confira o destino.' }
    ++configRevision
    config = next
    logger.warn?.('[stone-gateway] Webhook desativado após HTTP ' + status + '. Confira a URL e a autorização no sistema de destino.')
    lastFailureLoggedAt = Date.now()
    try { await saveConfig(next) }
    catch { logger.warn?.('[stone-gateway] Não foi possível salvar a desativação do webhook no disco.') }
  }
  async function deliver(event, data) {
    const target = config.url
    const revision = configRevision
    if (!target || !config.events.includes(event)) return
    const body = JSON.stringify({ id: cryptoRandomId(), event, timestamp: new Date().toISOString(), data })
    const headers = { 'Content-Type': 'application/json', 'User-Agent': 'Stone-WPP-Gateway/1.0', 'X-Stone-Event': event }
    if (config.secret) headers['X-Stone-Signature'] = 'sha256=' + createHmac('sha256', config.secret).update(body).digest('hex')
    try {
      const r = await fetchImpl(target, { method: 'POST', headers, body, redirect: 'error', signal: AbortSignal.timeout(5000) })
      if (r.status === 401 || r.status === 403) {
        await disableUnauthorized(target, r.status, revision)
      } else if (!r.ok && config.url === target && revision === configRevision) {
        logFailure('[stone-gateway] Webhook HTTP ' + r.status + '. O destino pode estar indisponível.')
      } else if (r.ok && revision === configRevision) {
        lastFailureLoggedAt = 0
      }
    } catch {
      if (config.url === target && revision === configRevision) logFailure('[stone-gateway] Webhook indisponível; verifique a conexão com o destino.')
    }
  }
  function emit(event, data) { if (config.url && config.events.includes(event)) void deliver(event, data) }
  return { getConfig: publicConfig, setConfig, emit }
}
function cryptoRandomId() { return globalThis.crypto?.randomUUID?.() || String(Date.now()) + '-' + Math.random().toString(36).slice(2) }
