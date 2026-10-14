import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { attachStoneFeatures } from '../lib/Recursos/index.js';

function simulado() {
    const chamadas=[];
    const s={
        ev:new EventEmitter(),
        sendMessage:async(...args)=>{chamadas.push(args); return {key:{id:'123'}};},
        newsletterMetadata:async(...args)=>args,
        newsletterReactMessage:async(...args)=>args,
        createCallLink:async(type)=>'token-'+type,
        rejectCall:async(...args)=>args
    };
    return {s,chamadas};
}
test('Stone anexa interface sem substituir métodos existentes', async () => {
    const {s}=simulado(), send=s.sendMessage;
    assert.equal(attachStoneFeatures(s),s);
    assert.equal(attachStoneFeatures(s),s);
    assert.equal(s.sendMessage,send);
    assert.deepEqual(await s.stone.canais.informacoes('0@newsletter'),['jid','0@newsletter']);
    assert.equal(await s.stone.chamadas.linkVideo(),'token-video');
});
test('Stone plugins instalam e liberam recursos', async () => {
    const {s}=simulado();attachStoneFeatures(s);
    let alive=false;
    await s.stone.plugins.use({name:'teste',install:()=>{alive=true;return()=>{alive=false}}});
    assert.deepEqual(s.stone.plugins.list(),['teste']);
    await s.stone.plugins.remove('teste');
    assert.equal(alive,false);
});
test('Stone listas exigem consentimento e enviam em sequência', async () => {
    const {s,chamadas}=simulado();attachStoneFeatures(s);
    assert.throws(()=>s.stone.listas.criar('ruim',[{jid:'5511999999999@s.whatsapp.net'}]));
    s.stone.listas.criar('avisos',[{jid:'5511999999999@s.whatsapp.net',consentimento:true}]);
    const resposta=await s.stone.listas.enviar('avisos','Olá',{pausaMs:0});
    assert.equal(resposta[0].enviado,true);
    assert.deepEqual(chamadas[0][1],{text:'Olá'});
});
