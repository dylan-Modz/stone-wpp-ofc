import { test } from 'node:test'
import assert from 'node:assert/strict'
import { prepareStoneGroupOffer } from './stone-voip-group.js'

const groupJid = '120363000@g.us'
const options = { groupJid, participants: [{ jid: '5588888888888@s.whatsapp.net' }] }
function fake({ roster, lidMap = {}, ownLid = '9000@lid' } = {}) {
  const members = roster || [
    { jid: '5599999999999@s.whatsapp.net', lid: '9000@lid' },
    { jid: '5588888888888@s.whatsapp.net', lid: '8000@lid' }
  ]
  return {
    authState: { creds: { me: { id: '5599999999999@s.whatsapp.net', lid: ownLid } } },
    groupMetadata: async id => ({ id, participants: members, addressingMode: 'pn' }),
    signalRepository: { lidMapping: { getLIDForPN: async id => lidMap[id] || null } }
  }
}
test('grupo PN deve enviar LIDs, não endereços de telefone', async () => {
  const prepared = await prepareStoneGroupOffer(fake(), options)
  assert.equal(prepared.selfLid, '9000@lid')
  assert.deepEqual(prepared.options.participants, [{ jid: '8000@lid' }])
})
test('LID de destinatário em roster de grupo LID', async () => {
  const socket = fake({ roster: [{ jid: '9000@lid' }, { jid: '8000@lid' }], lidMap: {
    '5599999999999@s.whatsapp.net': '9000@lid',
    '5588888888888@s.whatsapp.net': '8000@lid'
  } })
  const prepared = await prepareStoneGroupOffer(socket, options)
  assert.deepEqual(prepared.options.participants, [{ jid: '8000@lid' }])
})
test('sem LID confirmado, aborta antes de enviar a oferta', async () => {
  const socket = fake({ roster: [
    { jid: '5599999999999@s.whatsapp.net', lid: '9000@lid' },
    { jid: '5588888888888@s.whatsapp.net' }
  ] })
  await assert.rejects(prepareStoneGroupOffer(socket, options), { code: 'STONE_GROUP_MEMBER_LID_MISSING' })
})
test('convidado removido do grupo não gera oferta', async () => {
  const wrong = { ...options, participants: [{ jid: '5511111111111@s.whatsapp.net' }] }
  await assert.rejects(prepareStoneGroupOffer(fake(), wrong), { code: 'STONE_GROUP_MEMBER_MISMATCH' })
})
test('bloqueia convidar o próprio bot', async () => {
  const wrong = { ...options, participants: [{ jid: '9000@lid' }] }
  await assert.rejects(prepareStoneGroupOffer(fake(), wrong), { code: 'STONE_GROUP_SELF_INVITE' })
})
test('remove duplicatas e dispositivos PN antigos', async () => {
  const opts = { ...options, participants: [
    { jid: '8000@lid', devices: ['5588888888888:1@s.whatsapp.net'] },
    { jid: '5588888888888@s.whatsapp.net' }
  ] }
  const prepared = await prepareStoneGroupOffer(fake(), opts)
  assert.deepEqual(prepared.options.participants, [{ jid: '8000@lid' }])
})
test('LID da conta própria faltando bloqueia convite em grupo', async () => {
  const socket = fake({ ownLid: '', roster: [
    { jid: '5599999999999@s.whatsapp.net' },
    { jid: '5588888888888@s.whatsapp.net', lid: '8000@lid' }
  ] })
  await assert.rejects(prepareStoneGroupOffer(socket, options), { code: 'STONE_GROUP_SELF_LID_MISSING' })
})

test('grupo PN sem alias LID no roster encontra destinatário pelo mapa Signal', async () => {
  const socket = fake({ roster: [
    { jid: '5599999999999@s.whatsapp.net' },
    { jid: '5588888888888@s.whatsapp.net' }
  ], lidMap: {
    '5599999999999@s.whatsapp.net': '9000@lid',
    '5588888888888@s.whatsapp.net': '8000@lid'
  } })
  const prepared = await prepareStoneGroupOffer(socket, {
    groupJid, participants: [{ jid: '8000@lid' }]
  })
  assert.deepEqual(prepared.options.participants, [{ jid: '8000@lid' }])
  assert.equal(prepared.selfLid, '9000@lid')
})
