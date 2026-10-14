import { criarHistoricoGrupos } from './historico.js';
import { criarPermissoesGrupos } from './permissoes.js';

export { criarHistoricoGrupos, criarPermissoesGrupos };
export function criarRecursosGrupos(socket, store) {
    return { permissoes: criarPermissoesGrupos(socket), historico: criarHistoricoGrupos(store) };
}
