import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { createStoneCalls } from './stone-calls.js'

function fakeStone() {
  const ev = new EventEmitter()
  const operations = []
  const socket = {
    ev,
    rejectCall: async (id, from) => { operations.push(['reject', id, from]) },
    createCallLink: async (type) => {
      operations.push(['link', type])
      return 'CallToken123'
    },
    sendGroupCallInvite: async (jid, opts) => {
      operations.push(['invite', jid, opts])
      return { groupJid: jid, url: 'https://call.whatsapp.com/voice/CallToken123' }
    }
  }
  return { socket, ev, operations }
}

test('usa eventos da conexão Stone e mantém identificador da chamada', () => {
  const { socket, ev } = fakeStone()
  const calls = createStoneCalls(socket)
  const events = []
  calls.on('incoming', c => events.push(c))
  ev.emit('call', [{
    id: 'offer-1', status: 'offer',
    chatId: '120363000@g.us', from: '5511999999999@s.whatsapp.net',
    isGroup: true, isVideo: false, groupJid: '120363000@g.us'
  }])
  assert.equal(events.length, 1)
  assert.equal(events[0].callId, 'offer-1')
  assert.equal(events[0].stateData.state, 'incoming_ringing')
  assert.equal(calls.getCalls().length, 1)
  assert.equal(calls.getCall('offer-1').groupJid, '120363000@g.us')
  assert.equal(calls.getCapabilities().sharedSocket, true)
  calls.destroy()
  assert.equal(ev.listenerCount('call'), 0)
})

test('recusa apenas chamada recebida válida e usa rejectCall do socket', async () => {
  const { socket, ev, operations } = fakeStone()
  const calls = createStoneCalls(socket)
  await assert.rejects(calls.rejectCall('not-known'), /não encontrada/)
  ev.emit('call', [{ id: 'one', status: 'offer', from: '5511111@s.whatsapp.net' }])
  await calls.rejectCall('one')
  assert.deepEqual(operations, [['reject', 'one', '5511111@s.whatsapp.net']])
  assert.equal(calls.getCall('one').stateData.state, 'ended')
  await assert.rejects(calls.rejectCall('one'), /não encontrada/)
  calls.destroy()
})

test('cria links e entrega convites por métodos reais da Stone', async () => {
  const { socket, operations } = fakeStone()
  const calls = createStoneCalls(socket)
  assert.equal(await calls.createCallLink('audio'), 'CallToken123')
  const result = await calls.sendGroupCallInvite('120363000@g.us', { type: 'audio' })
  assert.equal(result.groupJid, '120363000@g.us')
  assert.equal(operations.length, 2)
  await assert.rejects(calls.createCallLink('invalid'), /audio ou video/)
  calls.destroy()
})

test('operações VoIP ainda ausentes falham explicitamente, sem simular áudio', () => {
  const { socket } = fakeStone()
  const calls = createStoneCalls(socket)
  const capability = calls.getCapabilities()
  assert.equal(capability.liveAudio, false)
  assert.equal(capability.startCall, false)
  assert.equal(capability.groupCallStartExperimental, false)
  assert.equal(capability.groupCallConnectionVerified, false)
  for (const fn of ['startCall','acceptCall','joinCall','loadAudio','feedLiveAudio','setMute']) {
    assert.throws(() => calls[fn](), error => error?.code === 'STONE_CALL_MEDIA_NOT_IMPLEMENTED')
  }
  calls.destroy()
  assert.throws(() => calls.getCalls(), /encerrado/)
})

test('chamada em grupo é recusada na chamada @call sem alterar a sessão principal', async () => {
  const { socket, ev, operations } = fakeStone()
  socket.sendNode = async node => operations.push(['node', node])
  const calls = createStoneCalls(socket)
  ev.emit('call', [{
    id: 'ABCDEF123456', status: 'offer', from: '5511999999999@lid',
    callCreator: '5511999999999@lid', isGroup: true,
    groupJid: '12345@g.us', joinable: true, reRing: true
  }])
  assert.equal(calls.getCall('ABCDEF123456').joinable, true)
  await calls.rejectCall('ABCDEF123456')
  assert.equal(operations.length, 1)
  const sent = operations[0][1]
  assert.equal(sent.attrs.to, 'ABCDEF123456@call')
  assert.equal(sent.content[0].tag, 'reject')
  assert.equal(sent.content[0].attrs['call-creator'], '5511999999999@lid')
  assert.equal(calls.getCall('ABCDEF123456').stateData.state, 'ended')
  calls.destroy()
})
test('falha de envio mantém oferta para nova tentativa', async () => {
  const { socket, ev } = fakeStone()
  socket.sendNode = async () => { throw new Error('offline') }
  const calls = createStoneCalls(socket)
  ev.emit('call', [{ id: 'ABC123', status: 'offer', from: '123@lid', isGroup: true }])
  await assert.rejects(calls.rejectCall('ABC123'), /offline/)
  assert.equal(calls.getCall('ABC123').status, 'offer')
  calls.destroy()
})
