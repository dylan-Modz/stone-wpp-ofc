import test from 'node:test';
import assert from 'node:assert/strict';
import { classificarMidiaIndisponivel } from './stone-unavailable-media.js';

const stub = { key: { remoteJid: 'chat@s.whatsapp.net', id: 'abc', isViewOnce: true } };

test('identifica view-once sem conteúdo e não oferece reenvio', () => {
    const actual = classificarMidiaIndisponivel({
        content: [{ tag: 'unavailable', attrs: { type: 'view_once' } }]
    }, stub);
    assert.equal(actual.kind, 'view_once');
    assert.equal(actual.hasContent, false);
    assert.equal(actual.hasMediaKey, false);
    assert.equal(actual.resendEligible, false);
});

test('subtipo view_once_unavailable_fanout também é classificado', () => {
    const actual = classificarMidiaIndisponivel({
        attrs: { subtype: 'view_once_unavailable_fanout' }
    }, { key: { remoteJid: 'a', id: 'b' } });
    assert.equal(actual.kind, 'view_once');
});

test('mídia já recebida não gera evento de indisponível', () => {
    const actual = classificarMidiaIndisponivel({
        content: [{ tag: 'unavailable', attrs: { type: 'view_once' } }]
    }, { ...stub, message: { imageMessage: { mediaKey: Buffer.from('ok') } } });
    assert.equal(actual, null);
});

test('placeholder comum pode tentar reenvio do principal', () => {
    const actual = classificarMidiaIndisponivel({
        content: [{ tag: 'unavailable', attrs: { type: 'other' } }]
    }, { key: { remoteJid: 'a', id: 'b' } });
    assert.equal(actual.kind, 'other');
    assert.equal(actual.resendEligible, true);
});
