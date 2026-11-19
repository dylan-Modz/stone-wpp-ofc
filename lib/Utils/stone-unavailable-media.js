/**
 * Classifica avisos de mídia que não contêm arquivo ou chave recebidos.
 * Não tenta contornar visualização única; preserva os eventos originais.
 */
export const classificarMidiaIndisponivel = (node, mensagem) => {
    if (mensagem?.message) return null;
    const filhos = Array.isArray(node?.content) ? node.content : [];
    const indisponivel = filhos.find(item => item?.tag === 'unavailable');
    const subtipo = String(
        indisponivel?.attrs?.type ||
        node?.attrs?.subtype ||
        (mensagem?.key?.isViewOnce ? 'view_once' : '')
    ).toLowerCase();
    if (!indisponivel && !subtipo.includes('unavailable') && !mensagem?.key?.isViewOnce) return null;
    const tipo = mensagem?.key?.isViewOnce || subtipo.includes('view_once')
        ? 'view_once'
        : subtipo.includes('hosted') || indisponivel?.attrs?.hosted === 'true'
            ? 'hosted'
            : subtipo.includes('bot')
                ? 'bot'
                : 'other';
    return {
        key: mensagem?.key,
        kind: tipo,
        subtype: subtipo || 'unknown',
        hasContent: false,
        hasMediaKey: false,
        resendEligible: tipo === 'other'
    };
};
