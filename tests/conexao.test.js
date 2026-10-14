import test from 'node:test';
import assert from 'node:assert/strict';
import { attachStoneFeatures } from '../lib/Recursos/index.js';

test('Stone preserva o socket original e expõe categorias', () => {
    const sock = { sendMessage: async () => ({key:{id:'ok'}}) };
    const send = sock.sendMessage;
    const resultado = attachStoneFeatures(sock);
    assert.equal(resultado, sock);
    assert.equal(sock.sendMessage, send);
    assert.deepEqual(Object.keys(sock.stone).sort(), ['bots','canais','chamadas','grupos','listas','plugins','store']);
    assert.equal(attachStoneFeatures(sock),sock);
});
