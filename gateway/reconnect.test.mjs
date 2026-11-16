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


test('terminal follows live received text/media and outgoing sends with previews opt-in',async()=>{
  const x=await setup()
  try{
    await x.manager.start('ao-vivo')
    x.sockets[0].ev.emit('connection.update',{connection:'open'})
    x.sockets[0].ev.emit('messages.upsert',{
      type:'notify',
      messages:[
        {key:{id:'RX1',remoteJid:'5511888888888@s.whatsapp.net',fromMe:false},message:{conversation:'mensagem privada teste'}},
        {key:{id:'RX2',remoteJid:'120363123456789@g.us',fromMe:false},message:{imageMessage:{caption:'legenda protegida',jpegThumbnail:Buffer.from('thumbnail-privada')}}}
      ]
    })
    await x.manager.send('ao-vivo','5511888888888@s.whatsapp.net','resposta de teste')
    const hidden=x.manager.getConsole()
    assert.equal(JSON.stringify(hidden).includes('mensagem privada teste'),false)
    assert.equal(JSON.stringify(hidden).includes('legenda protegida'),false)
    assert.equal(JSON.stringify(hidden).includes('5511888888888'),false)
    const visible=x.manager.getConsole({includePreview:true})
    assert.ok(visible.entries.some(x=>x.kind==='texto'&&x.preview==='mensagem privada teste'&&x.direction==='recebida'))
    assert.ok(visible.entries.some(x=>x.kind==='imagem'&&x.preview==='legenda protegida'))
    assert.ok(visible.entries.some(x=>x.kind==='texto'&&x.preview==='resposta de teste'&&x.direction==='enviada'))
    assert.equal(JSON.stringify(visible).includes('thumbnail-privada'),false)
    assert.equal(JSON.stringify(visible).includes('5511888888888'),false)
    const previous=visible.cursor
    x.sockets[0].ev.emit('messages.upsert',{
      type:'append',messages:[{key:{id:'OLD1',remoteJid:'5511888888888@s.whatsapp.net'},message:{conversation:'mensagem antiga que não deve aparecer'}}]
    })
    assert.equal(x.manager.getConsole({since:previous,includePreview:true}).entries.length,0,'ignore history sync')
  }finally{await x.cleanup()}
})


test('terminal uses pushName, phone alternates and contact cache instead of exposing LID',async()=>{
  const x=await setup()
  try{
    await x.manager.start('contato')
    x.sockets[0].ev.emit('connection.update',{connection:'open'})
    x.sockets[0].ev.emit('messages.upsert',{
      type:'notify',
      messages:[{pushName:'Maria',key:{
        id:'RX-LID-1',remoteJid:'38951729508382@lid',
        remoteJidAlt:'5511987654321@s.whatsapp.net',fromMe:false
      },message:{conversation:'mensagem de teste completa'}}]
    })
    const hidden=x.manager.getConsole().entries.find(e=>e.kind==='texto')
    assert.equal(hidden.name,'Maria')
    assert.equal(hidden.maskedPhone,'551••••4321')
    assert.equal(hidden.preview,undefined)
    assert.equal(hidden.phone,undefined)
    assert.equal(JSON.stringify(hidden).includes('38951729508382'),false)
    const visible=x.manager.getConsole({includePreview:true}).entries.find(e=>e.kind==='texto')
    assert.equal(visible.preview,'mensagem de teste completa')
    assert.equal(visible.phone,'5511987654321')

    x.sockets[0].ev.emit('contacts.upsert',[{
      id:'5511888888888@s.whatsapp.net',name:'Carlos da agenda'
    }])
    await x.manager.send('contato','5511888888888@s.whatsapp.net','resposta')
    const sent=x.manager.getConsole({includePreview:true}).entries.find(e=>e.direction==='enviada'&&e.kind==='texto')
    assert.equal(sent.name,'Carlos da agenda')
    assert.equal(sent.phone,'5511888888888')
  }finally{await x.cleanup()}
})

test('terminal marks eligible media as on-demand while view-once has no download action',async()=>{
  const x=await setup()
  try{
    await x.manager.start('media-teste')
    x.sockets[0].ev.emit('connection.update',{connection:'open'})
    x.sockets[0].ev.emit('messages.upsert',{
      type:'notify',messages:[
        {key:{id:'IMAGE1',remoteJid:'5511888888888@s.whatsapp.net'},
          message:{imageMessage:{
            mediaKey:Buffer.from('media-key'),directPath:'/media-path',
            mimetype:'image/jpeg',fileLength:104
          }}},
        {key:{id:'ONCE1',remoteJid:'5511888888888@s.whatsapp.net'},
          message:{viewOnceMessageV2:{message:{imageMessage:{
            mediaKey:Buffer.from('media-key'),directPath:'/media-path',
            mimetype:'image/jpeg',fileLength:104
          }}}}}
      ]
    })
    const records=x.manager.getConsole({includePreview:true}).entries.filter(e=>e.kind==='imagem')
    assert.equal(records.length,2)
    assert.equal(records[0].mediaAvailable,true)
    assert.equal(records[1].mediaAvailable,false)
    assert.equal(JSON.stringify(records).includes('/media-path'),false)
    assert.equal(JSON.stringify(records).includes('media-key'),false)
  }finally{await x.cleanup()}
})
