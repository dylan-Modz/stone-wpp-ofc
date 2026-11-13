/** Seleção de identidades para oferta de chamada em grupo (somente LID). */
const account = (v) => String(v || '').trim().replace(/:\d+(?=@)/, '')
const pn = (v) => { const s = account(v).replace(/@c\.us$/, '@s.whatsapp.net'); return /^\d+@s\.whatsapp\.net$/.test(s) ? s : '' }
const lid = (v) => { const s = account(v); return /^\d+@lid$/.test(s) ? s : '' }
const aliases = (m) => [...new Set([m?.jid, m?.id, m?.lid, m?.lidJid, m?.pnJid, m?.phoneJid, m?.phoneNumber].map(account).filter(Boolean))]
const failed = (code, message) => Object.assign(new Error(message), { code })

async function mappedLid(phone, socket) {
  if (!phone) return ''
  const mapping = socket?.signalRepository?.lidMapping
  if (typeof mapping?.getLIDForPN !== 'function') return ''
  let value = ''
  try { value = lid(await mapping.getLIDForPN(phone)) } catch {}
  if (!value && typeof socket?.getUSyncDevices === 'function') {
    // Recarrega USync em vez de confiar em um cache desatualizado.
    try { await socket.getUSyncDevices([phone], false, false) } catch {}
    try { value = lid(await mapping.getLIDForPN(phone)) } catch {}
  }
  return value
}
async function memberLid(member, socket) {
  for (const a of aliases(member)) { const value = lid(a); if (value) return value }
  for (const a of aliases(member)) { const value = await mappedLid(pn(a), socket); if (value) return value }
  return ''
}
async function rosterMember(members, requested, socket) {
  const requestedAccount = account(requested)
  const direct = members.find(m => aliases(m).includes(requestedAccount))
  if (direct) return direct
  if (lid(requestedAccount)) {
    // Em grupos PN, o roster pode listar apenas telefones mesmo que a oferta
    // já tenha LIDs válidos. Valida pelo mapa local, sem forçar USync para
    // cada um dos membros do grupo.
    const mapping = socket?.signalRepository?.lidMapping
    let matchedPn = ''
    try { matchedPn = pn(await mapping?.getPNForLID?.(requestedAccount)) } catch {}
    if (matchedPn) {
      const match = members.find(m => aliases(m).includes(matchedPn))
      if (match) return match
    }
    for (const member of members) {
      for (const value of aliases(member)) {
        const phone = pn(value)
        if (!phone) continue
        let mapped = ''
        try { mapped = lid(await mapping?.getLIDForPN?.(phone)) } catch {}
        if (mapped === requestedAccount) return member
      }
    }
    return null
  }
  const resolved = await mappedLid(pn(requestedAccount), socket)
  return resolved ? members.find(m => aliases(m).includes(resolved)) || null : null
}

/** Prepara IDs de participantes e da própria conta ANTES de iniciar o motor. */
export async function prepareStoneGroupOffer(socket, options) {
  if (!/^\d+@g\.us$/.test(options?.groupJid || '')) {
    throw failed('STONE_GROUP_INVALID_JID', 'Identificador do grupo inválido')
  }
  if (!Array.isArray(options.participants) || !options.participants.length || options.participants.length > 31) {
    throw failed('STONE_GROUP_INVALID_PARTICIPANTS', 'Informe de 1 a 31 participantes')
  }
  if (typeof socket?.groupMetadata !== 'function') {
    throw failed('STONE_GROUP_ROSTER_UNAVAILABLE', 'Consulta ao grupo indisponível no socket Stone')
  }
  let metadata
  try { metadata = await socket.groupMetadata(options.groupJid) }
  catch { throw failed('STONE_GROUP_ROSTER_UNAVAILABLE', 'Não foi possível atualizar os membros do grupo') }
  const members = metadata?.participants
  if (metadata?.id !== options.groupJid || !Array.isArray(members) || !members.length) {
    throw failed('STONE_GROUP_ROSTER_INVALID', 'Lista de membros do grupo ausente ou divergente')
  }

  const own = socket?.authState?.creds?.me || {}
  const ownPn = pn(own.id)
  const ownCurrentLid = lid(own.lid)
  const self = members.find(m => aliases(m).includes(ownPn) || (ownCurrentLid && aliases(m).includes(ownCurrentLid))) ||
    (ownPn ? await rosterMember(members, ownPn, socket) : null)
  if (!self) throw failed('STONE_GROUP_SELF_NOT_MEMBER', 'A conta do bot não foi encontrada na lista atual do grupo')
  const selfLid = await memberLid(self, socket) || ownCurrentLid || await mappedLid(ownPn, socket)
  if (!selfLid) {
    throw failed('STONE_GROUP_SELF_LID_MISSING', 'O LID da conta do bot não está confirmado')
  }

  const seen = new Set(), participants = []
  for (const participant of options.participants) {
    const requested = account(participant?.jid)
    if (!pn(requested) && !lid(requested)) {
      throw failed('STONE_GROUP_INVALID_PARTICIPANT', 'ID inválido de participante')
    }
    const member = await rosterMember(members, requested, socket)
    if (!member) {
      throw failed('STONE_GROUP_MEMBER_MISMATCH', 'O convidado não consta mais na lista atual do grupo (ACK 412)')
    }
    const resolvedLid = await memberLid(member, socket)
    if (!resolvedLid) {
      throw failed('STONE_GROUP_MEMBER_LID_MISSING', 'Não foi possível confirmar o LID do convidado; não enviaremos um PN')
    }
    if (resolvedLid === selfLid) {
      throw failed('STONE_GROUP_SELF_INVITE', 'Não é possível convidar a própria conta do bot')
    }
    if (seen.has(resolvedLid)) continue
    seen.add(resolvedLid)
    // Nunca reaproveita dispositivos PN antigos: o motor resolve a partir do LID.
    participants.push({ jid: resolvedLid })
  }
  if (!participants.length) {
    throw failed('STONE_GROUP_INVALID_PARTICIPANTS', 'Nenhum participante válido para chamar')
  }
  return { options: { ...options, participants }, selfLid }
}
