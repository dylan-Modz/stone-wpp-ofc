const copy = value => value === undefined ? undefined : structuredClone(value);

export function createMemoryStore(initial = {}) {
    const data = new Map(Object.entries(initial).map(([key, value]) => [key, copy(value)]));
    let closed = false;
    const guard = () => { if (closed) throw new Error('Stone Store está fechado'); };
    return {
        async get(key) { guard(); return copy(data.get(String(key))); },
        async set(key, value) { guard(); data.set(String(key), copy(value)); return true; },
        async delete(key) { guard(); return data.delete(String(key)); },
        async list(prefix = '') {
            guard();
            return [...data].filter(([key]) => key.startsWith(String(prefix)))
                .map(([key, value]) => ({ key, value: copy(value) }));
        },
        async clear() { guard(); data.clear(); },
        async close() { data.clear(); closed = true; }
    };
}
