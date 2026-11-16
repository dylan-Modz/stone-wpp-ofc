import test from 'node:test'
import assert from 'node:assert/strict'
import { createGatewayHttpServer } from './server.js'
const token = 'test-only-super-long-strong-token-123'
const manager = {
  getConsoleMedia:async seq=>({bytes:Buffer.from('PHOTO'),mime:'image/jpeg',filename:'stone-midia.jpg',inline:true}),
  getConsole: ({ since, includePreview }) => ({
    entries:[{seq:1,sessionId:'alpha',direction:'recebida',kind:'texto',
      ...(includePreview ? {preview:'conteúdo privado'} : {})}],
    cursor:1,retentionMinutes:15
  }),
  list: () => [{id:'alpha',status:'open',received:3,sent:1}],
  start: async id => ({id,status:'connecting'}),
  pause: async id => ({ id, status: 'paused' }),
  getActivity: () => [{id:'e1',sessionId:'alpha',event:'sent',detail:'Solicitação aceita.',timestamp:'2026-11-16T18:00:00Z'}],
  get: async id => ({id,status:'connecting',qrImage:null}),
  pair: async (id,number) => ({id,code:'1234-5678',number}),
  send: async (id,to,text) => ({id:'message-1',sessionId:id,to,text}),
  getWebhook: () => ({url:'',events:[],signed:false}),
  setWebhook: async config => config
}
async function withServer(fn) {
  const server=createGatewayHttpServer({manager,token,origins:['https://stone-wpp.squareweb.app']})
  await new Promise(r => server.listen(0,'127.0.0.1',r))
  const base='http://127.0.0.1:'+server.address().port
  try {await fn(base)}finally{await new Promise(r=>server.close(r))}
}
test('requires token on all endpoints', async()=>{
  await withServer(async base=>{
    assert.equal((await fetch(base+'/v1/health')).status,401)
    assert.equal((await fetch(base+'/v1/sessions',{headers:{Authorization:'Bearer incorrect'}})).status,401)
    const res=await fetch(base+'/v1/health',{headers:{Authorization:'Bearer '+token}})
    assert.equal((await res.json()).service,'stone-gateway')
  })
})
test('rejects unapproved origins and allows opted-in Studio',async()=>{
  await withServer(async base=>{
    assert.equal((await fetch(base+'/v1/health',{headers:{Origin:'https://evil.example',Authorization:'Bearer '+token}})).status,403)
    const res=await fetch(base+'/v1/sessions',{headers:{Origin:'https://stone-wpp.squareweb.app',Authorization:'Bearer '+token}})
    assert.equal(res.status,200)
    assert.equal(res.headers.get('access-control-allow-origin'),'https://stone-wpp.squareweb.app')
    assert.equal((await res.json()).sessions[0].id,'alpha')
  })
})
test('supports session, pairing and single text operations',async()=>{
  await withServer(async base=>{
    const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'}
    const request=(path,body)=>fetch(base+path,{method:'POST',headers,body:JSON.stringify(body)})
    assert.equal((await request('/v1/sessions',{id:'alpha'})).status,201)
    const pair=await (await request('/v1/sessions/alpha/pair',{phoneNumber:'5511999999999'})).json()
    assert.equal(pair.code,'1234-5678')
    const sent=await (await request('/v1/sessions/alpha/messages',{to:'5511999999999@s.whatsapp.net',text:'oi'})).json()
    assert.equal(sent.sessionId,'alpha')
    assert.equal((await fetch(base+'/v1/sessions/alpha',{headers})).status,200)
  })
})

test('pause endpoint is authenticated and returns the paused session', async()=>{
  await withServer(async base=>{
    assert.equal((await fetch(base+'/v1/sessions/alpha/pause',{method:'POST'})).status,401)
    const res=await fetch(base+'/v1/sessions/alpha/pause',{
      method:'POST',headers:{Authorization:'Bearer '+token}
    })
    assert.equal(res.status,200)
    assert.equal((await res.json()).status,'paused')
  })
})

test('authenticated activity endpoint exposes operational metadata',async()=>{
  await withServer(async base=>{
    assert.equal((await fetch(base+'/v1/activity')).status,401)
    const res=await fetch(base+'/v1/activity',{headers:{Authorization:'Bearer '+token}})
    assert.equal(res.status,200)
    const body=await res.json()
    assert.equal(body.events[0].event,'sent')
    assert.equal(body.events[0].sessionId,'alpha')
  })
})


test('terminal API requires Bearer token and hides previews unless explicitly requested',async()=>{
  await withServer(async base=>{
    const path='/v1/console?since=0';
    assert.equal((await fetch(base+path)).status,401);
    const headers={Authorization:'Bearer '+token};
    const plain=await (await fetch(base+path,{headers})).json();
    assert.equal(plain.entries[0].preview,undefined);
    const details=await (await fetch(base+path+'&preview=1',{headers})).json();
    assert.equal(details.entries[0].preview,'conteúdo privado');
    assert.equal(details.cursor,1);
    assert.equal((await fetch(base+'/v1/console?since=-1',{headers})).status,400);
    assert.equal((await fetch(base+'/v1/console?since=abc',{headers})).status,400);
  });
});

test('media endpoint requires Bearer token and returns safe file headers only on demand',async()=>{
  await withServer(async base=>{
    const path='/v1/console/media/1'
    assert.equal((await fetch(base+path)).status,401)
    const headers={Authorization:'Bearer '+token}
    const res=await fetch(base+path,{headers})
    assert.equal(res.status,200)
    assert.equal(res.headers.get('content-type'),'image/jpeg')
    assert.equal(res.headers.get('cache-control'),'no-store, private')
    assert.equal(res.headers.get('x-content-type-options'),'nosniff')
    assert.equal(res.headers.get('content-disposition'),'inline; filename="stone-midia.jpg"')
    assert.equal(await res.text(),'PHOTO')
    assert.equal((await fetch(base+'/v1/console/media/invalid',{headers})).status,404)
  })
})
