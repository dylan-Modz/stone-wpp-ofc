import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { createStoneAdditionalMethods } from '../lib/Socket/stone-features.js'

function createSocket() {
  const ev = new EventEmitter()
  const calls = []
  const socket = {
    ev,
    async executeUSyncQuery(query) {
      calls.push({ kind: 'username', query })
      return { list: [{ id: '12345@lid', contact: true }] }
    },
    async chatModify(mod, jid) {
      calls.push({ kind: 'chatModify', mod, jid })
      return true
    },
    async sendMessage(jid, message, options) {
      calls.push({ kind: 'message', jid, message, options })
      return { key: { id: 'sent-id' } }
    },
    async relayMessage(jid, message, options) {
      calls.push({ kind: 'relay', jid, message, options })
      return 'relay-id'
    },
    async addLabel(jid, label) {
      calls.push({ kind: 'label', jid, label })
      return true
    }
  }
  return { methods: createStoneAdditionalMethods(socket), calls, ev }
}

const jid = '5511999999999@s.whatsapp.net'

test('sendPixKeyMessage envia native-flow com chave Pix', async () => {
  const { methods, calls } = createSocket()
  const result = await methods.sendPixKeyMessage(jid, {
    keyType: 'PHONE', key: '5511988887777', name: 'Loja Stone'
  })
  assert.equal(result.key.id, 'sent-id')
  assert.equal(calls[0].message.interactive.messageVersion, 1)
  const button = calls[0].message.interactive.buttons[0]
  assert.equal(button.name, 'payment_info')
  const payload = JSON.parse(button.buttonParamsJson)
  assert.equal(payload.payment_settings[0].pix_static_code.key, '5511988887777')
  assert.equal(payload.currency, 'BRL')
  assert.equal(payload.order.order_type, 'ORDER_WITHOUT_AMOUNT')
})

test('Pix rejeita chave ou tipo inválido antes de enviar', async () => {
  const { methods, calls } = createSocket()
  await assert.rejects(methods.sendPixKeyMessage(jid, {keyType:'BAD', name:'Loja', key:'abc'}), TypeError)
  await assert.rejects(methods.sendPixKeyMessage(jid, {keyType:'PHONE',name:'',key:'abc'}), TypeError)
  assert.equal(calls.length, 0)
})

test('keepMessage cria payload KeepInChat de manter e desfazer', async () => {
  const { methods, calls } = createSocket()
  const key = { remoteJid: jid, id: 'msg-1', fromMe: false }
  assert.equal(await methods.keepMessage(jid, key, true), 'relay-id')
  assert.equal(calls[0].message.keepInChatMessage.keepType, 1)
  await methods.keepMessage(jid, key, false)
  assert.equal(calls[1].message.keepInChatMessage.keepType, 2)
  await assert.rejects(methods.keepMessage('outro@g.us', key, true), TypeError)
})

test('editLabel e deleteLabel usam app-state existente', async () => {
  const { methods, calls } = createSocket()
  await methods.editLabel('1', { name: 'VIP', color: 2 })
  await methods.deleteLabel('1')
  assert.deepEqual(calls[0].label, { id:'1',name:'VIP',color:2,deleted:false })
  assert.deepEqual(calls[1].label, { id:'1',deleted:true })
  await assert.rejects(methods.editLabel('1',{color:20}), TypeError)
})

test('lista de etiquetas reflete eventos observados e exclusões', () => {
  const { methods, ev } = createSocket()
  assert.deepEqual(methods.getLabels(), [])
  ev.emit('labels.edit',{id:'1',name:'VIP',color:2,deleted:false})
  assert.equal(methods.getLabelById('1').name,'VIP')
  assert.equal(methods.getLabels().length,1)
  ev.emit('labels.edit',{id:'1',deleted:true})
  assert.equal(methods.getLabelById('1'),undefined)
  assert.equal(methods.getLabels().length,0)
})

test('queryUsernameExists usa USync com contato username, retorna LID', async () => {
  const { methods, calls } = createSocket()
  const user = await methods.queryUsernameExists('@teste_abc', '1234')
  assert.equal(user.jid, '12345@lid')
  const sync = calls.find(call => call.kind === 'username').query
  const node = sync.protocols[0].getUserElement(sync.users[0])
  assert.equal(node.attrs.username, 'teste_abc')
  assert.equal(node.attrs.pin, '1234')
  await assert.rejects(methods.queryUsernameExists('xx', '1234'), TypeError)
})

test('setCustomerNote e getCustomerNote preservam o conteúdo e usam app-state', async () => {
  const { methods, calls } = createSocket()
  const note = await methods.setCustomerNote(jid, 'Cliente VIP')
  assert.equal(methods.getCustomerNote(jid).content, 'Cliente VIP')
  const update = calls.find(call => call.kind === 'chatModify')
  assert.equal(update.mod.noteEdit.chatId, jid)
  assert.equal(update.mod.noteEdit.content, 'Cliente VIP')
  const edited = await methods.setCustomerNote(jid, 'Cliente Ouro')
  assert.equal(edited.id, note.id)
  assert.equal(methods.getCustomerNote(jid).content, 'Cliente Ouro')
  await methods.deleteCustomerNote(jid)
  assert.equal(methods.getCustomerNote(jid), null)
})

test('notes.edit alimenta cache de notas recebidas via app-state', () => {
  const { methods, ev } = createSocket()
  ev.emit('notes.edit', { id:'note-1', chatId:jid, content:'via sync', createdAt:123, deleted:false })
  assert.equal(methods.getCustomerNote(jid).content, 'via sync')
  ev.emit('notes.edit', { id:'note-1', chatId:jid, deleted:true })
  assert.equal(methods.getCustomerNote(jid), null)
})
