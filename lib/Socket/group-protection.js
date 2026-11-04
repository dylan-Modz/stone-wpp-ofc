/**
 * Stone WPP - proteção de grupos baseada em sinais observados.
 * Não modifica mensagens, não falsifica provas e não substitui o retry criptográfico.
 */
const PAYMENT_FIELDS = new Set([
  'requestPaymentMessage', 'sendPaymentMessage', 'paymentInviteMessage',
  'cancelPaymentRequestMessage', 'declinePaymentRequestMessage',
  'orderMessage', 'invoiceMessage'
])
const PAYMENT_BUTTONS = new Set(['payment_info', 'review_and_pay', 'payment_instruction'])
const DEFAULTS = Object.freeze({
  enabled: true,
  mode: 'alert', // alert | delete | remove | protect
  paymentBurst: 3,
  messageBurst: 14,
  windowMs: 8000,
  lockMs: 12000,
  observeInvisible: true,
  observePayments: true,
  observeQuotes: true,
  observeFlood: true,
  editNotice: false,
  observeReceipts: true,
  receiptBurst: 6,
  immunity: [],
  historyLimit: 100
})

const GROUP_SUFFIX = '@g.us'
const MAX_MONITORS = 3
const MAX_SEEN = 6000
const SEEN_TTL = 120000

// Compara apenas o mesmo domínio de JID: PN e LID não são intercambiáveis.
const canonicalJid = jid => {
  if (typeof jid !== 'string' || !jid.includes('@')) return ''
  const [user, domain] = jid.split('@')
  return user.split(':')[0] + '@' + domain.toLowerCase()
}
const sameUser = (a, b) => !!canonicalJid(a) && canonicalJid(a) === canonicalJid(b)
const isImmune = (identity, list) => Array.isArray(list) && list.some(jid => sameUser(jid, identity))
const STORE_PREFIX = 'stone:groupProtection:'
const storedSettings = settings => Object.fromEntries(Object.keys(DEFAULTS).map(key => [key, settings[key]]))
const recordSafe = event => ({
  jid: event.jid, participant: event.participant || null,
  reason: event.reason || null, severity: event.severity || null,
  action: event.action || null, mode: event.mode || event.attemptedMode || null,
  deleted: !!event.deleted, removed: !!event.removed, locked: !!event.locked,
  receivedAt: event.receivedAt || Date.now()
})
const isAdmin = p => !!p?.admin
const boundedInt = (v, min, max, key) => {
  if (!Number.isInteger(v) || v < min || v > max) {
    throw new RangeError(`${key} deve ser um inteiro entre ${min} e ${max}`)
  }
  return v
}

function scanPayment(root) {
  if (!root || typeof root !== 'object') return null
  const seen = new WeakSet()
  const todo = [{ node: root, depth: 0 }]
  let checked = 0
  while (todo.length && checked++ < 180) {
    const { node, depth } = todo.pop()
    if (!node || typeof node !== 'object' || seen.has(node) || depth > 7) continue
    seen.add(node)
    for (const [key, value] of Object.entries(node)) {
      if (!value || key === 'quotedMessage') continue
      if (PAYMENT_FIELDS.has(key)) return key
      if (key === 'nativeFlowMessage' && Array.isArray(value.buttons)) {
        for (const button of value.buttons) {
          if (PAYMENT_BUTTONS.has(String(button?.name || '').toLowerCase())) return 'nativeFlowPayment'
        }
      }
      if (typeof value === 'object') todo.push({ node: value, depth: depth + 1 })
    }
  }
  return null
}

function findQuoted(root) {
  let message = root
  for (let i = 0; i < 5 && message && typeof message === 'object'; i++) {
    for (const key of ['extendedTextMessage', 'imageMessage', 'videoMessage', 'documentMessage', 'buttonsResponseMessage', 'templateButtonReplyMessage']) {
      const context = message[key]?.contextInfo
      if (context?.quotedMessage) return { message: context.quotedMessage, participant: context.participant, stanzaId: context.stanzaId }
    }
    message = message.ephemeralMessage?.message || message.viewOnceMessage?.message || message.viewOnceMessageV2?.message || message.documentWithCaptionMessage?.message
  }
  return null
}

/** Instala proteção opcional em um socket sem alterar a recepção nativa. */
export function createGroupProtectionMethods(socket) {
  const groups = new Map()
  const observers = new Map()
  const seen = new Map()
  const buckets = new Map()
  const busy = new Set()
  const recentActions = new Map()
  const locks = new Map()
  const persistence = new Map()
  const managed = new Map()

  function markOnce(key) {
    const now = Date.now()
    if (seen.has(key) && now - seen.get(key) < SEEN_TTL) return false
    seen.set(key, now)
    if (seen.size > MAX_SEEN) {
      for (const [k, t] of seen) if (now - t >= SEEN_TTL) seen.delete(k)
      while (seen.size > MAX_SEEN) seen.delete(seen.keys().next().value)
    }
    return true
  }

  function count(group, participant, kind, windowMs, mark) {
    const key = `${group}\u0000${participant}\u0000${kind}`
    const now = Date.now()
    const old = (buckets.get(key) || []).filter(item => now - item.at < windowMs)
    if (mark && !old.some(item => item.id === mark)) old.push({ id: mark, at: now })
    buckets.set(key, old.slice(-80))
    if (buckets.size > 3000) {
      for (const [k, entries] of buckets) {
        if (!entries.length || now - entries[entries.length - 1].at > 2 * windowMs) buckets.delete(k)
      }
    }
    return old.length
  }

  function appendHistory(state, type, incident) {
    const entry = { type, ...recordSafe(incident) }
    state.history.push(entry)
    if (state.history.length > state.settings.historyLimit) state.history.splice(0, state.history.length - state.settings.historyLimit)
    if (state.store) {
      const key = STORE_PREFIX + 'history:' + entry.jid
      const previous = persistence.get(key) || Promise.resolve()
      const task = previous.catch(() => {}).then(async () => {
        await state.store.set(key, state.history.slice())
      })
      persistence.set(key, task)
      task.catch(error => socket.logger?.warn?.({ error }, 'groupProtection history save failed'))
    }
  }
  function emit(name, data) {
    const state = groups.get(data?.jid)
    if (state && (name === 'group-protection.alert' || name === 'group-protection.action')) {
      appendHistory(state, name.endsWith('.alert') ? 'alert' : 'action', data)
    }
    try { socket.ev.emit(name, data) } catch (error) {
      socket.logger?.warn?.({ error }, 'groupProtection event handler failed')
    }
  }

  async function act(incident, message) {
    const state = groups.get(incident.jid)
    if (!state || state.settings.mode === 'alert' || incident.severity !== 'high' || !incident.verified) return
    const lockKey = `${incident.jid}\u0000${incident.participant}`
    if (busy.has(lockKey) || Date.now() - (recentActions.get(lockKey) || 0) < 30000) return
    busy.add(lockKey)
    recentActions.set(lockKey, Date.now())
    if (recentActions.size > 3000) {
      for (const [key, at] of recentActions) if (Date.now() - at > 60000) recentActions.delete(key)
    }
    const result = { ...incident, attemptedMode: state.settings.mode, deleted: false, removed: false, locked: false }
    let notice = null
    try {
      const metadata = await socket.groupMetadata(incident.jid)
      const members = Array.isArray(metadata?.participants) ? metadata.participants : []
      const self = members.find(p => sameUser(p.id, socket.user?.id) || sameUser(p.id, socket.authState?.creds?.me?.lid))
      const actor = members.find(p => sameUser(p.id, incident.participant))
      if (!isAdmin(self)) {
        result.error = 'bot_not_admin'
        return
      }
      if (!actor || isAdmin(actor) || sameUser(actor.id, self.id)) {
        result.error = 'target_unverified_or_admin'
        return
      }
      if (isImmune(actor.id, state.settings.immunity)
        || isImmune(actor.phoneNumber, state.settings.immunity)
        || isImmune(actor.lid, state.settings.immunity)
        || isImmune(incident.participant, state.settings.immunity)) {
        result.error = 'immune_participant'
        return
      }
      if (state.settings.editNotice) {
        try {
          notice = await socket.sendMessage(incident.jid, { text: 'Stone Protection: ameaça identificada. Verificando e aplicando as ações de moderação...' })
        } catch (error) { result.noticeError = String(error?.message || error) }
      }
      if (state.settings.mode === 'protect' && !metadata.announce && !locks.has(incident.jid)) {
        try {
          await socket.groupSettingUpdate(incident.jid, 'announcement')
          result.locked = true
          const timer = setTimeout(async () => {
            locks.delete(incident.jid)
            try {
              const latest = await socket.groupMetadata(incident.jid)
              if (latest?.announce === true) await socket.groupSettingUpdate(incident.jid, 'not_announcement')
            }
            catch (error) { emit('group-protection.action', { jid: incident.jid, action: 'reopen', ok: false, error: String(error?.message || error) }) }
          }, state.settings.lockMs)
          timer.unref?.()
          locks.set(incident.jid, timer)
        } catch (error) { result.lockError = String(error?.message || error) }
      }
      if (message?.key?.id && message.key.remoteJid === incident.jid) {
        try {
          await socket.sendMessage(incident.jid, { delete: message.key })
          result.deleted = true
        } catch (error) { result.deleteError = String(error?.message || error) }
      }
      if (state.settings.mode === 'remove' || state.settings.mode === 'protect') {
        try {
          const response = await socket.groupParticipantsUpdate(incident.jid, [actor.id], 'remove')
          result.removed = Array.isArray(response) && response.some(r => String(r.status) === '200')
        } catch (error) { result.removeError = String(error?.message || error) }
      }
    } catch (error) { result.error = String(error?.message || error) }
    finally {
      if (notice?.key?.id && notice.key.fromMe === true) {
        const status = result.removed ? 'participante removido' : result.deleted ? 'mensagem removida' : 'ações parciais ou indisponíveis'
        try {
          await socket.sendMessage(incident.jid, {
            text: `Stone Protection: verificação concluída — ${status}.`,
            edit: notice.key
          })
          result.noticeEdited = true
        } catch (error) {
          result.noticeEditError = String(error?.message || error)
        }
      }
      busy.delete(lockKey)
      state.actions++
      emit('group-protection.action', result)
    }
  }

  function report(incident, message) {
    const state = groups.get(incident.jid)
    if (!state) return
    const evidenceKey = `${incident.jid}\u0000${incident.messageId}\u0000${incident.reason}\u0000${incident.participant}`
    if (!markOnce(evidenceKey)) return
    state.alerts++
    emit('group-protection.alert', { ...incident, mode: state.settings.mode, receivedAt: Date.now() })
    void act(incident, message).catch(error => socket.logger?.warn?.({ error }, 'groupProtection action failed'))
  }

  function handleSignal(data, source) {
    if (!data?.remoteJid?.endsWith(GROUP_SUFFIX) || !data.messageId) return
    const state = groups.get(data.remoteJid)
    if (!state?.settings.observeInvisible) return
    const actor = data.participant || data.participantAlt
    if (!actor) return
    const signature = String(data.decryptFail || '').toLowerCase()
    const highSignal = signature === 'hide'
    if (!markOnce(`signal\u0000${data.remoteJid}\u0000${data.messageId}\u0000${actor}`)) return
    const hits = count(data.remoteJid, actor, 'ciphertext', state.settings.windowMs, data.messageId)
    // Ciphertext não é prova de ataque; nunca punir só por falha de descriptografia.
    if (highSignal || hits >= state.settings.paymentBurst) {
      report({ jid: data.remoteJid, participant: actor, messageId: data.messageId, reason: 'invisible-suspected', severity: highSignal ? 'medium' : 'low', verified: false, source, evidence: { decryptFail: signature || null, ciphertextCount: hits } })
    }
  }

  // Recibos são somente telemetria: pedidos de retransmissão são normais
  // em redes instáveis e NÃO identificam culpabilidade de um participante.
  function handleReceipt(data, source) {
    if (!data?.remoteJid?.endsWith(GROUP_SUFFIX) || !data.messageId || !data.participant) return
    const state = groups.get(data.remoteJid)
    if (!state?.settings.observeReceipts || data.type !== 'retry') return
    const mark = `receipt\u0000${data.remoteJid}\u0000${data.messageId}\u0000${data.participant}`
    if (!markOnce(mark)) return
    const n = count(data.remoteJid, data.participant, 'retry-receipt', state.settings.windowMs, data.messageId)
    if (n === state.settings.receiptBurst || (n > state.settings.receiptBurst && n % state.settings.receiptBurst === 0)) {
      report({ jid: data.remoteJid, participant: data.participant,
        messageId: data.messageId, reason: 'receipt-suspected', severity: 'low',
        verified: false, source, evidence: { type: data.type, receiptCount: n } })
    }
  }

  function handlePdo(data, source) {
    if (!data?.remoteJid?.endsWith(GROUP_SUFFIX)) return
    const state = groups.get(data.remoteJid)
    if (!state?.settings.observeInvisible || !data.messageId) return
    emit('group-protection.pdo-observed', {
      jid: data.remoteJid, messageId: data.messageId,
      status: data.status, source, receivedAt: Date.now()
    })
  }

  function handleMessage(message, source, kind = 'notify') {
    const jid = message?.key?.remoteJid
    if (!jid?.endsWith(GROUP_SUFFIX) || message.key.fromMe) return
    const state = groups.get(jid)
    if (!state || (kind !== 'notify' && kind !== 'append')) return
    const id = message.key.id
    const participant = message.key.participant || message.participant || message.key.participantAlt
    if (!id || !participant || !message.message) return
    const stamp = Number(message.messageTimestamp || 0)
    if (stamp && Math.abs(Date.now() - stamp * 1000) > 120000) return
    if (!markOnce(`message\u0000${jid}\u0000${id}`)) return
    const settings = state.settings
    const paymentType = settings.observePayments ? scanPayment(message.message) : null
    const volume = settings.observeFlood ? count(jid, participant, 'messages', settings.windowMs, id) : 0
    if (paymentType) {
      const payments = count(jid, participant, 'payment', settings.windowMs, id)
      report({ jid, participant, messageId: id, reason: 'payment', severity: payments >= settings.paymentBurst ? 'high' : 'low', verified: payments >= settings.paymentBurst, source, evidence: { paymentType, paymentCount: payments } }, message)
    }
    if (settings.observeFlood && volume >= settings.messageBurst) {
      report({ jid, participant, messageId: id, reason: 'flood', severity: 'high', verified: true, source, evidence: { messageCount: volume } }, message)
    }
    // Citações são evidência auxiliar, nunca prova para punir outro participante.
    if (settings.observeQuotes) {
      const quoted = findQuoted(message.message)
      const quotePayment = quoted && scanPayment(quoted.message)
      if (quotePayment) {
        report({ jid, participant: quoted.participant || participant, messageId: quoted.stanzaId || id, reason: 'quoted-payment', severity: 'medium', verified: false, source, evidence: { quotedBy: participant, paymentType: quotePayment } })
      }
    }
  }

  function connectObserver(monitor, index) {
    if (!monitor?.ev || typeof monitor.ev.on !== 'function') throw new TypeError('monitor deve ser um socket Stone WPP conectado')
    if (observers.has(monitor)) return
    const source = index === -1 ? 'primary' : `monitor-${index + 1}`
    const allowed = groupJid => monitor === socket || groups.get(groupJid)?.monitors.includes(monitor)
    const onUpsert = payload => {
      for (const message of payload?.messages || []) {
        if (allowed(message?.key?.remoteJid)) handleMessage(message, source, payload?.type)
      }
    }
    const onSignal = payload => {
      if (allowed(payload?.remoteJid)) handleSignal(payload, source)
    }
    monitor.ev.on('messages.upsert', onUpsert)
    const onReceipt = payload => {
      if (allowed(payload?.remoteJid)) handleReceipt(payload, source)
    }
    const onPdo = payload => {
      if (allowed(payload?.remoteJid)) handlePdo(payload, source)
    }
    monitor.ev.on('group-protection.ciphertext', onSignal)
    monitor.ev.on('group-protection.receipt', onReceipt)
    monitor.ev.on('group-protection.pdo', onPdo)
    observers.set(monitor, () => {
      monitor.ev.off('messages.upsert', onUpsert)
      monitor.ev.off('group-protection.ciphertext', onSignal)
      monitor.ev.off('group-protection.receipt', onReceipt)
      monitor.ev.off('group-protection.pdo', onPdo)
    })
  }

  function pruneObservers() {
    const active = new Set([...groups.values()].flatMap(g => g.monitors))
    for (const [monitor, detach] of observers) {
      if (monitor !== socket && !active.has(monitor)) { detach(); observers.delete(monitor) }
    }
  }
  function statusFor(jid, state, extra = {}) {
    if (!state) return { jid, enabled: false, monitorCount: 0, alerts: 0, actions: 0, ...extra }
    return { jid, ...state.settings, monitorCount: state.monitors.length,
      alerts: state.alerts, actions: state.actions, ...extra }
  }
  function stopManaged(jid) {
    for (const [key, active] of managed) {
      if (!key.startsWith(jid + '\u0000')) continue
      active.cancelled = true
      if (active.timer) clearTimeout(active.timer)
      if (active.socket && active.onUpdate) active.socket.ev.off('connection.update', active.onUpdate)
      managed.delete(key)
    }
  }
  async function startManaged(jid, index, factory, state, reconnectMs) {
    const key = jid + '\u0000' + index
    if (managed.get(key)?.factory === factory) return
    const current = managed.get(key)
    if (current) {
      current.cancelled = true
      if (current.timer) clearTimeout(current.timer)
      if (current.socket && current.onUpdate) current.socket.ev.off('connection.update', current.onUpdate)
    }
    const item = { factory, timer: null, socket: null, onUpdate: null, attempt: 0, cancelled: false }
    managed.set(key, item)
    const attach = async () => {
      if (item.cancelled || groups.get(jid) !== state) return
      item.attempt++
      try {
        const create = typeof factory === 'function' ? factory : factory.create
        const monitor = await create({ jid, attempt: item.attempt })
        if (!monitor?.ev || typeof monitor.ev.on !== 'function' || monitor === socket) {
          throw new TypeError('monitorFactory deve retornar outro socket autenticado')
        }
        if (item.cancelled || groups.get(jid) !== state) return
        // Pareamento autorizado: o proprietário recebe o código via callback.
        // Nenhuma sessão é vinculada sem a confirmação no próprio WhatsApp.
        if (typeof factory === 'object' && factory.phoneNumber
          && monitor.authState?.creds?.registered === false) {
          if (typeof monitor.requestPairingCode !== 'function') {
            throw new TypeError('socket auxiliar não suporta requestPairingCode')
          }
          const code = await monitor.requestPairingCode(factory.phoneNumber)
          await factory.onPairingCode({ jid, index, code })
        }
        if (item.socket && item.onUpdate) item.socket.ev.off('connection.update', item.onUpdate)
        const previous = item.socket
        item.socket = monitor
        if (previous) {
          state.monitors = state.monitors.filter(m => m !== previous)
        }
        if (!state.monitors.includes(monitor)) state.monitors.push(monitor)
        connectObserver(monitor, index)
        pruneObservers()
        item.onUpdate = update => {
          if (update?.connection === 'open') {
            item.attempt = 0
            emit('group-protection.monitor', { jid, index, status: 'connected' })
          }
          if (update?.connection !== 'close' || item.cancelled) return
          const code = update?.lastDisconnect?.error?.output?.statusCode
          // Logged out: é necessário parear novamente com consentimento.
          if (code === 401) {
            monitor.ev.off('connection.update', item.onUpdate)
            state.monitors = state.monitors.filter(m => m !== monitor)
            item.socket = null
            pruneObservers()
            emit('group-protection.monitor', { jid, index, status: 'logged-out' })
            return
          }
          monitor.ev.off('connection.update', item.onUpdate)
          state.monitors = state.monitors.filter(m => m !== monitor)
          pruneObservers()
          schedule()
        }
        monitor.ev.on('connection.update', item.onUpdate)
        emit('group-protection.monitor', { jid, index, status: 'attached' })
      } catch (error) {
        emit('group-protection.monitor', { jid, index, status: 'error',
          error: String(error?.message || error) })
        schedule()
      }
    }
    const schedule = () => {
      if (item.cancelled || groups.get(jid) !== state) return
      const ms = Math.min(60000, reconnectMs * Math.pow(2, Math.min(item.attempt - 1, 5)))
      item.timer = setTimeout(() => { item.timer = null; void attach() }, ms)
      item.timer.unref?.()
    }
    await attach()
  }

  connectObserver(socket, -1)

  return {
    /**
     * Consulta / configura a proteção. Monitors: sockets Stone extras autenticados
     * separadamente e presentes nos mesmos grupos (até três). A Stone não cria sessões
     * extras automaticamente nem promete acessar mensagens omitidas pelo WhatsApp.
     */
    async groupProtection(jid, options) {
      if (typeof jid !== 'string' || !jid.endsWith(GROUP_SUFFIX)) {
        throw new TypeError('groupProtection requer JID de grupo (@g.us)')
      }
      const old = groups.get(jid)
      if (options === undefined) return statusFor(jid, old)
      if (!options || typeof options !== 'object' || Array.isArray(options)) {
        throw new TypeError('options deve ser um objeto')
      }
      const store = options.store || old?.store
      if (store && (typeof store.get !== 'function' || typeof store.set !== 'function')) {
        throw new TypeError('store requer métodos get e set')
      }
      if (options.getHistory === true) {
        const limit = options.limit === undefined ? 100 : boundedInt(options.limit, 1, 500, 'limit')
        const saved = store ? await store.get(STORE_PREFIX + 'history:' + jid) : null
        const history = old?.history?.length ? old.history : (Array.isArray(saved) ? saved : [])
        return statusFor(jid, old, { history: history.slice(-limit) })
      }
      if (options.enabled === false) {
        const savedStore = store
        groups.delete(jid)
        stopManaged(jid)
        pruneObservers()
        if (savedStore) {
          await savedStore.set(STORE_PREFIX + 'settings:' + jid, { enabled: false })
        }
        return statusFor(jid, null)
      }
      let restored = null
      if (options.restore === true) {
        if (!store) throw new TypeError('restore requer store')
        restored = await store.get(STORE_PREFIX + 'settings:' + jid)
        if (!restored?.enabled) return statusFor(jid, old, { restored: false })
      }
      const input = { ...(old?.settings || DEFAULTS), ...(restored || {}), ...options, enabled: true }
      if (!['alert', 'delete', 'remove', 'protect'].includes(input.mode)) {
        throw new TypeError('mode: alert, delete, remove ou protect')
      }
      for (const key of ['observeInvisible', 'observePayments', 'observeQuotes', 'observeFlood', 'editNotice', 'observeReceipts']) {
        if (typeof input[key] !== 'boolean') throw new TypeError(`${key} deve ser booleano`)
      }
      input.paymentBurst = boundedInt(input.paymentBurst, 2, 30, 'paymentBurst')
      input.messageBurst = boundedInt(input.messageBurst, 3, 100, 'messageBurst')
      input.receiptBurst = boundedInt(input.receiptBurst, 3, 50, 'receiptBurst')
      input.windowMs = boundedInt(input.windowMs, 1000, 60000, 'windowMs')
      input.lockMs = boundedInt(input.lockMs, 3000, 120000, 'lockMs')
      input.historyLimit = boundedInt(input.historyLimit, 20, 500, 'historyLimit')
      if (!Array.isArray(input.immunity) || input.immunity.length > 200
        || !input.immunity.every(jid => typeof jid === 'string' && canonicalJid(jid))) {
        throw new TypeError('immunity deve conter até 200 JIDs válidos')
      }
      input.immunity = [...new Set(input.immunity.map(canonicalJid))]
      const staticMonitors = options.monitors === undefined ? (old?.staticMonitors || []) : options.monitors
      const factories = options.monitorFactories === undefined ? (old?.factories || []) : options.monitorFactories
      if (!Array.isArray(staticMonitors) || !Array.isArray(factories)
        || staticMonitors.length + factories.length > MAX_MONITORS
        || new Set(staticMonitors).size !== staticMonitors.length || staticMonitors.includes(socket)
        || !factories.every(f => typeof f === 'function' ||
          (f && typeof f === 'object' && typeof f.create === 'function'
          && (!f.phoneNumber || (typeof f.phoneNumber === 'string'
          && /^\d{8,15}$/.test(f.phoneNumber)
          && typeof f.onPairingCode === 'function'))))) {
        throw new TypeError('Até 3 monitores: sockets distintos e/ou monitorFactories')
      }
      for (const monitor of staticMonitors) {
        if (!monitor?.ev || typeof monitor.ev.on !== 'function') {
          throw new TypeError('monitor deve ser socket Stone válido')
        }
      }
      const reconnectMs = options.monitorReconnectMs === undefined
        ? (old?.monitorReconnectMs || 3000)
        : boundedInt(options.monitorReconnectMs, 1000, 60000, 'monitorReconnectMs')
      const settings = storedSettings(input)
      const state = old || { alerts: 0, actions: 0, history: [], monitors: [] }
      state.settings = settings
      state.staticMonitors = staticMonitors
      state.factories = factories
      state.monitorReconnectMs = reconnectMs
      state.store = store
      state.monitors = [...staticMonitors, ...[...managed.entries()]
        .filter(([key, item]) => key.startsWith(jid + '\u0000')
          && !item.cancelled && item.socket && factories.includes(item.factory))
        .map(([, item]) => item.socket)]
      if (store && !old?.history?.length) {
        const history = await store.get(STORE_PREFIX + 'history:' + jid)
        if (Array.isArray(history)) state.history = history.slice(-settings.historyLimit)
      }
      groups.set(jid, state)
      staticMonitors.forEach((monitor, index) => connectObserver(monitor, index))
      for (const [key, item] of managed) {
        if (!key.startsWith(jid + '\u0000')) continue
        const index = Number(key.slice((jid + '\u0000').length))
        if (factories[index] !== item.factory) {
          item.cancelled = true
          if (item.timer) clearTimeout(item.timer)
          if (item.socket && item.onUpdate) item.socket.ev.off('connection.update', item.onUpdate)
          state.monitors = state.monitors.filter(monitor => monitor !== item.socket)
          managed.delete(key)
        }
      }
      for (let i = 0; i < factories.length; i++) {
        await startManaged(jid, i, factories[i], state, reconnectMs)
      }
      pruneObservers()
      if (store) {
        await store.set(STORE_PREFIX + 'settings:' + jid, settings)
      }
      return statusFor(jid, state, { ...(options.restore ? { restored: true } : {}) })
    }
  }
}
