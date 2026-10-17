export { createMemoryStore } from './memory.js';
export { createJsonStore } from './json.js';
export { createSqliteStore } from './sqlite.js';
import { createMemoryStore } from './memory.js';
import { createJsonStore } from './json.js';
import { createSqliteStore } from './sqlite.js';

export async function createStoneStore(options = {}) {
    const config = typeof options === 'string' ? { type: options } : options;
    if (config.type === 'json') return createJsonStore(config.path);
    if (config.type === 'sqlite') return createSqliteStore(config.path);
    if (!config.type || config.type === 'memory') return createMemoryStore(config.initial);
    throw new RangeError('Stone Store desconhecido: ' + config.type);
}
