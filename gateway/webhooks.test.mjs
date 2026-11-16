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
    for(let i=0;i<60 && service.getConfig().url;i++)await new Promise(resolve=>setTimeout(resolve,5))
    assert.equal(service.getConfig().url,'')
    assert.match(service.getConfig().disabledReason,/HTTP 401/)
    const count=calls
    for(let i=0;i<100;i++)service.emit('messages.upsert',{message:'test'})
    await new Promise(resolve=>setTimeout(resolve,50))
    assert.equal(calls,count,'disabling the receiver stops further attempts')
    assert.equal(warnings.filter(msg=>msg.includes('Webhook desativado')).length,1)
    const reloaded=await createWebhookService(dir,{logger:{warn(){}}})
    assert.equal(reloaded.getConfig().url,'','disabled config survives restart')
    assert.match(reloaded.getConfig().disabledReason,/HTTP 401/)
    await reloaded.setConfig({url:'https://novo.example.com/notificacoes'})
    assert.equal(reloaded.getConfig().disabledReason,null)
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
    assert.equal(service.getConfig().url,'')
    assert.match(service.getConfig().disabledReason,/403/)
  }finally{await rm(dir,{recursive:true,force:true})}
})
