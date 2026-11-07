import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseStoneCallStanza, buildGroupCallRejectStanza, createStoneCallStanza, createStoneCallMediaDescription, parseStoneCallServerJid } from './stone-call-signaling.js'

test('sinalização de oferta é normalizada sem expor chave ou relays', () => {
  const node = {
    tag: 'call',
    attrs: { from: 'callid@call', id: 'STANZA', t: '1794123456' },
    content: [{
      tag: 'offer', attrs: {
        'call-id': 'CALL123', 'call-creator': '123@lid',
        'group-jid': '456@g.us', joinable: '1', 're-ring': '1'
      },
      content: [
        { tag: 'video', attrs: {} },
        { tag: 'enc', attrs: { type: 'msg' }, content: Buffer.from('secret') },
        { tag: 'relay', attrs: { token: 'secret-relay' } }
      ]
    }]
  }
  const call = parseStoneCallStanza(node, 'offer')
  assert.equal(call.id, 'CALL123')
  assert.equal(call.isGroup, true)
  assert.equal(call.isVideo, true)
  assert.equal(call.joinable, true)
  assert.equal(call.reRing, true)
  assert.equal(call.callCreator, '123@lid')
  assert.equal(call.groupJid, '456@g.us')
  const json = JSON.stringify(call)
  assert.ok(!json.includes('secret'))
  assert.ok(!json.includes('token'))
  assert.ok(!json.includes('enc'))
})

test('sinalizações inválidas e timestamps ausentes são tratados com segurança', () => {
  assert.equal(parseStoneCallStanza({ attrs: {}, content: [] }, 'offer'), null)
  const node = { attrs: { from: '123@lid' }, content: [{ tag: 'offer', attrs: {'call-id':'CALL'} }] }
  const result = parseStoneCallStanza(node, 'offer')
  assert.ok(!Number.isNaN(result.date.valueOf()))
  assert.equal(result.isVideo, false)
})

test('recusa para grupo gera destino e identificador corretos', () => {
  const node = buildGroupCallRejectStanza('CALL987','5511@lid',()=>Buffer.alloc(16,0xAB))
  assert.equal(node.attrs.to,'CALL987@call')
  assert.equal(node.attrs.id,'AB'.repeat(16))
  assert.equal(node.content[0].attrs.count,'0')
  assert.throws(() => buildGroupCallRejectStanza('INVALID@call','123@lid'),/Identificador/)
})

test('montagem independente de sinalização preserva IDs e não envia mídia', () => {
  const node = createStoneCallStanza({
    to: '123@lid', tag: 'preaccept',
    callId: 'ABCD', callCreator: '123@lid',
    content: createStoneCallMediaDescription(false)
  }, () => Buffer.alloc(16, 0x42))
  assert.equal(node.attrs.id, '42'.repeat(16))
  assert.equal(node.attrs.to, '123@lid')
  assert.equal(node.content[0].tag, 'preaccept')
  assert.equal(node.content[0].attrs['call-id'], 'ABCD')
  assert.equal(node.content[0].content.filter(x => x.tag === 'audio').length, 2)
  assert.equal(node.content[0].content.some(x => x.tag === 'video'), false)
})

test('vídeo é apenas descrição de capacidade; identificador @call é validado', () => {
  assert.equal(createStoneCallMediaDescription(true).some(x => x.tag === 'video'), true)
  assert.equal(parseStoneCallServerJid('ABC123@call'), 'ABC123')
  assert.equal(parseStoneCallServerJid('not-call@g.us'), null)
  assert.equal(parseStoneCallServerJid('bad/id@call'), null)
  assert.throws(() => createStoneCallStanza({ to: '123@lid', tag: 'invalid', callId: 'A', callCreator:'123@lid' }), /Tipo/)
  assert.throws(() => createStoneCallStanza({ to: '123@lid', tag: 'offer', callId: 'A', callCreator:'123@lid', attrs: {'call-id':'fake'} }), /Atributos/)
})
