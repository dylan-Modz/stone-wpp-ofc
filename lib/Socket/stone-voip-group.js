/**
 * Resolve as identidades de um grupo antes da sinalização VoIP.
 * O motor de chamadas espera LIDs, mesmo quando o grupo envia mensagens PN.
 * Sem LID confirmado, aborta ANTES de enviar a oferta ao WhatsApp.
 */
const MAX_GROUP_INVITES = 6

function accountJid(value) {
  const jid = String(value || '').trim()
  const match = /^(\d+)(?::\d+)?@(lid|s\.whatsapp\.net)$/.exec(jid)
  return match ? match[1] + '@' + match[2] : ''
}
function lidOf(value) {
  const jid = accountJid(value)
  return jid.endsWith('@lid') ? jid : ''
}
function phoneOf(value) {
  const jid = accountJid(value)
  return jid.endsWith('@s.whatsapp.net') ? jid : ''
}
function aliases(member = {}) {
  if (typeof member === 'string') return [accountJid(member)].filter(Boolean)
  return [...new Set([
    member.jid, member.id, member.lid, member.lidJid,
    member.pnJid, member.phoneJid, member.phoneNumber
  ].map(accountJid).filter(Boolean))]
}
async function resolveStoredLid(socket, phoneJid, { sync = false } = {}) {
  if (!phoneJid) return ''
  const mapping = socket.signalRepository?.lidMapping
  if (typeof mapping?.getLIDForPN !== 'function') return ''
  let mapped = lidOf(await mapping.getLIDForPN(phoneJid))
  if (!mapped && sync && typeof socket.getUSyncDevices === 'function') {
    await socket.getUSyncDevices([phoneJid], false, false)
    mapped = lidOf(await mapping.getLIDForPN(phoneJid))
  }
  return mapped
}
function matchRosterMember(roster, requested) {
  return roster.find(member => aliases(member).includes(requested))
}
async function resolveRosterLid(socket, member, { refresh = false } = {}) {
  const known = aliases(member)
  const lid = known.find(lidOf)
  if (lid) return lid
  const pn = known.find(phoneOf)
  return pn ? resolveStoredLid(socket, pn, { sync: refresh }) : ''
}

export async function resolveStoneGroupCallOptions(socket, options = {}) {
  if (!/^\d[\d-]*@g\.us$/.test(options.groupJid || '')) {
    throw new TypeError('STONE_GROUP_INVALID_JID: identificador do grupo inválido')
  }
  if (!Array.isArray(options.participants) || options.participants.length < 1 ||
      options.participants.length > MAX_GROUP_INVITES) {
    throw new TypeError('STONE_GROUP_INVITE_LIMIT: marque de 1 a 6 membros')
  }
  if (typeof socket.groupMetadata !== 'function') {
    throw new Error('STONE_GROUP_ROSTER_UNAVAILABLE: consulta de membros indisponível')
  }
  const metadata = await socket.groupMetadata(options.groupJid)
  if (metadata?.id !== options.groupJid || !Array.isArray(metadata.participants) ||
      metadata.participants.length < 2) {
    throw new Error('STONE_GROUP_ROSTER_UNAVAILABLE: lista do grupo ausente ou divergente')
  }
  const roster = metadata.participants
  const ownPhone = phoneOf(socket.authState?.creds?.me?.id)
  const ownLid = lidOf(socket.authState?.creds?.me?.lid) ||
    await resolveStoredLid(socket, ownPhone, { sync: true })
  if (!ownLid) {
    throw new Error('STONE_GROUP_SELF_LID_MISSING: LID do bot não confirmado pelo WhatsApp')
  }
  if (!roster.some(member => {
    const ids = aliases(member)
    return ids.includes(ownLid) || (ownPhone && ids.includes(ownPhone))
  })) {
    throw new Error('STONE_GROUP_SELF_NOT_MEMBER: bot não consta na lista do grupo')
  }
  const participants = []
  const selected = new Set()
  for (const row of options.participants) {
    const requested = accountJid(typeof row === 'string' ? row : row?.jid)
    if (!requested) throw new Error('STONE_GROUP_PEER_INVALID: membro com JID inválido')
    let member = matchRosterMember(roster, requested)
    if (!member && requested.endsWith('@lid')) {
      for (const candidate of roster) {
        const pn = aliases(candidate).find(phoneOf)
        if (pn && await resolveStoredLid(socket, pn) === requested) {
          member = candidate
          break
        }
      }
    }
    if (!member) {
      throw new Error('STONE_GROUP_PEER_NOT_MEMBER: membro marcado não consta no grupo')
    }
    const lid = await resolveRosterLid(socket, member, { refresh: true })
    if (!lid) {
      throw new Error('STONE_GROUP_PEER_LID_MISSING: LID do membro não confirmado pelo WhatsApp')
    }
    if (lid === ownLid || selected.has(lid)) continue
    selected.add(lid)
    // Os dispositivos corretos são descobertos pelo plugin a partir do LID.
    participants.push({ jid: lid })
  }
  if (!participants.length) throw new Error('STONE_GROUP_NO_PEERS: nenhum convidado válido')
  return { ...options, participants }
}
