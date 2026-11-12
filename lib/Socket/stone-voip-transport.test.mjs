import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveStoneVoipTransport } from './stone-voip-transport.js'

test('usa WebRTC quando o módulo nativo está carregável', async () => {
  const state = await resolveStoneVoipTransport({}, async () => ({
    RTCPeerConnection: class RTCPeerConnection {}
  }))
  assert.deepEqual(state, { kind: 'webrtc', fallback: false, warning: null })
})

test('modo UDP explícito não tenta importar módulo nativo', async () => {
  const state = await resolveStoneVoipTransport(
    { useRawUdpTransport: true },
    async () => { throw new Error('não deveria carregar WebRTC') }
  )
  assert.equal(state.kind, 'raw-udp')
  assert.equal(state.fallback, false)
})

test('host sem WebRTC usa fallback UDP e informa o motivo', async () => {
  const state = await resolveStoneVoipTransport({}, async () => {
    const error = new Error('Cannot find package')
    error.code = 'ERR_MODULE_NOT_FOUND'
    throw error
  })
  assert.equal(state.kind, 'raw-udp')
  assert.equal(state.fallback, true)
  assert.equal(state.warning.code, 'STONE_VOIP_WEBRTC_MISSING')
})

test('é possível proibir fallback UDP e obter erro explícito', async () => {
  await assert.rejects(
    resolveStoneVoipTransport({ rawUdpFallback: false }, async () => ({})),
    error => error.code === 'STONE_VOIP_WEBRTC_LOAD_FAILED'
  )
})
