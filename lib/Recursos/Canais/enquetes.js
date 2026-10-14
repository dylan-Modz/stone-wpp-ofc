export function resumirEnquete(enquete) {
    if (!enquete || typeof enquete !== 'object') throw new TypeError('Enquete inválida');
    const opcoes = enquete.options ?? enquete.opcoes ?? [];
    if (!Array.isArray(opcoes)) throw new TypeError('Opções inválidas');
    const total = opcoes.reduce((soma, opcao) => soma + Math.max(0, Number(opcao.votes ?? opcao.votos ?? 0) || 0), 0);
    return { titulo: enquete.name ?? enquete.title ?? enquete.titulo ?? '',
        totalVotos: total,
        opcoes: opcoes.map(opcao => ({
            nome: opcao.optionName ?? opcao.name ?? opcao.nome ?? '',
            votos: Math.max(0, Number(opcao.votes ?? opcao.votos ?? 0) || 0)
        })) };
}
