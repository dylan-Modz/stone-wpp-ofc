import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export async function createJsonStore(filename) {
    if (!filename || typeof filename !== 'string') throw new TypeError('Informe o caminho do arquivo JSON');
    let saved;
    try {
        saved = JSON.parse(await readFile(filename, 'utf8'));
        if (!saved || typeof saved !== 'object' || Array.isArray(saved)) throw new Error('Stone Store JSON inválido');
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        saved = {};
    }
    const data = new Map(Object.entries(saved));
    let closed = false, queue = Promise.resolve();
    const guard = () => { if (closed) throw new Error('Stone Store está fechado'); };
    const snapshot = () => Object.fromEntries(data);
    const persist = () => {
        const content = JSON.stringify(snapshot(), null, 2) + '\n';
        queue = queue.catch(() => {}).then(async () => {
            await mkdir(dirname(filename), { recursive: true });
            const tmp = filename + '.tmp-' + process.pid + '-' + Math.random().toString(36).slice(2);
            try {
                await writeFile(tmp, content, { mode: 0o600 });
                await rename(tmp, filename);
            } catch (error) {
                const { unlink } = await import('node:fs/promises');
                await unlink(tmp).catch(() => {});
                throw error;
            }
        });
        return queue;
    };
    const copy = value => value === undefined ? undefined : structuredClone(value);
    return {
        async get(key) { guard(); return copy(data.get(String(key))); },
        async set(key, value) {
            guard();
            if (value === undefined) throw new TypeError('JSON não aceita undefined');
            data.set(String(key), copy(value));
            await persist();
            return true;
        },
        async delete(key) { guard(); const removed = data.delete(String(key)); if (removed) await persist(); return removed; },
        async list(prefix = '') {
            guard();
            return [...data].filter(([key]) => key.startsWith(String(prefix)))
                .map(([key, value]) => ({ key, value: copy(value) }));
        },
        async clear() { guard(); data.clear(); await persist(); },
        async close() { if (!closed) { await queue; closed = true; } }
    };
}
