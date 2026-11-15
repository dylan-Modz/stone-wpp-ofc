import test from 'node:test';
import assert from 'node:assert/strict';
import { emitMediaAvailability } from './stone-media-availability.js';

test('emits only metadata for unavailable view-once messages', () => {
    const events = [];
    const ev = { emit(name, data) { events.push({ name, data }); } };
    const key = { remoteJid: '123@g.us', id: 'msg-1', participant: 'abc@lid' };
    assert.equal(emitMediaAvailability(ev, key, 'view_once_unavailable'), true);
    assert.equal(events[0].name, 'stone.message.availability');
    assert.equal(events[0].data.remoteJid, '123@g.us');
    assert.equal(events[0].data.messageId, 'msg-1');
    assert.equal(events[0].data.available, false);
    assert.equal(events[0].data.reason, 'view_once_unavailable');
    assert.equal(events[0].data.participant, undefined);
    assert.equal(events[0].data.mediaKey, undefined);
    assert.equal(typeof events[0].data.receivedAt, 'number');
});

test('rejects incomplete or arbitrary availability events', () => {
    const events = [];
    const ev = { emit: (...x) => events.push(x) };
    assert.equal(emitMediaAvailability(ev, {}, 'view_once_unavailable'), false);
    assert.equal(emitMediaAvailability(ev, { remoteJid: 'a@g.us', id: 'b' }, 'anything'), false);
    assert.equal(emitMediaAvailability(ev, { remoteJid: 'a@g.us', id: 'b' }, 'view_once_unavailable_fanout'), true);
    assert.equal(emitMediaAvailability(ev, { remoteJid: 'a@g.us', id: 'b' }, 'missing_message_secret'), true);
    assert.equal(events.length, 2);
});
