import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createSessionManager } from './session-manager.js'
import { DisconnectReason } from '../lib/index.js'

async function setup(options = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'stone-gateway-pair-'))
  const sockets = []
  const authStates = []
  const socketFactory = ({ auth }) => {
    const socket = {
      ev: new EventEmitter(),
      auth,
      user: { id: '5511888888888@s.whatsapp.net' },
      end: async () => {},
      waitForSocketOpen: async () => {},
      requestPairingCode: async () => 'PAIRCODE',
      sendMessage: async () => ({ key: { id: 'M1' } })
    }
    sockets.push(socket)
    return socket
  }
  const authFactory = async () => {
    const state = { creds: {} }
    authStates.push(state)
    return { state, saveCreds: async () => {} }
  }
  const manager = await createSessionManager({
    dataDir: dir, socketFactory, authFactory,
    logger: { warn() {} },
    reconnectDelayMs: () => 5,
    connectionTimeoutMs: 500,
    maxReconnectAttempts: 2,
    ...options
  })
  return { dir, sockets, authStates, manager,
    cleanup: async () => { await manager.shutdown(); await rm(dir, { recursive: true, force: true }) } }
}
async function eventually(fn, timeoutMs = 300) {
  const start = Date.now()
  while (!fn()) {
    if (Date.now() - start > timeoutMs) throw Error('expected_condition_not_met')
    await new Promise(resolve => setTimeout(resolve, 5))
  }
}
const close = (socket, code) => socket.ev.emit('connection.update', {
  connection: 'close', lastDisconnect: { error: { output: { statusCode: code } } }
})

test('pair-success restart creates another socket with the same credentials and reaches open', async () => {
  const x = await setup()
  try {
    await x.manager.start('conta1')
    const auth = x.sockets[0].auth
    const pair = await x.manager.pair('conta1', '5511888888888')
    assert.equal(pair.code, 'PAIRCODE')
    x.sockets[0].ev.emit('connection.update', { isNewLogin: true })
    assert.equal(x.manager.list()[0].status, 'pairing')
    close(x.sockets[0], DisconnectReason.restartRequired)
    assert.equal(x.manager.list()[0].status, 'reconnecting')
    await eventually(() => x.sockets.length === 2)
    assert.equal(x.sockets[1].auth, auth, 'signed in-memory credentials must survive the restart')
    x.sockets[1].ev.emit('connection.update', { connection: 'open' })
    const state = x.manager.list()[0]
    assert.equal(state.status, 'open')
    assert.equal(state.lastError, null)
    assert.equal(state.reconnectAttempts, 0)
  } finally { await x.cleanup() }
})

test('a revoked session shows a reason and does not retry automatically', async () => {
  const x = await setup()
  try {
    await x.manager.start('conta2')
    close(x.sockets[0], DisconnectReason.loggedOut)
    await new Promise(resolve => setTimeout(resolve, 25))
    const state = x.manager.list()[0]
    assert.equal(state.status, 'error')
    assert.equal(state.disconnectCode, DisconnectReason.loggedOut)
    assert.match(state.lastError, /desvinculada/)
    assert.equal(x.sockets.length, 1)
  } finally { await x.cleanup() }
})

test('a connection timeout gives a finite diagnostic rather than connecting forever', async () => {
  const x = await setup({ connectionTimeoutMs: 15, maxReconnectAttempts: 0 })
  try {
    await x.manager.start('conta3')
    await eventually(() => x.manager.list()[0].status === 'error')
    assert.match(x.manager.list()[0].lastError, /tentativas|limite|conexão/)
  } finally { await x.cleanup() }
})

test('two Gateway instances cannot share the same persistent credentials folder', async () => {
  const x = await setup()
  try {
    await assert.rejects(
      createSessionManager({
        dataDir: x.dir, socketFactory: () => { throw Error('must not open') },
        authFactory: async () => ({ state: {}, saveCreds() {} })
      }),
      /gateway_data_directory_in_use/
    )
  } finally { await x.cleanup() }
  const reopened = await createSessionManager({
    dataDir: x.dir,
    socketFactory: () => ({ ev: new EventEmitter() }),
    authFactory: async () => ({ state: {}, saveCreds() {} })
  })
  await reopened.shutdown()
})

test('pause preserves credentials and restore keeps the session suspended', async () => {
  const x = await setup()
  let restored
  try {
    await x.manager.start('conta-pausada')
    const dir = path.join(x.dir, 'sessions', 'conta-pausada')
    await (await import('node:fs/promises')).writeFile(path.join(dir, 'creds.json'), '{"saved":true}')
    const result = await x.manager.pause('conta-pausada')
    assert.equal(result.status, 'paused')
    assert.equal(x.manager.list()[0].status, 'paused')
    await x.manager.shutdown()
    restored = await createSessionManager({
      dataDir:x.dir,logger:{warn(){}},socketFactory:({auth})=>({auth,ev:new EventEmitter(),end:async()=>{},user:{id:'5511888888888@s.whatsapp.net'}}),
      authFactory:async()=>({state:{creds:{account:true,me:{id:'5511888888888@s.whatsapp.net'}}},saveCreds:async()=>{}}),
      connectionTimeoutMs:500
    })
    await restored.restore()
    assert.equal(restored.list()[0].status,'paused')
    assert.equal(restored.list()[0].user,'5511888888888@s.whatsapp.net')
    assert.equal((await (await import('node:fs/promises')).readFile(path.join(dir,'creds.json'),'utf8')),'{"saved":true}')
    const stopAgain=await restored.pause('conta-pausada')
    assert.equal(stopAgain.status,'paused')
  } finally {
    await restored?.shutdown()
    await x.cleanup()
  }
})

test('operational feed records connection and accepted send without message content or numbers',async()=>{
  const x=await setup()
  try{
    await x.manager.start('evento1')
    x.sockets[0].ev.emit('connection.update',{connection:'open'})
    await x.manager.send('evento1','5511888888888@s.whatsapp.net','mensagem privada 123')
    const events=x.manager.getActivity()
    assert.ok(events.some(event=>event.event==='open'))
    assert.ok(events.some(event=>event.event==='sent'))
    const payload=JSON.stringify(events)
    assert.equal(payload.includes('mensagem privada 123'),false)
    assert.equal(payload.includes('5511888888888'),false)
  }finally{await x.cleanup()}
})
