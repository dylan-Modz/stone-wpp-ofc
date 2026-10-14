import { createMemoryStore } from '../Store/memory.js';
import { createStonePluginManager } from '../Plugins/manager.js';
import { criarRecursosCanais } from './Canais/index.js';
import { criarRecursosGrupos } from './Grupos/index.js';
import { criarRecursosBots } from './Bots/index.js';
import { criarListasTransmissao } from './Listas/index.js';
import { criarRecursosChamadas } from './Chamadas/index.js';

export { criarRecursosCanais, criarRecursosGrupos, criarRecursosBots, criarListasTransmissao, criarRecursosChamadas };
export function attachStoneFeatures(socket, options = {}) {
    if (!socket || typeof socket !== 'object' || typeof socket.sendMessage !== 'function') {
        throw new TypeError('Socket Stone inválido');
    }
    if (socket.stone) return socket;
    const memoria = options.store ?? createMemoryStore();
    const stone = {
        canais: criarRecursosCanais(socket),
        grupos: criarRecursosGrupos(socket, memoria),
        bots: criarRecursosBots(socket),
        listas: criarListasTransmissao(socket, options.listas),
        chamadas: criarRecursosChamadas(socket),
        store: memoria,
        plugins: createStonePluginManager(socket)
    };
    Object.defineProperty(socket, 'stone', { value: stone, enumerable: true, configurable: false });
    return socket;
}
