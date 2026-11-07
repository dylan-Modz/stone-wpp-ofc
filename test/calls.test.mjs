import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { createStoneCalls } from '../lib/Socket/stone-calls.js'

let lastClient
class FakeClient extends EventEmitter {
  constructor(opts) {
    super()
    lastClient = this
    this.options = opts
    this.calls = new Map()
    this.started = []
    this.played = []
    this.voip = {
      startCall: async options => {
        this.started.push(options)
        this.calls.set('call-1', { callId: 'call-1', stateData: { state: 'ringing' } })
        return 'call-1'
      },
      getCall: id => this.calls.get(id) ?? null,
      getCalls: () => [...this.calls.values()],
      acceptCall: async id => id,
      rejectCall: async id => id,
      joinCall: async id => id,
      leaveCall: async id => id,
      endCall: async id => id,
      setMute: (id, muted) => [id, muted],
      loadAudio: async (id, path) => { this.played.push([id, path]) },
      setExternalAudioMode: () => {},
      feedLiveAudio: (_, pcm) => pcm.length,
      getLiveBufferMs: () => 0,
      getFeedWatermarksMs: () => ({ pauseMs: 200, resumeMs: 50 })
    }
  }
  async connect() {
    this.emit('auth_qr', { qr: 'test-qr' })
    this.emit('connection', { status: 'connected' })
  }
  async disconnect() { this.closed = true }
}
const calls = () => createStoneCalls({
  engineLoader: async () => ({
    createStore: x => x,
    createPinoLogger: async () => ({}),
    createSqliteStore: x => x,
    voipPlugin: x => x,
    WaClient: FakeClient
  })
})

test('sessão de chamadas usa QR próprio e inicia chamada em grupo', async () => {
  const c = calls()
  const qrs = []
  c.on('qr', ev => qrs.push(ev.qr))
  await c.connect({ authPath: '/tmp/stone-test-call.sqlite' })
  assert.deepEqual(qrs, ['test-qr'])
  assert.throws(() => c.startGroupCall('123@g.us', []), /participante/)
  const id = await c.startGroupCall('123@g.us', ['123@lid'])
  assert.equal(id, 'call-1')
  assert.deepEqual(lastClient.started[0], {
    groupJid: '123@g.us', participants: [{ jid: '123@lid' }], isVideo: false
  })
  const playback = c.playAudio(id, '/tmp/music.mp3')
  lastClient.calls.get(id).stateData.state = 'active'
  lastClient.emit('voip_call_state', lastClient.calls.get(id))
  await playback
  assert.deepEqual(lastClient.played, [['call-1', '/tmp/music.mp3']])
  await c.disconnect()
  assert.equal(lastClient.closed, true)
})

test('valida JIDs, PCM e permissões da sessão', async () => {
  const c = calls()
  await c.connect({ authPath: '/tmp/stone-test-call.sqlite' })
  assert.throws(() => c.feedLiveAudio('call', Buffer.from([])), /Float32Array/)
  assert.throws(() => c.startGroupCall('123@g.us', ['badjid']), /JID/)
  assert.equal(c.feedLiveAudio('call', new Float32Array(960)), 960)
  await c.disconnect()
})

test('espera por áudio é cancelada quando a sessão é desconectada', async () => {
  const c = calls()
  await c.connect({ authPath: '/tmp/stone-test-call.sqlite' })
  const id = await c.startCall('5511999999999@s.whatsapp.net')
  const pending = c.playAudio(id, '/tmp/music.mp3')
  await c.disconnect()
  await assert.rejects(pending, /desconectada/)
})

test('nomes públicos startCall(options) e loadAudio() seguem o propósito da função', async () => {
  const c = calls()
  await c.connect({ authPath: '/tmp/stone-calls-signatures.sqlite' })
  const id = await c.startCall({ groupJid: '123@g.us', participants: [{ jid: '123@lid' }] })
  assert.equal(id, 'call-1')
  assert.equal(lastClient.started[0].groupJid, '123@g.us')
  lastClient.calls.get(id).stateData.state = 'active'
  await c.loadAudio(id, '/tmp/voice.wav')
  assert.deepEqual(lastClient.played, [['call-1', '/tmp/voice.wav']])
  await c.disconnect()
})
