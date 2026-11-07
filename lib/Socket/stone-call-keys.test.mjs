import { test } from 'node:test'
import assert from 'node:assert/strict'
import { collectCallKeyEnvelopes, decryptIncomingCallKey, encryptCallKeyForDevices } from './stone-call-keys.js'

test('empacota a chave no protocolo da Stone e descriptografa a oferta', async () => {
  const key = Buffer.alloc(32, 0x41)
  const jid = '123:1@lid'
  let ensured = false
  const signal = {
    encryptMessage: async ({ jid: target, data }) => {
      assert.equal(target, jid)
      return { type: 'msg', ciphertext: Buffer.from(data) }
    },
    decryptMessage: async ({ jid: from, type, ciphertext }) => {
      assert.equal(from, jid)
      assert.equal(type, 'msg')
      return Buffer.from(ciphertext)
    }
  }
  const result = await encryptCallKeyForDevices(signal, async list => {
    ensured = true
    assert.deepEqual(list, [jid])
  }, [jid], key)
  assert.ok(ensured)
  assert.equal(result.requiresDeviceIdentity, false)
  const offer = { tag:'call', content:[{ tag:'offer',attrs:{},content:[
    { tag:'destination',content:result.destinations }
  ]}]}
  assert.equal(collectCallKeyEnvelopes(offer).length,1)
  assert.deepEqual(await decryptIncomingCallKey(signal, offer, jid), key)
})

test('falhas isoladas e envelopes inválidos não liberam material sensível', async () => {
  const signal = {
    encryptMessage: async () => ({ type:'pkmsg', ciphertext:Buffer.from([1,2]) }),
    decryptMessage: async () => { throw new Error('not for this device') }
  }
  const result = await encryptCallKeyForDevices(signal, async () => {},
    ['1@lid'],Buffer.alloc(32,7))
  assert.equal(result.requiresDeviceIdentity,true)
  const offer = {tag:'offer',content:[{tag:'destination',content:result.destinations}]}
  assert.equal(await decryptIncomingCallKey(signal,offer,'2@lid'),null)
  await assert.rejects(() => encryptCallKeyForDevices(signal,async()=>{},
    ['1@lid'],Buffer.alloc(12)),/32 bytes/)
  assert.deepEqual(collectCallKeyEnvelopes({tag:'offer',content:[
    {tag:'enc',attrs:{type:'invalid'},content:Buffer.from([1])}
  ]}),[])
})
