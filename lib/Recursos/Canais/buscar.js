const norm = text => String(text ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function pesquisarCanais(canais, termo, { limite = 20 } = {}) {
    if (!Array.isArray(canais)) throw new TypeError('canais deve ser uma lista');
    if (!Number.isInteger(limite) || limite < 1 || limite > 100) throw new RangeError('limite deve ser de 1 a 100');
    const query = norm(termo).trim();
    return canais.filter(canal => {
        if (!canal || typeof canal !== 'object') return false;
        return !query || [canal.name, canal.title, canal.description, canal.id]
            .some(value => norm(value).includes(query));
    }).slice(0, limite);
}
