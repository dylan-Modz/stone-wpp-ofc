/**
 * Monta o LID do DISPOSITIVO que está autenticado no socket.
 * O roster devolve identidades de conta sem sufixo :device.
 * Em uma chamada de grupo o criador deve identificar o próprio aparelho
 * vinculado, não anunciar incorretamente o dispositivo principal (:0).
 */
function parseAccount(jid) {
  const match = /^(\d+)(?::(\d+))?@(lid|s\.whatsapp\.net)$/.exec(String(jid || ''))
  if (!match) return null
  const device = match[2] === undefined ? null : Number(match[2])
  if (device !== null && (!Number.isSafeInteger(device) || device < 0)) return null
  return { user: match[1], device, server: match[3] }
}
export function resolveStoneVoipSelfDeviceLid(meJid, meLid, confirmedSelfLid = '') {
  const currentPn = parseAccount(meJid)
  const currentLid = parseAccount(meLid)
  const confirmed = parseAccount(confirmedSelfLid)
  const lid = confirmed?.server === 'lid' ? confirmed :
    (currentLid?.server === 'lid' ? currentLid : null)
  if (!lid) return meLid || ''
  // O JID PN autenticado traz o dispositivo da sessão; o LID confirmado
  // pelo grupo pode vir sem o sufixo. Não confundir conta com dispositivo.
  const device = currentPn?.device ?? currentLid?.device ?? confirmed?.device
  if (device === null || device === 0) return lid.user + '@lid'
  return lid.user + ':' + device + '@lid'
}
