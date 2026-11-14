import test from 'node:test';
import assert from 'node:assert/strict';
import { buildUnavailableViewOnceEvent } from './view-once-unavailable.js';

const placeholder = {
    key: { remoteJid: 'teste@g.us', id: 'M1', participant: 'usuario@lid' },
    messageTimestamp: 1800000000
};

test('aviso view_once sem conteúdo gera evento seguro e chave de referência', () => {
    const event = buildUnavailableViewOnceEvent('view_once', placeholder);
    assert.equal(event.kind, 'view_once');
    assert.equal(event.key.remoteJid, 'teste@g.us');
    assert.equal(event.key.id, 'M1');
    assert.equal(event.key.isViewOnce, true);
    assert.equal(event.messageTimestamp, 1800000000);
    assert.equal('mediaKey' in event, false);
});

test('aviso view_once_unavailable_fanout também é observado', () => {
    const event = buildUnavailableViewOnceEvent('view_once_unavailable_fanout', placeholder);
    assert.equal(event.unavailableType, 'view_once_unavailable_fanout');
});

test('não inventa mídia nem evento quando o conteúdo real veio completo', () => {
    const real = { ...placeholder, message: { imageMessage: { mediaKey: Uint8Array.from([1, 2]) } } };
    assert.equal(buildUnavailableViewOnceEvent('view_once', real), null);
    assert.equal(buildUnavailableViewOnceEvent('chat', placeholder), null);
    assert.equal(buildUnavailableViewOnceEvent('view_once', { key: { remoteJid: 'teste@g.us' } }), null);
});
