export function criarHistoricoGrupos(store) {
    if (!store || typeof store.get !== 'function' || typeof store.set !== 'function') {
        throw new TypeError('Stone Store inválido');
    }
    const chave = jid => {
        if (typeof jid !== 'string' || !jid.endsWith('@g.us')) throw new TypeError('JID de grupo inválido');
        return 'historico:' + jid;
    };
    return {
        async salvar(jid, mensagem, limite = 100) {
            if (!Number.isInteger(limite) || limite < 1 || limite > 1000) throw new RangeError('limite inválido');
            const id = chave(jid);
            const anteriores = await store.get(id) ?? [];
            const proximo = [...anteriores, mensagem].slice(-limite);
            await store.set(id, proximo);
            return proximo.length;
        },
        async listar(jid, limite = 50) {
            if (!Number.isInteger(limite) || limite < 1 || limite > 1000) throw new RangeError('limite inválido');
            return (await store.get(chave(jid)) ?? []).slice(-limite);
        },
        apagar: jid => store.delete(chave(jid))
    };
}
