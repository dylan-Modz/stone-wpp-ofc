export function resumirReacoes(reacoes = []) {
    if (!Array.isArray(reacoes)) throw new TypeError('Informe uma lista de reações');
    const contagem = {};
    for (const item of reacoes) {
        const emoji = typeof item === 'string' ? item : item?.emoji ?? item?.code ?? item?.reaction;
        if (!emoji) continue;
        const quantidade = Number(typeof item === 'string' ? 1 : item.count ?? 1);
        if (Number.isFinite(quantidade) && quantidade > 0) {
            contagem[emoji] = (contagem[emoji] || 0) + quantidade;
        }
    }
    return contagem;
}
