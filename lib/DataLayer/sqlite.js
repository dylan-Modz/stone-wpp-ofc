import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

// Adaptador opcional: usa node:sqlite disponível nas versões recentes do Node.
// Não acrescenta dependências à instalação padrão.
export async function createSqliteStore(filename) {
    if (!filename || typeof filename !== 'string') throw new TypeError('Informe o caminho do SQLite');
    let DatabaseSync;
    try {
        ({ DatabaseSync } = await import('node:sqlite'));
    } catch {
        throw new Error('Stone SQLite requer Node.js com suporte a node:sqlite');
    }
    if (!DatabaseSync) throw new Error('Stone SQLite indisponível nesta versão do Node.js');
    await mkdir(dirname(filename), { recursive: true });
    const db = new DatabaseSync(filename);
    db.exec('PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS stone_kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    const get = db.prepare('SELECT value FROM stone_kv WHERE key = ?');
    const set = db.prepare('INSERT INTO stone_kv (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
    const del = db.prepare('DELETE FROM stone_kv WHERE key = ?');
    const list = db.prepare('SELECT key,value FROM stone_kv WHERE key LIKE ? ESCAPE \'\\\' ORDER BY key');
    let closed = false;
    const guard = () => { if (closed) throw new Error('Stone Store está fechado'); };
    return {
        async get(key) { guard(); const row = get.get(String(key)); return row ? JSON.parse(row.value) : undefined; },
        async set(key, value) { guard(); set.run(String(key), JSON.stringify(value)); return true; },
        async delete(key) { guard(); return del.run(String(key)).changes > 0; },
        async list(prefix = '') {
            guard();
            const escaped = String(prefix).replace(/[\\%_]/g, '\\$&');
            return list.all(escaped + '%').map(row => ({ key: row.key, value: JSON.parse(row.value) }));
        },
        async clear() { guard(); db.exec('DELETE FROM stone_kv'); },
        async close() { if (!closed) { closed = true; db.close(); } }
    };
}
