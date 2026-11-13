// Validação da oferta em grupo. O motor de mídia usa contas LID nos
// participantes do convite mesmo se as mensagens do grupo usam PN.
const lidRe = /^\d{1,20}@lid$/
const pnRe = /^\d{10,20}@s\.whatsapp\.net$/
const account = value => String(value || '').trim().replace(/:\d+(?=@)/, '')
const validLid = value => lidRe.test(account(value))

function memberIds(member) {
  return [member?.id, member?.jid, member?.lid, member?.lidJid,
    member?.phoneNumber, member?.pnJid, member?.phoneJid]
    .map(account).filter(Boolean)
}

function groupError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

/**
 * Protege o envio de uma oferta inválida antes de chegar ao WhatsApp.
 * Não altera a sessão, não cria outro socket e não modifica a chamada 1:1.
 */
export async function prepareStoneGroupOffer(socket, options) {
  const groupJid = String(options?.groupJid || '')
  const targets = options?.participants
  if (!/^[^@\s]+@g\.us$/.test(groupJid) || !Array.isArray(targets) || !targets.length) {
    throw groupError('STONE_GROUP_CALL_INVALID', 'Informe um grupo válido e ao menos um participante.')
  }
  const self = socket?.authState?.creds?.me || {}
  const selfLid = account(self.lid)
  if (!validLid(selfLid)) {
    throw groupError('STONE_GROUP_CALL_SELF_LID_MISSING',
      'O LID da conta não está sincronizado. Não é seguro criar uma chamada em grupo por PN.')
  }
  if (typeof socket?.groupMetadata !== 'function') {
    throw groupError('STONE_GROUP_CALL_ROSTER_UNAVAILABLE', 'Consulta de membros do grupo indisponível.')
  }
  const metadata = await socket.groupMetadata(groupJid)
  const members = metadata?.participants
  if (!Array.isArray(members) || !members.length || (metadata?.id && metadata.id !== groupJid)) {
    throw groupError('STONE_GROUP_CALL_ROSTER_UNAVAILABLE', 'Lista atual do grupo indisponível ou incorreta.')
  }
  const signalMap = socket.signalRepository?.lidMapping
  if (!signalMap) {
    throw groupError('STONE_GROUP_CALL_LID_MISSING', 'Mapeamento de identidades Signal indisponível.')
  }

  const resolvedMembers = []
  for (const row of members) {
    const ids = memberIds(row)
    const lids = ids.filter(validLid)
    for (const pn of ids.filter(id => pnRe.test(id))) {
      const mapped = await signalMap.getLIDForPN?.(pn)
      if (validLid(mapped)) lids.push(account(mapped))
    }
    resolvedMembers.push({ ids, lids: [...new Set(lids)] })
  }
  const isOwnMember = resolvedMembers.some(({ids,lids}) =>
    lids.includes(selfLid) || ids.includes(account(self.id)))
  if (!isOwnMember) {
    throw groupError('STONE_GROUP_CALL_SELF_NOT_MEMBER', 'A conta do bot não consta na lista atual do grupo.')
  }

  const normalized = []
  for (const participant of targets) {
    const incoming = account(participant?.jid)
    if (!incoming || (!validLid(incoming) && !pnRe.test(incoming))) {
      throw groupError('STONE_GROUP_CALL_LID_MISSING', 'O participante não possui um ID compatível com chamada em grupo.')
    }
    let lid = incoming
    if (!validLid(lid)) {
      lid = account(await signalMap.getLIDForPN?.(incoming))
      if (!validLid(lid) && typeof socket?.getUSyncDevices === 'function') {
        await socket.getUSyncDevices([incoming], false, false)
        lid = account(await signalMap.getLIDForPN?.(incoming))
      }
    }
    if (!validLid(lid)) {
      throw groupError('STONE_GROUP_CALL_LID_MISSING', 'Não foi possível sincronizar o LID do participante.')
    }
    if (lid === selfLid || normalized.some(p => p.jid === lid)) continue
    const found = resolvedMembers.some(({ids,lids}) => lids.includes(lid) || ids.includes(incoming))
    if (!found) {
      throw groupError('STONE_GROUP_CALL_NOT_MEMBER', 'Um dos destinatários não consta na lista atual do grupo.')
    }
    // Não reutiliza dispositivos PN informados por engano em oferta LID.
    normalized.push({ jid: lid })
  }
  if (!normalized.length) {
    throw groupError('STONE_GROUP_CALL_NO_PARTICIPANTS', 'Não há destinatário válido para a chamada em grupo.')
  }
  // Consulta a lista atual de dispositivos, sem cache. O motor VoIP resolve
  // seus IDs a partir do cache atualizado na montagem do offer.
  if (typeof socket.getUSyncDevices === 'function') {
    await socket.getUSyncDevices(normalized.map(p => p.jid), false, false)
  }
  return { ...options, participants: normalized }
}
