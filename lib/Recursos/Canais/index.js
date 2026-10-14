import { pesquisarCanais } from './buscar.js';
import { calcularEstatisticas } from './estatisticas.js';
import { resumirReacoes } from './reacoes.js';
import { resumirEnquete } from './enquetes.js';

export { pesquisarCanais, calcularEstatisticas, resumirReacoes, resumirEnquete };

export function criarRecursosCanais(socket) {
    const metodo = nome => {
        if (typeof socket[nome] !== 'function') throw new Error('Método Stone indisponível: ' + nome);
        return socket[nome].bind(socket);
    };
    return {
        informacoes: (chave, tipo = 'jid') => metodo('newsletterMetadata')(tipo, chave),
        mensagens: (jid, quantidade = 20, desde, depois) => metodo('newsletterFetchMessages')(jid, quantidade, desde, depois),
        seguidores: jid => metodo('newsletterSubscribers')(jid),
        reagir: (jid, id, emoji) => metodo('newsletterReactMessage')(jid, id, emoji),
        seguir: jid => metodo('newsletterFollow')(jid),
        deixar: jid => metodo('newsletterUnfollow')(jid),
        buscarLocal: pesquisarCanais,
        estatisticasLocais: calcularEstatisticas,
        resumirReacoes,
        resumirEnquete
    };
}
