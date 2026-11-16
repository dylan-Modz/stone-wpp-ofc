import test from 'node:test'
import assert from 'node:assert/strict'
import { createConsoleFeed, describeConsoleMessage, summarizePeer } from './console-feed.js'

test('mensagens de texto, imagem, audio e figurinha são classificadas sem baixar mídia',()=>{
  const text = describeConsoleMessage({
    key:{remoteJid:'5591888880000@s.whatsapp.net'},
    message:{conversation:'  oi\n\tcomo vai? '}
  })
  assert.equal(text.kind,'texto')
  assert.equal(text.preview,'oi como vai?')
  assert.equal(text.peer.includes('88880000'),false)
  const image=describeConsoleMessage({
    key:{remoteJid:'123456789@g.us'},
    message:{viewOnceMessageV2:{message:{imageMessage:{caption:'legenda da foto',jpegThumbnail:Buffer.from('sensitive')}}}}
  })
  assert.equal(image.kind,'imagem')
  assert.equal(image.preview,'legenda da foto')
  assert.equal(image.media,true)
  assert.equal(image.peer.includes('123456789'),false)
  assert.equal(describeConsoleMessage({message:{audioMessage:{ptt:true}}}).kind,'áudio de voz')
  assert.equal(describeConsoleMessage({message:{stickerMessage:{}}}).kind,'figurinha')
  assert.equal(describeConsoleMessage({message:{videoMessage:{gifPlayback:true}}}).kind,'gif')
  assert.equal(describeConsoleMessage({message:{documentMessage:{fileName:'manual.pdf'}}}).preview,'manual.pdf')
})

test('registro fica limitado em memória e não divulga conteúdo por padrão',()=>{
  let current=100000
  const feed=createConsoleFeed({now:()=>current,capacity:3,ttlMs:60000})
  feed.add({sessionId:'a',direction:'recebida',kind:'texto',preview:'SEGREDO 123',peer:summarizePeer('559199990000@s.whatsapp.net')})
  const without=feed.read()
  assert.equal(JSON.stringify(without).includes('SEGREDO'),false)
  const withPreview=feed.read({includePreview:true})
  assert.equal(withPreview.entries[0].preview,'SEGREDO 123')
  assert.equal(without.entries[0].peer.includes('559199990000'),false)
  for(let i=0;i<5;i++)feed.add({sessionId:'a',direction:'sistema',kind:'open',detail:'ligado'})
  assert.equal(feed.read({includePreview:true}).entries.length,3)
  const cursor=feed.read().cursor
  assert.deepEqual(feed.read({since:cursor}).entries,[])
  current+=61000
  assert.deepEqual(feed.read().entries,[])
  assert.equal(feed.read().cursor,cursor)
})

test('conteúdo de texto é limitado, limpo e nunca processado como comandos ANSI',()=>{
  const feed=createConsoleFeed()
  feed.add({sessionId:'test',direction:'enviada',kind:'texto',preview:'\u001b[31m'+'A'.repeat(500)})
  const item=feed.read({includePreview:true}).entries[0]
  assert.equal(item.preview.length<=220,true)
  assert.equal(item.preview.includes('\u001b'),false)
  assert.equal(item.direction,'enviada')
})
