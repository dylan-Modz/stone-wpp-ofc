import test from 'node:test'
import assert from 'node:assert/strict'
import { createConsoleFeed, describeConsoleMessage, describeContact, summarizePeer } from './console-feed.js'

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
  assert.equal(item.preview.length<=4096,true)
  assert.equal(item.preview.includes('\u001b'),false)
  assert.equal(item.direction,'enviada')
})

test('sender pushName takes precedence over LID, and number comes from PN alternate only',()=>{
  const incoming=describeConsoleMessage({
    pushName:'Maria da Silva',
    key:{
      remoteJid:'1122334455667788@lid',
      remoteJidAlt:'559188881234@s.whatsapp.net',
      fromMe:false
    },message:{conversation:'mensagem recebida de Maria'}
  })
  assert.equal(incoming.name,'Maria da Silva')
  assert.equal(incoming.phone,'559188881234')
  assert.equal(incoming.maskedPhone,'559••••1234')
  assert.equal(incoming.preview,'mensagem recebida de Maria')
  const lidOnly=describeContact({key:{remoteJid:'1122334455667788@lid'}})
  assert.equal(lidOnly.phone,'')
  assert.equal(lidOnly.peer,'Contato')
  assert.equal(JSON.stringify(lidOnly).includes('1122334455667788'),false)
  const group=describeContact({pushName:'João',key:{remoteJid:'120363111222@g.us',participant:'334455@lid',participantAlt:'5511987654321@s.whatsapp.net'}})
  assert.equal(group.name,'João')
  assert.equal(group.phone,'5511987654321')
})
test('full text and original phone are only returned under explicit preview',()=>{
  const feed=createConsoleFeed()
  feed.add({sessionId:'test',direction:'recebida',kind:'texto',name:'Maria',peer:'Maria',phone:'5511987654321',maskedPhone:'551••••4321',preview:'O'.repeat(3500)})
  const hidden=feed.read().entries[0]
  assert.equal(hidden.preview,undefined)
  assert.equal(hidden.phone,undefined)
  assert.equal(hidden.name,'Maria')
  assert.equal(hidden.maskedPhone,'551••••4321')
  const visible=feed.read({includePreview:true}).entries[0]
  assert.equal(visible.preview.length,3500)
  assert.equal(visible.phone,'5511987654321')
})
