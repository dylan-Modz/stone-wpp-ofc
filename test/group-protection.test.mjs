import { EventEmitter } from 'node:events'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGroupProtectionMethods } from '../lib/Socket/group-protection.js'
import { createStoneAdditionalMethods } from '../lib/Socket/stone-features.js'

const jid = '123@g.us'
const alice = '111@s.whatsapp.net'
const bot = '222@s.whatsapp.net'
const tick = () => new Promise(resolve => setImmediate(resolve))

function mockSocket() {
  const ev = new EventEmitter()
  const actions = []
  const socket = {
    ev,
    user: { id: bot },
    authState: { creds: { me: { id: bot } } },
    groupMetadata: async () => ({
      participants: [{ id: bot, admin: 'admin' }, { id: alice, admin: null }],
      announce: false
    }),
    groupParticipantsUpdate: async (...args) => { actions.push(['remove', args]); return [{ status: '200' }] },
    groupSettingUpdate: async (...args) => { actions.push(['lock', args]) },
    sendMessage: async (...args) => { actions.push(['delete', args]) }
  }
  return { socket, ev, actions }
}
function msg(n, body, sender = alice) {
  return {
    key: { remoteJid: jid, participant: sender, id: 'id-' + n, fromMe: false },
    message: body,
    messageTimestamp: Math.floor(Date.now() / 1000)
  }
}

test('configura, consulta e desativa', async () => {
  const { socket } = mockSocket()
  const { groupProtection } = createGroupProtectionMethods(socket)
  assert.equal((await groupProtection(jid)).enabled, false)
  assert.equal((await groupProtection(jid, { enabled: true })).mode, 'alert')
  assert.equal((await groupProtection(jid)).enabled, true)
  assert.equal((await groupProtection(jid, { enabled: false })).enabled, false)
})

test('pagamentos são identificados sem punição por padrão', async () => {
  const { socket, ev, actions } = mockSocket()
  const api = createGroupProtectionMethods(socket)
  const alerts = []
  ev.on('group-protection.alert', item => alerts.push(item))
  await api.groupProtection(jid, { enabled: true })
  for (let n = 1; n <= 3; n++) {
    ev.emit('messages.upsert', { type: 'notify', messages: [msg(n, { sendPaymentMessage: { amount: 100 } })] })
  }
  await tick()
  assert.equal(alerts.filter(x => x.reason === 'payment').length, 3)
  assert.equal(alerts.at(-1).severity, 'high')
  assert.equal(actions.length, 0)
})

test('protect só executa com ataque confirmado e alvo verificável', async () => {
  const { socket, ev, actions } = mockSocket()
  const api = createGroupProtectionMethods(socket)
  await api.groupProtection(jid, { mode: 'protect' })
  ev.emit('messages.upsert', { type: 'notify', messages: [msg(1, { sendPaymentMessage: { amount: 1 } })] })
  await tick()
  assert.equal(actions.length, 0)
  for (let n = 2; n <= 3; n++) {
    ev.emit('messages.upsert', { type: 'notify', messages: [msg(n, { sendPaymentMessage: { amount: 1 } })] })
  }
  await tick()
  await tick()
  assert.equal(actions.filter(x => x[0] === 'remove').length, 1)
  assert.equal(actions.filter(x => x[0] === 'delete').length, 1)
  assert.equal(actions.filter(x => x[0] === 'lock').length, 1)
})

test('ciphertext e mensagens citadas não autorizam punição', async () => {
  const { socket, ev, actions } = mockSocket()
  const api = createGroupProtectionMethods(socket)
  const alerts = []
  ev.on('group-protection.alert', item => alerts.push(item))
  await api.groupProtection(jid, { mode: 'protect' })
  for (let i = 1; i <= 4; i++) {
    ev.emit('group-protection.ciphertext', { remoteJid: jid, participant: alice, messageId: 'cipher-' + i, decryptFail: 'hide' })
  }
  ev.emit('messages.upsert', {
    type: 'notify',
    messages: [msg(12, { extendedTextMessage: { contextInfo: { quotedMessage: { requestPaymentMessage: { amount: 5 } }, participant: alice, stanzaId: 'quoted-1' } } })]
  })
  await tick()
  assert.equal(actions.length, 0)
  assert.ok(alerts.some(item => item.reason === 'quoted-payment'))
  assert.ok(alerts.some(item => item.reason === 'invisible-suspected'))
  assert.ok(!alerts.some(item => item.reason === 'payment'))
})

test('editar aviso é opcional e não tenta falsificar o autor do ataque', async () => {
  const { socket, ev, actions } = mockSocket()
  let calls = 0
  socket.sendMessage = async (target, content) => {
    actions.push(['notice', { target, content }])
    calls++
    return { key: { remoteJid: target, id: 'bot-notice', fromMe: true } }
  }
  const api = createGroupProtectionMethods(socket)
  await api.groupProtection(jid, { mode: 'remove', editNotice: true })
  for (let i = 1; i <= 3; i++) {
    ev.emit('messages.upsert', { type: 'notify', messages: [msg(i, { requestPaymentMessage: { amount: 1 } })] })
  }
  await tick()
  await tick()
  assert.equal(calls, 3) // Primeiro aviso, deleção do ataque, edição do aviso
  assert.equal(actions.filter(a => a[0] === 'remove').length, 1)
  const noticeEdit = actions.find(a => a[0] === 'notice' && a[1].content.edit)
  assert.equal(noticeEdit[1].content.edit.id, 'bot-notice')
  assert.equal(noticeEdit[1].content.edit.fromMe, true)
})

test('monitores complementares não duplicam eventos', async () => {
  const { socket, ev } = mockSocket()
  const monitor = { ev: new EventEmitter() }
  const api = createGroupProtectionMethods(socket)
  const alerts = []
  ev.on('group-protection.alert', item => alerts.push(item))
  await api.groupProtection(jid, { monitors: [monitor] })
  const payment = msg(1, { orderMessage: { orderId: 'test' } })
  monitor.ev.emit('messages.upsert', { type: 'notify', messages: [payment] })
  ev.emit('messages.upsert', { type: 'notify', messages: [payment] })
  assert.equal(alerts.length, 1)
})

test('opções inválidas e administradores são preservados', async () => {
  const { socket, ev, actions } = mockSocket()
  const api = createGroupProtectionMethods(socket)
  await assert.rejects(api.groupProtection(jid, { messageBurst: 1 }), RangeError)
  await api.groupProtection(jid, { mode: 'remove' })
  for (let i = 1; i <= 14; i++) {
    ev.emit('messages.upsert', { type: 'notify', messages: [msg(i, { conversation: 'oi' }, bot)] })
  }
  await tick()
  assert.equal(actions.length, 0)
})

test('editMessage só permite editar mensagens próprias', async () => {
  const sock = { ev: new EventEmitter(), sendMessage: async (jid, content) => ({ key: { id: 'new-msg', remoteJid: jid, fromMe: true }, content }) }
  const api = createStoneAdditionalMethods(sock)
  await assert.rejects(api.editMessage(jid, { id: 'other-id', remoteJid: jid, fromMe: false }, 'teste'), TypeError)
  await assert.rejects(api.editMessage(jid, { id: 'own-id', remoteJid: 'other@g.us', fromMe: true }, 'teste'), TypeError)
  const edited = await api.editMessage(jid, { id: 'own-id', remoteJid: jid, fromMe: true }, 'corrigido')
  assert.equal(edited.content.text, 'corrigido')
  assert.equal(edited.content.edit.id, 'own-id')
  assert.equal(edited.content.edit.fromMe, true)
})

test('monitor não monitora grupos sem vínculo', async () => {
  const { socket, ev } = mockSocket()
  const monitor = { ev: new EventEmitter() }
  const api = createGroupProtectionMethods(socket)
  const alerts = []
  ev.on('group-protection.alert', alert => alerts.push(alert))
  await api.groupProtection('outro@g.us', { monitors: [monitor], mode: 'alert' })
  await api.groupProtection(jid, { enabled: true, mode: 'alert' })
  monitor.ev.emit('messages.upsert', {
    type: 'notify',
    messages: [msg(90, { requestPaymentMessage: { amount: 5 } })]
  })
  assert.equal(alerts.length, 0)
})
