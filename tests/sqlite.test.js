import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSqliteStore } from '../lib/Store/sqlite.js';

test('Stone SQLite persiste e filtra as chaves, quando suportado', async t => {
    try { await import('node:sqlite'); }
    catch { t.skip('Node sem node:sqlite'); return; }
    const dir=await mkdtemp(join(tmpdir(),'stone-sqlite-'));
    try {
        const file=join(dir,'stone.db');
        const a=await createSqliteStore(file);
        await a.set('grupo:1',{x:1});
        await a.set('outro',[2]);
        assert.deepEqual(await a.list('grupo:'),[{key:'grupo:1',value:{x:1}}]);
        await a.close();
        const b=await createSqliteStore(file);
        assert.deepEqual(await b.get('outro'),[2]);
        await b.close();
    } finally {
        await rm(dir,{recursive:true,force:true});
    }
});
