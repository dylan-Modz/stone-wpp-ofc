import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createMemoryStore, createJsonStore } from '../lib/Store/index.js';

test('Stone MemoryStore copia dados e respeita prefixos', async () => {
    const store = createMemoryStore();
    await store.set('grupo:1',{a:1});
    const c = await store.get('grupo:1'); c.a=7;
    assert.deepEqual(await store.get('grupo:1'), {a:1});
    assert.equal((await store.list('grupo:')).length,1);
    assert.equal(await store.delete('grupo:1'),true);
    await store.close();
});
test('Stone JsonStore persiste sem usar dependências externas', async () => {
    const dir = await mkdtemp(join(tmpdir(),'stone-'));
    try {
        const file = join(dir,'db.json');
        const a = await createJsonStore(file);
        await Promise.all([a.set('um',{x:1}),a.set('dois',[2])]);
        await a.close();
        const b = await createJsonStore(file);
        assert.deepEqual(await b.get('um'),{x:1});
        assert.deepEqual(await b.get('dois'),[2]);
        await b.close();
    } finally {
        await rm(dir,{recursive:true,force:true});
    }
});
