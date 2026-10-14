import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { criarRecursosBots } from '../lib/Recursos/Bots/index.js';

test('Stone envia mensagens e escuta somente o destinatário escolhido', async () => {
    const ev = new EventEmitter();
    let envio, recebidas = 0;
    const b = criarRecursosBots({
        ev,
        sendMessage: async (...args) => { envio=args; return {key:{id:'1'}}; },
        getBotListV2: async () => ['a','b']
    });
    const fim=b.escutar('123@s.whatsapp.net',()=>recebidas++);
    ev.emit('messages.upsert',{messages:[{key:{remoteJid:'321@s.whatsapp.net'}},{key:{remoteJid:'123@s.whatsapp.net'}}]});
    assert.equal(recebidas,1);
    await b.enviar('123@s.whatsapp.net','oi');
    assert.deepEqual(envio,['123@s.whatsapp.net',{text:'oi'},{}]);
    assert.deepEqual(await b.listar(),['a','b']);
    fim();
    ev.emit('messages.upsert',{messages:[{key:{remoteJid:'123@s.whatsapp.net'}}]});
    assert.equal(recebidas,1);
});
