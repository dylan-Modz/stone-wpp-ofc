import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createStoneVoipBridge } from './stone-voip-bridge.js'

test('VoIP não inicializa num socket sem autenticação nem criptografia', async () => {
  await assert.rejects(createStoneVoipBridge({ ws: {on(){}}, sendNode(){} }), /Socket Stone/)
})
