import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveStoneGroupCallOptions } from './stone-voip-group.js'

const groupJid = '120363111@g.us'
const own = { id: '5511888888888@s.whatsapp.net', lid: '90000@lid' }
function makeSocket(members, mapping = {}, syncMapping = {}) {
  const current = { ...mapping }
  let syncs = 0
  const socket = {
    authState: { creds: { me: own } },
    groupMetadata: async () => ({ id: groupJid, participants: members }),
    signalRepository: { lidMapping: { getLIDForPN: async pn => current[pn] || null } },
    getUSyncDevices: async () => { syncs++; Object.assign(current, syncMapping); return [] }
  }
  return { socket, getSyncs: () => syncs }
}
const invite = jid => ({ groupJid, participants: [{ jid }] })
test('oferta de grupo LID mantém a identidade e não inclui outro membro', async () => {
  const { socket } = makeSocket([{jid:'90000@lid'}, {jid:'11111@lid'}, {jid:'22222@lid'}])
  const result = await resolveStoneGroupCallOptions(socket, invite('11111@lid'))
  assert.deepEqual(result.participants, [{ jid:'11111@lid' }])
})
test('em grupos PN resolve o membro marcado ao LID do roster', async () => {
  const pn = '5511991111111@s.whatsapp.net'
  const { socket } = makeSocket([{jid:own.id, lid:own.lid},{jid:pn,lid:'11111@lid'}])
  const result = await resolveStoneGroupCallOptions(socket, invite(pn))
  assert.deepEqual(result.participants, [{ jid:'11111@lid' }])
})
test('se o roster só traz PN sincroniza o mapeamento antes do envio', async () => {
  const pn = '5511991111111@s.whatsapp.net'
  const { socket, getSyncs } = makeSocket([{jid:own.id, lid:own.lid}, {jid:pn}], {}, { [pn]:'11111@lid' })
  const result = await resolveStoneGroupCallOptions(socket, invite(pn))
  assert.deepEqual(result.participants, [{ jid:'11111@lid' }])
  assert.equal(getSyncs(),1)
})
test('não envia oferta se o participante não tem LID confirmado', async () => {
  const pn = '5511991111111@s.whatsapp.net'
  const { socket } = makeSocket([{jid:own.id,lid:own.lid},{jid:pn}])
  await assert.rejects(resolveStoneGroupCallOptions(socket,invite(pn)),/STONE_GROUP_PEER_LID_MISSING/)
})
test('não chama quem não pertence ao roster do grupo', async () => {
  const { socket } = makeSocket([{jid:own.lid}, {jid:'11111@lid'}])
  await assert.rejects(resolveStoneGroupCallOptions(socket,invite('22222@lid')),/STONE_GROUP_PEER_NOT_MEMBER/)
})
test('não inclui a própria conta como convidada e remove duplicatas', async () => {
  const { socket } = makeSocket([{jid:own.lid},{jid:'11111@lid'}])
  await assert.rejects(resolveStoneGroupCallOptions(socket,invite(own.lid)),/STONE_GROUP_NO_PEERS/)
  const result = await resolveStoneGroupCallOptions(socket,{groupJid,participants:[{jid:'11111@lid'},{jid:'11111@lid'}]})
  assert.deepEqual(result.participants,[{jid:'11111@lid'}])
})
test('não prossegue com metadata do grupo errado ou sem conta local', async () => {
  const { socket } = makeSocket([{jid:own.lid},{jid:'11111@lid'}])
  socket.groupMetadata = async () => ({ id:'123@g.us', participants:[{jid:own.lid},{jid:'11111@lid'}] })
  await assert.rejects(resolveStoneGroupCallOptions(socket,invite('11111@lid')),/STONE_GROUP_ROSTER_UNAVAILABLE/)
  socket.groupMetadata = async () => ({ id:groupJid, participants:[{jid:'11111@lid'},{jid:'22222@lid'}] })
  await assert.rejects(resolveStoneGroupCallOptions(socket,invite('11111@lid')),/STONE_GROUP_SELF_NOT_MEMBER/)
})
