// Live Stone Gateway console. Only recent, bounded, in-memory previews.
// No authentication tokens, raw media blobs, QR codes or persistent message history.
const scrub = value => String(value ?? '')
  .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim().slice(0, 4096)

export function summarizePeer(jid) {
  const raw = String(jid || '')
  if (!raw) return 'Contato'
  if (raw.endsWith('@g.us')) return 'Grupo · ' + raw.slice(0, 3) + '••••'
  const digits = raw.split('@')[0].split(':')[0].replace(/\D/g, '')
  if (!digits) return 'Contato'
  return digits.length > 7
    ? digits.slice(0, 3) + '••••' + digits.slice(-4)
    : '••••' + digits.slice(-3)
}

export function getContactPhone(jid) {
  const value=String(jid || '')
  // A LID is not a telephone number. Never present an opaque LID as a phone.
  if (!value.endsWith('@s.whatsapp.net')) return ''
  const phone=value.split('@')[0].split(':')[0]
  return /^\d{8,15}$/.test(phone) ? phone : ''
}

export function describeContact(message) {
  const key=message?.key || {}
  const group=String(key.remoteJid||'').endsWith('@g.us')
  const jid=group
    ? (getContactPhone(key.participantAlt) ? key.participantAlt : key.participant)
    : (getContactPhone(key.remoteJidAlt) ? key.remoteJidAlt : key.remoteJid)
  const phone=getContactPhone(jid)
  // pushName is available on received messages, but not on every protocol event.
  // Names received from other clients are presentation data only, never HTML.
  const name=!key.fromMe && typeof message?.pushName==='string'
    ? scrub(message.pushName).slice(0,70) : ''
  const peer=name || (phone ? summarizePeer(jid) : (group?'Participante do grupo':'Contato'))
  return {peer,name,phone,maskedPhone:phone?summarizePeer(jid):''}
}

function unwrap(message) {
  let body = message?.message || {}
  for (let depth = 0; depth < 5; depth++) {
    const wrapper = body.ephemeralMessage || body.viewOnceMessage ||
      body.viewOnceMessageV2 || body.viewOnceMessageV2Extension ||
      body.documentWithCaptionMessage
    if (!wrapper?.message) break
    body = wrapper.message
  }
  return body
}

export function describeConsoleMessage(message) {
  const body = unwrap(message)
  let kind = 'outro', preview = '', media = false
  if (typeof body.conversation === 'string') {
    kind = 'texto'; preview = body.conversation
  } else if (body.extendedTextMessage) {
    kind = 'texto'; preview = body.extendedTextMessage.text
  } else if (body.imageMessage) {
    kind = 'imagem'; media = true; preview = body.imageMessage.caption
  } else if (body.videoMessage) {
    kind = body.videoMessage.gifPlayback ? 'gif' : 'vídeo'; media = true; preview = body.videoMessage.caption
  } else if (body.audioMessage) {
    kind = body.audioMessage.ptt ? 'áudio de voz' : 'áudio'; media = true
  } else if (body.stickerMessage) {
    kind = 'figurinha'; media = true
  } else if (body.documentMessage) {
    kind = 'documento'; media = true; preview = body.documentMessage.fileName || body.documentMessage.caption
  } else if (body.contactMessage || body.contactsArrayMessage) {
    kind = 'contato'
  } else if (body.locationMessage || body.liveLocationMessage) {
    kind = 'localização'
  } else if (body.reactionMessage) {
    kind = 'reação'; preview = body.reactionMessage.text
  } else if (body.pollCreationMessage || body.pollCreationMessageV3) {
    kind = 'enquete'
  } else if (body.protocolMessage) {
    kind = 'sistema'
  }
  return {kind,media,preview:scrub(preview),...describeContact(message)}
}

export function createConsoleFeed({capacity = 80, ttlMs = 15 * 60 * 1000, now = Date.now} = {}) {
  let counter = 0
  const entries = []
  const trim = () => {
    const cutoff = now() - ttlMs
    while (entries.length && (entries[0].at < cutoff || entries.length > capacity)) entries.shift()
  }
  function add({sessionId, direction, kind = 'sistema', peer = '', name = '', phone = '', maskedPhone = '', preview = '', detail = '', mediaAvailable = false}) {
    trim()
    const seq = ++counter
    entries.push({
      seq, at:now(), sessionId:String(sessionId || '').slice(0, 40),
      direction:['recebida','enviada','sistema'].includes(direction) ? direction : 'sistema',
      kind:scrub(kind).slice(0, 32), peer:scrub(peer).slice(0, 80),
      name:scrub(name).slice(0, 70), phone:getContactPhone(String(phone)+'@s.whatsapp.net'), maskedPhone:scrub(maskedPhone).slice(0, 30),
      preview:scrub(preview), detail:scrub(detail).slice(0, 160), mediaAvailable:Boolean(mediaAvailable)
    })
    trim()
    return seq
  }
  function setMediaAvailable(seq) {
    const entry = entries.find(item => item.seq === seq)
    if (entry) entry.mediaAvailable = true
  }
  function read({since = 0, includePreview = false} = {}) {
    trim()
    const cursor = Number.isSafeInteger(since) && since >= 0 ? since : 0
    const selected = cursor === 0
      ? entries.slice(-40)
      : entries.filter(item => item.seq > cursor).slice(-60)
    return {
      entries:selected.map(({at,preview,phone,...entry})=>({
        ...entry, timestamp:new Date(at).toISOString(),
        ...(includePreview && preview ? {preview} : {}),
        ...(includePreview && phone ? {phone} : {})
      })),
      cursor:counter,
      retentionMinutes:Math.round(ttlMs / 60000)
    }
  }
  return {add,read,setMediaAvailable}
}
