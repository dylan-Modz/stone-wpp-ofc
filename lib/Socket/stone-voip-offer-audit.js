// Validate the final group-call offer, not the command's input list.
// Diagnostic output deliberately contains NO identifiers, raw nodes or secrets.
const jid = value => {
  const m = /^(\d+)(?::(\d+))?@(lid|s\.whatsapp\.net)$/.exec(String(value || ''))
  return m ? { account: `${m[1]}@${m[3]}`, device: m[2] === undefined ? 0 : Number(m[2]), domain: m[3] } : null
}
export function auditStoneGroupOffer(node, ownJid = '') {
  const offer = Array.isArray(node?.content) ? node.content.find(n => n?.tag === 'offer') : null
  if (node?.tag !== 'call' || !offer?.attrs?.['group-jid']) return null
  const creator = jid(offer.attrs['call-creator'])
  const own = jid(ownJid)
  const groupInfo = Array.isArray(offer.content) ? offer.content.filter(n => n?.tag === 'group_info') : []
  const users = Array.isArray(groupInfo[0]?.content) ? groupInfo[0].content : []
  const creatorRows = users.filter(u => jid(u?.attrs?.jid)?.account === creator?.account)
  const creatorDevices = Array.isArray(creatorRows[0]?.content) ? creatorRows[0].content : []
  const allDevices = users.flatMap(u => Array.isArray(u?.content) ? u.content : [])
  const groupIdentityValid = /^\d+@g\.us$/.test(String(offer.attrs['group-jid'] || ''))
  const toMatchesCall = /^[0-9A-Fa-f]{32}$/.test(String(offer.attrs['call-id'] || '')) &&
    node.attrs?.to === `${offer.attrs['call-id']}@call`
  const allLid = users.length > 0 && users.every(u => jid(u?.attrs?.jid)?.domain === 'lid') &&
    allDevices.every(d => jid(d?.attrs?.jid)?.domain === 'lid')
  const deviceOwnersMatch = users.every(u => {
    const account = jid(u?.attrs?.jid)?.account
    return Boolean(account) && Array.isArray(u.content) && u.content.length > 0 &&
      u.content.every(d => d.tag === 'device' && jid(d?.attrs?.jid)?.account === account)
  })
  const creatorDeviceMatches = creatorRows.length === 1 &&
    creatorDevices.some(d => {
      const value = jid(d?.attrs?.jid)
      return value?.account === creator?.account && value.device === creator.device
    })
  const creatorMatchesSocket = !own || !creator ? false :
    (!/:\d+@/.test(String(ownJid)) || creator.device === own.device)
  const distinctAccounts = new Set(users.map(u => jid(u?.attrs?.jid)?.account))
  const memberCount = Math.max(0, users.length - 1)
  const media = Array.isArray(offer.content) ? offer.content : []
  const hasMedia = media.filter(n => n?.tag === 'audio').length >= 2 && media.some(n => n?.tag === 'net')
  const ok = groupIdentityValid && toMatchesCall && groupInfo.length === 1 &&
    Boolean(creator) && creator.domain === 'lid' && allLid && deviceOwnersMatch &&
    creatorDeviceMatches && creatorMatchesSocket && users.length >= 2 &&
    distinctAccounts.size === users.length && hasMedia
  return {
    ok, groupIdentityValid, toMatchesCall, creatorIsLid: creator?.domain === 'lid',
    creatorDeviceMatches, creatorMatchesSocket, groupInfoUnique: groupInfo.length === 1,
    allLid, deviceOwnersMatch, uniqueAccounts: distinctAccounts.size === users.length,
    hasMedia, inviteeCount: Math.min(memberCount, 99),
    deviceCount: Math.min(allDevices.length, 999)
  }
}
