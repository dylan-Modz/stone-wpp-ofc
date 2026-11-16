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
