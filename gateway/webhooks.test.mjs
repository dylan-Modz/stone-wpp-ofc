import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createHmac } from 'node:crypto'
import { createWebhookService } from './webhooks.js'

test('webhooks require HTTPS and never reveal the signing secret',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'stone-hook-'))
  try {
    const service=await createWebhookService(dir,{logger:{warn(){}}})
    await assert.rejects(service.setConfig({url:'http://localhost:4000/hook'}),/public_https/)
    await assert.rejects(service.setConfig({url:'https://127.0.0.1/hook'}),/public_https/)
    await assert.rejects(service.setConfig({url:'https://example.com/hook',secret:'short'}),/minimum/)
    const publicConf=await service.setConfig({url:'https://example.com/hook',secret:'this-is-a-private-signing-secret'})
    assert.equal(publicConf.signed,true)
    assert.equal(publicConf.secret,undefined)
    const reloaded=await createWebhookService(dir,{logger:{warn(){}}})
    assert.equal(reloaded.getConfig().url,'https://example.com/hook')
  }finally{await rm(dir,{recursive:true,force:true})}
})
test('webhook signatures cover the exact original request body',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'stone-hook-'))
  let sent
  try {
    const service=await createWebhookService(dir,{
      logger:{warn(){}},
      fetchImpl:async (url,options)=>{sent={url,...options};return {ok:true,status:200}}
    })
    await service.setConfig({url:'https://hooks.example.com/events',secret:'this-is-a-private-signing-secret'})
    service.emit('connection.update',{sessionId:'bot1',connection:'open'})
    for(let i=0;!sent&&i<20;i++)await new Promise(r=>setTimeout(r,10))
    assert.equal(sent?.url,'https://hooks.example.com/events')
    const signature='sha256='+createHmac('sha256','this-is-a-private-signing-secret').update(sent.body).digest('hex')
    assert.equal(sent.headers['X-Stone-Signature'],signature)
    assert.equal(JSON.parse(sent.body).data.sessionId,'bot1')
  }finally{await rm(dir,{recursive:true,force:true})}
})


test('401 automatically disables webhook, persists state and stops warning flood', async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'stone-hook-reject-'))
  const warnings=[]
  let calls=0
  try{
    const service=await createWebhookService(dir,{
      logger:{warn:msg=>warnings.push(msg)},
      fetchImpl:async()=>{calls++;return {ok:false,status:401}}
    })
    await service.setConfig({url:'https://webhook-invalid.example.com/v1/health',secret:'this-is-a-private-signing-secret'})
    for(let i=0;i<10;i++)service.emit('messages.upsert',{message:'test'})
    for(let i=0;i<60 && !service.getConfig().disabledReason;i++)await new Promise(resolve=>setTimeout(resolve,5))
    assert.equal(service.getConfig().url,'https://webhook-invalid.example.com/v1/health')
    assert.match(service.getConfig().disabledReason,/HTTP 401/)
    assert.equal(service.getConfig().enabled,false)
    const count=calls
    for(let i=0;i<100;i++)service.emit('messages.upsert',{message:'test'})
    await new Promise(resolve=>setTimeout(resolve,50))
    assert.equal(calls,count,'disabling the receiver stops further attempts')
    assert.equal(warnings.filter(msg=>msg.includes('envios suspensos')).length,1)
    const reloaded=await createWebhookService(dir,{logger:{warn(){}}})
    assert.equal(reloaded.getConfig().url,'https://webhook-invalid.example.com/v1/health','blocked receiver URL remains saved after restart')
    assert.match(reloaded.getConfig().disabledReason,/HTTP 401/)
    await reloaded.setConfig({url:'https://novo.example.com/notificacoes'})
    assert.equal(reloaded.getConfig().disabledReason,null)
    assert.equal(reloaded.getConfig().enabled,true)
  }finally{await rm(dir,{recursive:true,force:true})}
})

test('403 also disables a rejected webhook',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'stone-hook-forbidden-'))
  try{
    const service=await createWebhookService(dir,{
      logger:{warn(){}},fetchImpl:async()=>({status:403,ok:false})
    })
    await service.setConfig({url:'https://receiver.example.com/events'})
    service.emit('call',{id:'x'})
    for(let i=0;i<60 && service.getConfig().url;i++)await new Promise(resolve=>setTimeout(resolve,5))
    assert.equal(service.getConfig().url,'https://receiver.example.com/events')
    assert.equal(service.getConfig().enabled,false)
    assert.match(service.getConfig().disabledReason,/403/)
  }finally{await rm(dir,{recursive:true,force:true})}
})


test('valid webhook destination, events and HMAC persist and survive restart',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'stone-webhook-save-'))
  try{
    const service=await createWebhookService(dir,{logger:{warn(){}}})
    const expected='https://hooks.example.com/events'
    const saved=await service.setConfig({
      url:expected,secret:'some-secure-signature-secret',
      events:['messages.upsert','call']
    })
    assert.equal(saved.url,expected)
    assert.equal(saved.signed,true)
    assert.deepEqual(saved.events,['messages.upsert','call'])
    assert.equal(saved.enabled,true)
    const second=await createWebhookService(dir,{logger:{warn(){}}})
    assert.equal(second.getConfig().url,expected,'configuration must survive restart')
    assert.equal(second.getConfig().signed,true)
    assert.deepEqual(second.getConfig().events,['messages.upsert','call'])
    assert.equal(second.getConfig().secret,undefined)
  }finally{await rm(dir,{recursive:true,force:true})}
})

test('stale 401 from earlier delivery never disables newly saved same-URL webhook',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'stone-webhook-old401-'))
  let release
  let seen
  const started=new Promise(resolve=>{seen=resolve})
  const response=new Promise(resolve=>{release=resolve})
  try{
    const service=await createWebhookService(dir,{logger:{warn(){}},
      fetchImpl:async()=>{seen();await response;return {status:401,ok:false}}
    })
    const url='https://receptor.example.com/webhook'
    await service.setConfig({url,secret:'old-sig-secret-1234'})
    service.emit('messages.upsert',{message:'old'})
    await started
    await service.setConfig({url,secret:'new-sig-secret-1234'})
    release()
    for(let i=0;i<30;i++)await Promise.resolve()
    assert.equal(service.getConfig().url,url)
    assert.equal(service.getConfig().disabledReason,null)
    const restored=await createWebhookService(dir,{logger:{warn(){}}})
    assert.equal(restored.getConfig().url,url)
    assert.equal(restored.getConfig().disabledReason,null)
  }finally{await rm(dir,{recursive:true,force:true})}
})
