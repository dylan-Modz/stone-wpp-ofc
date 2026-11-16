import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { mkdtemp, mkdir, writeFile, access, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createSessionManager } from './session-manager.js'

const flush = async predicate => {
  for (let i = 0; i < 60; i++) {
    if (await predicate()) return
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  throw new Error('expected condition did not happen')
}

test('a 401 session is skipped at next startup without deleting credentials', async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'stone-quiet-gateway-'))
  const sockets = []
  const warnings = []
  const logger = { warn(message) { warnings.push(message) } }
  const socketFactory = ({ auth }) => {
    const socket = { auth, ev: new EventEmitter(), end: async () => {} }
    sockets.push(socket)
    return socket
  }
  const authFactory = async () => ({ state: { creds: {} }, saveCreds: async () => {} })
  let first, second
  try {
    first = await createSessionManager({ dataDir, socketFactory, authFactory, logger })
    await first.start('antiga')
    const dir = path.join(dataDir, 'sessions', 'antiga')
    await writeFile(path.join(dir, 'creds.json'), '{"dummy":true}')
    sockets[0].ev.emit('connection.update', {
      connection: 'close',
      lastDisconnect: { error: { output: { statusCode: 401 } } }
    })
    const marker = path.join(dir, '.stone-relink-required.json')
    await flush(async () => { try { await access(marker); return true } catch { return false } })
    assert.equal(JSON.parse(await readFile(marker, 'utf8')).disconnectCode, 401)
    assert.equal(first.list()[0].status, 'error')
    await first.shutdown()
    first = null

    second = await createSessionManager({ dataDir, socketFactory, authFactory, logger })
    await second.restore()
    assert.equal(sockets.length, 1, 'rejected credentials should not start another socket')
    assert.equal(second.list().length, 0)
    assert.equal((await readFile(path.join(dir, 'creds.json'), 'utf8')), '{"dummy":true}')

    await second.start('antiga')
    assert.equal(sockets.length, 2, 'an operator can explicitly retry the session')
    await assert.rejects(access(marker), error => error.code === 'ENOENT')
    assert.ok(warnings.some(item => String(item).includes('ignorada na inicialização')))
  } finally {
    await second?.shutdown()
    await first?.shutdown()
    await rm(dataDir, { recursive: true, force: true })
  }
})
