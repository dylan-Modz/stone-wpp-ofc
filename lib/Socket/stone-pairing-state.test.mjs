import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hasCompletedStonePairing } from './stone-pairing-state.js'

test('a phone number saved during pairing is not an authenticated account', () => {
  assert.equal(hasCompletedStonePairing({me:{id:'5511988888888@s.whatsapp.net'},pairingCode:'ABCD1234',registered:false}),false)
  assert.equal(hasCompletedStonePairing({me:{id:'5511988888888@s.whatsapp.net'},registered:true}),false)
  assert.equal(hasCompletedStonePairing({}),false)
})
test('a verified paired account remains authenticated even with legacy registered=false', () => {
  assert.equal(hasCompletedStonePairing({me:{id:'123:12@s.whatsapp.net'},account:{accountSignatureKey:Buffer.from('sig')},registered:false}),true)
})
