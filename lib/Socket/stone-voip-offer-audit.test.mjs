import { test } from 'node:test'
import assert from 'node:assert/strict'
import { auditStoneGroupOffer } from './stone-voip-offer-audit.js'
function offer({creatorDevice=76, badMember=false, badTo=false, duplicate=false}={}) {
  const creator=`5000:${creatorDevice}@lid`
  const users=[
    {tag:'user',attrs:{jid:'5000@lid'},content:[{tag:'device',attrs:{jid:creator},content:[{tag:'capability',attrs:{ver:'1'},content:Uint8Array.of(1)}]}]},
    {tag:'user',attrs:{jid:'6000@lid'},content:[{tag:'device',attrs:{jid:badMember?'6000@s.whatsapp.net':'6000@lid'}}]}
  ]
  if(duplicate) users.push({...users[1]})
  const id='ABCDEF0123456789ABCDEF0123456789'
  return {tag:'call',attrs:{to:(badTo?'INVALID':id)+'@call',id:'random'},content:[{tag:'offer',attrs:{'call-id':id,'call-creator':creator,'group-jid':'12345@g.us'},content:[{tag:'audio',attrs:{rate:'8000'}},{tag:'audio',attrs:{rate:'16000'}},{tag:'net',attrs:{medium:'3'}},{tag:'group_info',attrs:{},content:users}]}]}
}
test('uma oferta de grupo válida passa e o relatório não revela IDs',()=>{
  const v=auditStoneGroupOffer(offer(),'5511:76@s.whatsapp.net')
  assert.equal(v.ok,true);assert.equal(v.inviteeCount,1);assert.equal(v.deviceCount,2)
  assert.doesNotMatch(JSON.stringify(v),/5000|6000|5511|12345/)
})
test('um criador que anuncia outro dispositivo é barrado',()=>{
  const v=auditStoneGroupOffer(offer({creatorDevice:0}),'5511:76@s.whatsapp.net')
  assert.equal(v.ok,false);assert.equal(v.creatorMatchesSocket,false)
})
test('um dispositivo PN no grupo LID é barrado',()=>{
  const v=auditStoneGroupOffer(offer({badMember:true}),'5511:76@s.whatsapp.net')
  assert.equal(v.ok,false);assert.equal(v.allLid,false);assert.equal(v.deviceOwnersMatch,false)
})
test('não aceita usuário duplicado ou destino diferente do ID da chamada',()=>{
  assert.equal(auditStoneGroupOffer(offer({duplicate:true}),'5511:76@s.whatsapp.net').ok,false)
  assert.equal(auditStoneGroupOffer(offer({badTo:true}),'5511:76@s.whatsapp.net').toMatchesCall,false)
})
test('não altera ofertas individuais',()=>{
  assert.equal(auditStoneGroupOffer({tag:'call',content:[{tag:'offer',attrs:{'call-id':'abc'}}]},'5511:76@s.whatsapp.net'),null)
})
