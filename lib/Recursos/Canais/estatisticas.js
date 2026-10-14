export function calcularEstatisticas(mensagens = []) {
    if (!Array.isArray(mensagens)) throw new TypeError('Informe uma lista de mensagens');
    let visualizacoes = 0, reacoes = 0, enquetes = 0;
    for (const m of mensagens) {
        if (!m || typeof m !== 'object') continue;
        const views = Number(m.views ?? m.viewCount ?? m.view_count ?? 0);
        if (Number.isFinite(views) && views > 0) visualizacoes += views;
        const count = Number(m.reactionCount ?? m.reactions_count ?? 0);
        if (Number.isFinite(count) && count > 0) reacoes += count;
        else if (Array.isArray(m.reactions)) reacoes += m.reactions.length;
        if (m.poll || m.pollCreationMessage) enquetes++;
    }
    return { mensagens: mensagens.length, visualizacoes, reacoes, enquetes,
        taxaDeReacao: visualizacoes ? reacoes / visualizacoes : 0 };
}
