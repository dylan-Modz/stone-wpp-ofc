import test from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { createConsoleMediaStore } from './console-media.js'

const image = (extra={}) => ({
  message:{imageMessage:{
    mediaKey:Buffer.from('test-key'),directPath:'/whatsapp/media',
    mimetype:'image/jpeg',fileLength:5,
    ...extra
  }}
})
const doc = data => ({ message:{documentMessage:{
  mediaKey:Buffer.from('test-key'),url:'https://media.whatsapp.net/file',
  fileLength:4,mimetype:'application/pdf',...data
}}})

test('media is downloaded only when explicitly requested, with an authenticated sequence',async()=>{
  let calls=0
  const store=createConsoleMediaStore({
    download:async (_payload,type)=>{
      calls++;assert.equal(type,'image')
      return Readable.from([Buffer.from('photo')])
    }
  })
  assert.equal(store.register(23,image()),true)
  assert.equal(calls,0,'no eager media download on message arrival')
  const media=await store.read(23)
  assert.equal(calls,1)
  assert.equal(media.bytes.toString(),'photo')
  assert.equal(media.mime,'image/jpeg')
  assert.equal(media.filename,'stone-midia.jpg')
  assert.equal(media.inline,true)
  await assert.rejects(store.read(24),err=>err.status===404)
})

test('view-once and wrapped disappearing messages are not made available',()=>{
  const store=createConsoleMediaStore()
  assert.equal(store.register(1,{message:{viewOnceMessageV2:{message:image().message}}}),false)
  assert.equal(store.register(2,{message:{ephemeralMessage:{message:image().message}}}),false)
  assert.equal(store.register(3,{message:{stickerMessage:{}}}),false)
  assert.equal(store.register(4,{message:{conversation:'oi'}}),false)
})

test('file size is bounded before and during streaming; unknown document is an attachment',async()=>{
  let call=0
  const store=createConsoleMediaStore({maxBytes:5,download:async()=>{
    call++;return Readable.from([Buffer.from('1234'),Buffer.from('5678')])
  }})
  assert.equal(store.register(1,image({fileLength:6})),true)
  await assert.rejects(store.read(1),err=>err.status===413)
  assert.equal(call,0,'large declared file never begins download')
  assert.equal(store.register(2,doc({fileLength:0})),true)
  await assert.rejects(store.read(2),err=>err.status===413)
  assert.equal(call,1,'unknown file length is limited during streaming')
  const store2=createConsoleMediaStore({download:async()=>Readable.from([Buffer.from('data')])})
  store2.register(3,doc({mimetype:'text/html'}))
  const attachment=await store2.read(3)
  assert.equal(attachment.mime,'application/octet-stream')
  assert.equal(attachment.inline,false)
})

test('media references expire and are limited in RAM',async()=>{
  let now=100000
  const store=createConsoleMediaStore({now:()=>now,ttlMs:500,capacity:2,
    download:async()=>Readable.from([Buffer.from('photo')])})
  store.register(1,image())
  store.register(2,image())
  store.register(3,image())
  await assert.rejects(store.read(1),err=>err.status===404)
  now+=501
  await assert.rejects(store.read(2),err=>err.status===404)
  await assert.rejects(store.read(3),err=>err.status===404)
})
