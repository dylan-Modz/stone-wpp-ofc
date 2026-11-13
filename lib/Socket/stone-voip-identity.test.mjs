import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveStoneVoipSelfDeviceLid } from './stone-voip-identity.js'

test('conta vinculada conserva o índice PN do dispositivo no LID da oferta', () => {
  assert.equal(resolveStoneVoipSelfDeviceLid('55119999:24@s.whatsapp.net', '9000@lid', '9000@lid'), '9000:24@lid')
})
test('LID do roster sem sufixo não força o dispositivo principal', () => {
  assert.equal(resolveStoneVoipSelfDeviceLid('55119999:14@s.whatsapp.net', '9000:14@lid', '9000@lid'), '9000:14@lid')
})
test('LID autenticado contém dispositivo quando PN está sem sufixo', () => {
  assert.equal(resolveStoneVoipSelfDeviceLid('55119999@s.whatsapp.net', '9000:7@lid', '9000@lid'), '9000:7@lid')
})
test('conta principal usa LID da conta sem índice de dispositivo', () => {
  assert.equal(resolveStoneVoipSelfDeviceLid('55119999@s.whatsapp.net', '9000@lid', '9000@lid'), '9000@lid')
  assert.equal(resolveStoneVoipSelfDeviceLid('55119999:0@s.whatsapp.net', '9000@lid', '9000@lid'), '9000@lid')
})
test('sem LID conhecido, não inventa um LID a partir do telefone', () => {
  assert.equal(resolveStoneVoipSelfDeviceLid('55119999:24@s.whatsapp.net', '', ''), '')
})
