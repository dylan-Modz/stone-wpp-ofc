import http from 'node:http'
import { timingSafeEqual } from 'node:crypto'

function respond(res, status, data, extra = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', ...extra })
  res.end(JSON.stringify(data))
}
async function readJSON(req) {
  if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) {
    throw Object.assign(new Error('content_type_must_be_json'), { status: 415 })
  }
  let size = 0, chunks = []
  for await (const chunk of req) {
    size += chunk.length
    if (size > 16384) throw Object.assign(new Error('request_too_large'), { status: 413 })
    chunks.push(chunk)
  }
  try {
    const obj = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw Error('invalid')
    return obj
  } catch { throw Object.assign(new Error('invalid_json'), { status: 400 }) }
}
function equal(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const x = Buffer.from(a), y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}
export function createGatewayHttpServer({ manager, token, origins = [] } = {}) {
  if (!manager) throw new TypeError('manager_required')
  if (typeof token !== 'string' || token.length < 24) throw new Error('STONE_API_TOKEN must contain at least 24 characters')
  const allowed = new Set(origins.map(s => new URL(s).origin))
  return http.createServer(async (req, res) => {
    const origin = req.headers.origin
    if (origin && allowed.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Vary', 'Origin')
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS')
    } else if (origin) return respond(res, 403, { error: 'origin_not_allowed' })
    if (req.method === 'OPTIONS') return respond(res, 204, {})
    const auth = String(req.headers.authorization || '')
    if (!auth.startsWith('Bearer ') || !equal(auth.slice(7), token)) return respond(res, 401, { error: 'unauthorized' })
    let p
    try { p = new URL(req.url, 'http://localhost').pathname }
    catch { return respond(res, 400, { error: 'bad_url' }) }
    try {
      if (p === '/v1/health' && req.method === 'GET') return respond(res, 200, { ok: true, service: 'stone-gateway', uptime: Math.floor(process.uptime()) })
      if (p === '/v1/sessions') {
        if (req.method === 'GET') return respond(res, 200, { sessions: manager.list() })
        if (req.method === 'POST') return respond(res, 201, await manager.start((await readJSON(req)).id))
      }
      if (p === '/v1/webhook') {
        if (req.method === 'GET') return respond(res, 200, manager.getWebhook())
        if (req.method === 'PUT') return respond(res, 200, await manager.setWebhook(await readJSON(req)))
      }
      const match = p.match(/^\/v1\/sessions\/([a-zA-Z0-9_-]{1,40})(?:\/(pair|messages))?$/)
      if (match) {
        const [, id, action] = match
        if (!action && req.method === 'GET') return respond(res, 200, await manager.get(id))
        if (action === 'pair' && req.method === 'POST') return respond(res, 200, await manager.pair(id, (await readJSON(req)).phoneNumber))
        if (action === 'messages' && req.method === 'POST') {
          const body = await readJSON(req)
          return respond(res, 200, await manager.send(id, body.to, body.text))
        }
      }
      return respond(res, 404, { error: 'not_found' })
    } catch (error) {
      const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 600 ? error.status : 500
      return respond(res, status, { error: status === 500 ? 'internal_error' : error.message })
    }
  })
}
