export function criarPermissoesGrupos(socket) {
    const executar = (nome, ...args) => {
        if (typeof socket[nome] !== 'function') throw new Error('Método Stone indisponível: ' + nome);
        return socket[nome](...args);
    };
    return {
        somenteAdminsEnviam: (jid, ativar = true) =>
            executar('groupSettingUpdate', jid, ativar ? 'announcement' : 'not_announcement'),
        somenteAdminsEditam: (jid, ativar = true) =>
            executar('groupSettingUpdate', jid, ativar ? 'locked' : 'unlocked'),
        aprovarEntrada: (jid, ativar = true) =>
            executar('groupJoinApprovalMode', jid, ativar ? 'on' : 'off'),
        permitirAdicaoPorMembros: (jid, ativar = true) =>
            executar('groupMemberAddMode', jid, ativar ? 'all_member_add' : 'admin_add'),
        solicitacoes: jid => executar('groupRequestParticipantsList', jid),
        decidirSolicitacoes: (jid, jids, acao) => {
            if (!['approve', 'reject'].includes(acao)) throw new RangeError('Use approve ou reject');
            return executar('groupRequestParticipantsUpdate', jid, jids, acao);
        }
    };
}
