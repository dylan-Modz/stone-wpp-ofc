import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LIDMappingStore } from '../lib/Signal/lid-mapping.js'
import { createStoneAdditionalMethods } from '../lib/Socket/stone-features.js'
import { EventEmitter } from 'node:events'

const logger = { trace() {}, debug() {}, warn() {} }

test('USync com PN de dispositivo não quebra a conversão de LID', async () => {
  const keys = {
    get: async () => ({}),
    set: async () => {},
    transaction: async (fn) => fn()
  }
  const store = new LIDMappingStore(keys, logger, async () => [
    { pn: '5511999999999:1@s.whatsapp.net', lid: '123456@lid' }
  ])
  const pairs = await store.getLIDsForPNs(['5511999999999:1@s.whatsapp.net'])
  assert.deepEqual(pairs, [
    { pn: '5511999999999:1@s.whatsapp.net', lid: '123456:1@lid' }
  ])
})

test('diagnósticos consultam a sessão sem modificar chaves', async () => {
  const ev = new EventEmitter()
  let validations = 0
  const socket = {
    ev,
    signalRepository: {
      lidMapping: {
        getLIDForPN: async () => '123456@lid',
        getPNForLID: async () => '5511999999999@s.whatsapp.net'
      },
      validateSession: async () => { validations++; return { exists: true } }
    }
  }
  const methods = createStoneAdditionalMethods(socket)
  assert.deepEqual(await methods.resolveJidMapping('5511999999999@s.whatsapp.net'), {
    input: '5511999999999@s.whatsapp.net',
    pn: '5511999999999@s.whatsapp.net', lid: '123456@lid', resolved: true
  })
  assert.deepEqual(await methods.resolveJidMapping('123456@lid'), {
    input: '123456@lid',
    pn: '5511999999999@s.whatsapp.net', lid: '123456@lid', resolved: true
  })
  assert.deepEqual(await methods.inspectSignalSession('123456@lid'), { jid: '123456@lid', exists: true })
  assert.equal(validations, 1)
})
