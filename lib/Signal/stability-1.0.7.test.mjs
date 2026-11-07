import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LIDMappingStore } from './lid-mapping.js'
import { createStoneAdditionalMethods } from '../Socket/stone-features.js'
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

test('convite de voz para grupo utiliza link oficial e confirma o envio', async () => {
  const actions = []
  const socket = {
    ev: new EventEmitter(),
    createCallLink: async (type) => { actions.push(['create', type]); return 'abcDEF1234' },
    sendMessage: async (jid, content) => {
      actions.push(['send', jid, content])
      return { key: { id: 'message-1', remoteJid: jid }, message: content }
    }
  }
  const api = createStoneAdditionalMethods(socket)
  const result = await api.sendGroupCallInvite('120363000123456@g.us')
  assert.equal(result.url, 'https://call.whatsapp.com/voice/abcDEF1234')
  assert.equal(result.type, 'audio')
  assert.deepEqual(actions.map(x => x[0]), ['create', 'send'])
  assert.match(actions[1][2].text, /https:\/\/call\.whatsapp\.com\/voice\/abcDEF1234/)
  assert.equal(result.message.key.id, 'message-1')
})

test('convite de vídeo respeita a legenda e não envia para conversas privadas', async () => {
  const actions = []
  const socket = {
    ev: new EventEmitter(),
    createCallLink: async type => { actions.push(type); return 'VideoLink987' },
    sendMessage: async (_, content) => {
      actions.push(content.text)
      return { key: { id: 'message-2' } }
    }
  }
  const api = createStoneAdditionalMethods(socket)
  await assert.rejects(() => api.sendGroupCallInvite('111@s.whatsapp.net'), /grupo válido/)
  assert.equal(actions.length, 0)
  const result = await api.sendGroupCallInvite('123@g.us', { type: 'video', text: 'Reunião da equipe' })
  assert.equal(result.url, 'https://call.whatsapp.com/video/VideoLink987')
  assert.match(actions[1], /^Reunião da equipe\nhttps:\/\/call\.whatsapp\.com\/video\//)
})

test('convite não declara sucesso quando o link ou o envio falham', async () => {
  const socket = {
    ev: new EventEmitter(),
    createCallLink: async () => undefined,
    sendMessage: async () => { throw new Error('não deve enviar') }
  }
  const api = createStoneAdditionalMethods(socket)
  await assert.rejects(() => api.sendGroupCallInvite('123@g.us'), /token válido/)
  socket.createCallLink = async () => 'Token123456'
  socket.sendMessage = async () => undefined
  await assert.rejects(() => api.sendGroupCallInvite('123@g.us'), /não confirmou/)
  await assert.rejects(() => api.sendGroupCallInvite('123@g.us', { type: 'invalid' }), /audio ou video/)
})
