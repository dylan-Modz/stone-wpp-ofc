import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseStoneCallStanza, buildGroupCallRejectStanza } from './stone-call-signaling.js'

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
