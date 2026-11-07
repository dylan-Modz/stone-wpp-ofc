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


/**
 * Primitivas de sinalização da Stone WPP.
 * Apenas montam nós binários e não iniciam nenhuma ligação nem transportam mídia.
 */
export function createStoneCallStanza({ to, tag, callId, callCreator, attrs = {}, content }, random = randomBytes) {
  if (typeof to !== 'string' || !/^[^@\s]+@[^@\s]+$/.test(to)) {
    throw new TypeError('Destino da sinalização inválido')
  }
  if (!['offer', 'preaccept', 'accept', 'terminate', 'reject'].includes(tag)) {
    throw new TypeError('Tipo da sinalização inválido')
  }
  if (typeof callId !== 'string' || !/^[A-Za-z0-9_-]{1,256}$/.test(callId)) {
    throw new TypeError('Identificador da chamada inválido')
  }
  if (typeof callCreator !== 'string' || !/^[^@\s]+@[^@\s]+$/.test(callCreator)) {
    throw new TypeError('Criador da chamada inválido')
  }
  if (!attrs || typeof attrs !== 'object' || Array.isArray(attrs) ||
      Object.keys(attrs).some(key => key === 'call-id' || key === 'call-creator' ||
        typeof attrs[key] !== 'string')) {
    throw new TypeError('Atributos da sinalização inválidos')
  }
  if (content !== undefined && (!Array.isArray(content) || content.some(x => !x || typeof x.tag !== 'string'))) {
    throw new TypeError('Conteúdo da sinalização inválido')
  }
  const bytes = Buffer.from(random(16))
  if (bytes.length !== 16) throw new Error('Gerador de identificadores inválido')
  const child = { tag, attrs: { 'call-id': callId, 'call-creator': callCreator, ...attrs } }
  if (content !== undefined) child.content = content
  return {
    tag: 'call',
    attrs: { to, id: bytes.toString('hex').toUpperCase() },
    content: [child]
  }
}

/**
 * Formato de mídia anunciado no protocolo (não cria codec nem transmite áudio).
 * A camada de mídia ainda precisa negociar transporte e chaves antes de uso real.
 */
export function createStoneCallMediaDescription(isVideo = false) {
  const nodes = [
    { tag: 'audio', attrs: { enc: 'opus', rate: '8000' } },
    { tag: 'audio', attrs: { enc: 'opus', rate: '16000' } }
  ]
  if (isVideo) {
    nodes.push({
      tag: 'video',
      attrs: {
        enc: 'h.264', dec: 'H264',
        screen_width: '1920', screen_height: '1080',
        device_orientation: '0'
      }
    })
  }
  nodes.push({ tag: 'net', attrs: { medium: '3' } })
  return nodes
}

/** Extrai o ID de um destino de grupo @call, sem expor o payload da oferta. */
export function parseStoneCallServerJid(jid) {
  if (typeof jid !== 'string' || !jid.endsWith('@call')) return null
  const id = jid.slice(0, -'@call'.length)
  return /^[A-Za-z0-9_-]{1,256}$/.test(id) ? id : null
}

/** Grupo: a recusa pertence à chamada e vai para <call-id>@call. */
export function buildGroupCallRejectStanza(callId, callCreator, random = randomBytes) {
  if (typeof callId !== 'string' || !/^[A-Za-z0-9_-]{1,256}$/.test(callId)) {
    throw new TypeError('Identificador da chamada inválido')
  }
  if (typeof callCreator !== 'string' || !/^[^@\s]+@[^@\s]+$/.test(callCreator)) {
    throw new TypeError('Criador da chamada inválido')
  }
  return createStoneCallStanza({
    to: `${callId}@call`, tag: 'reject', callId, callCreator,
    attrs: { count: '0' }
  }, random)
}
