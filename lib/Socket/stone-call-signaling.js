import { randomBytes } from 'node:crypto'

/**
 * Normaliza metadados públicos de uma sinalização recebida sem reter nem
 * expor os nós que carregam chaves E2EE, tokens ou credenciais de relay.
 * Não é um decodificador de mídia nem um implementador de chamadas VoIP.
 */
export function parseStoneCallStanza(node, status) {
  const attrs = node?.attrs ?? {}
  const inner = Array.isArray(node?.content) ? node.content.find(child => child?.tag && child?.attrs) : null
  const fields = inner?.attrs
  if (!fields || typeof fields['call-id'] !== 'string' || !fields['call-id']) return null

  const children = Array.isArray(inner.content) ? inner.content : []
  const groupJid = fields['group-jid'] || fields.group_jid || null
  const callCreator = fields['call-creator'] || fields.from || null
  const timestamp = Number(attrs.t)
  const date = Number.isFinite(timestamp) && timestamp > 0 ? new Date(timestamp * 1000) : new Date()
  const value = {
    id: fields['call-id'],
    chatId: attrs.from ?? null,
    from: fields.from || callCreator,
    callCreator,
    sourceJid: attrs.from ?? null,
    stanzaId: attrs.id ?? null,
    callerPn: fields.caller_pn ?? fields['caller_pn'] ?? null,
    date,
    offline: attrs.offline === '1' || attrs.offline === 'true' || attrs.offline === true,
    status: typeof status === 'string' && status ? status : inner.tag
  }
  if (value.status === 'offer') {
    value.isGroup = fields.type === 'group' || Boolean(groupJid) || String(attrs.from || '').endsWith('@call')
    value.groupJid = groupJid
    value.isVideo = children.some(child => child?.tag === 'video')
    value.joinable = fields.joinable === '1' || fields.joinable === 'true'
    value.reRing = fields['re-ring'] === '1'
  }
  if (value.status === 'relaylatency') {
    const latency = fields.latency ?? fields.latency_ms ?? fields['latency-ms']
    if (latency !== undefined && latency !== '') {
      const ms = Number(latency)
      if (Number.isFinite(ms) && ms >= 0) value.latencyMs = ms
    }
  }
  return value
}

/** Grupo: a recusa pertence à chamada e vai para <call-id>@call. */
export function buildGroupCallRejectStanza(callId, callCreator, random = randomBytes) {
  if (typeof callId !== 'string' || !/^[A-Za-z0-9_-]{1,256}$/.test(callId)) {
    throw new TypeError('Identificador da chamada inválido')
  }
  if (typeof callCreator !== 'string' || !/^[^@\s]+@[^@\s]+$/.test(callCreator)) {
    throw new TypeError('Criador da chamada inválido')
  }
  const id = Buffer.from(random(16))
  if (id.length !== 16) throw new Error('Gerador de identificadores inválido')
  return {
    tag: 'call',
    attrs: { to: `${callId}@call`, id: id.toString('hex').toUpperCase() },
    content: [{
      tag: 'reject',
      attrs: { 'call-id': callId, 'call-creator': callCreator, count: '0' }
    }]
  }
}
