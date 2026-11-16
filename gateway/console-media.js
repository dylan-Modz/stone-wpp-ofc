import { downloadContentFromMessage } from '../lib/Utils/messages-media.js'

const MEDIA_TYPES = {
  imageMessage: { type: 'image', kind: 'imagem', mime: 'image/jpeg', extension: 'jpg' },
  videoMessage: { type: 'video', kind: 'vídeo', mime: 'video/mp4', extension: 'mp4' },
  audioMessage: { type: 'audio', kind: 'áudio', mime: 'audio/ogg', extension: 'ogg' },
  stickerMessage: { type: 'sticker', kind: 'figurinha', mime: 'image/webp', extension: 'webp' },
  documentMessage: { type: 'document', kind: 'documento', mime: 'application/octet-stream', extension: 'bin' }
}
const MIME_TYPES = {
  image: { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' },
  video: { 'video/mp4': 'mp4', 'video/webm': 'webm' },
  audio: { 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/aac': 'aac', 'audio/wav': 'wav', 'audio/webm': 'webm' },
  sticker: { 'image/webp': 'webp' },
  document: {}
}
const error = (code, status) => Object.assign(new Error(code), {status})

function descriptor(message) {
  // Only ordinary media messages. Never expose view-once, disappearing or
  // wrapped messages through the preview route.
  const body = message?.message
  if (!body || typeof body !== 'object' ||
      body.viewOnceMessage || body.viewOnceMessageV2 ||
      body.viewOnceMessageV2Extension || body.ephemeralMessage) return null
  for (const [field, spec] of Object.entries(MEDIA_TYPES)) {
    const media = body[field]
    if (!media || typeof media !== 'object') continue
    if (!media.mediaKey || !(media.directPath || media.url)) return null
    const length = Number(media.fileLength ?? 0)
    return {
      spec, payload: { mediaKey: media.mediaKey, directPath: media.directPath, url: media.url },
      length: Number.isFinite(length) && length >= 0 ? length : 0,
      mime: typeof media.mimetype === 'string' ? media.mimetype.split(';')[0].trim().toLowerCase() : ''
    }
  }
  return null
}

export function createConsoleMediaStore({
  now = Date.now, ttlMs = 15 * 60 * 1000, capacity = 80,
  maxBytes = 20 * 1024 * 1024,
  download = downloadContentFromMessage
} = {}) {
  const records = new Map()
  function prune() {
    const expire = now() - ttlMs
    for (const [seq, info] of records) if (info.at < expire) records.delete(seq)
    while (records.size > capacity) records.delete(records.keys().next().value)
  }
  function register(seq, message) {
    if (!Number.isSafeInteger(seq) || seq < 1) return false
    const info = descriptor(message)
    if (!info) return false
    prune()
    records.set(seq, {...info, at: now()})
    prune()
    return true
  }
  async function read(seq) {
    prune()
    const info = records.get(seq)
    if (!info) throw error('console_media_expired_or_unavailable', 404)
    if (info.length > maxBytes) throw error('console_media_too_large', 413)
    const {spec} = info
    let stream
    try { stream = await download(info.payload, spec.type) }
    catch { throw error('console_media_not_available', 502) }
    const chunks=[]
    let total=0
    try {
      for await (const chunk of stream) {
        total += chunk.length
        if (total > maxBytes) {
          stream.destroy?.()
          throw error('console_media_too_large', 413)
        }
        chunks.push(Buffer.from(chunk))
      }
    } catch (e) {
      if (e.status === 413) throw e
      throw error('console_media_not_available', 502)
    }
    const permitted = MIME_TYPES[spec.type] || {}
    const extension = permitted[info.mime] || spec.extension
    const mime = permitted[info.mime] ? info.mime : spec.mime
    return {
      bytes: Buffer.concat(chunks, total), mime,
      filename: 'stone-midia.' + extension,
      inline: spec.type !== 'document'
    }
  }
  return {register,read}
}
