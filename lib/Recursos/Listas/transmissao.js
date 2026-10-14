export function criarListasTransmissao(socket, { maxDestinatarios = 100 } = {}) {
    const listas = new Map();
    const validar = pessoa => {
        if (!pessoa || typeof pessoa.jid !== 'string' || pessoa.consentimento !== true) {
            throw new TypeError('Cada destinatário precisa de jid e consentimento: true');
        }
        if (!/^[0-9]+@(s\.whatsapp\.net|lid)$/.test(pessoa.jid)) {
            throw new TypeError('JID de destinatário inválido');
        }
        return pessoa.jid;
    };
    return {
        criar(nome, pessoas = []) {
            if (typeof nome !== 'string' || !nome.trim()) throw new TypeError('Nome obrigatório');
            if (listas.has(nome)) throw new Error('Lista Stone já existe: ' + nome);
            const destinatarios = [...new Set(pessoas.map(validar))];
            if (destinatarios.length > maxDestinatarios) throw new RangeError('Limite de destinatários excedido');
            listas.set(nome, destinatarios);
            return destinatarios.length;
        },
        adicionar(nome, pessoa) {
            if (!listas.has(nome)) throw new Error('Lista Stone inexistente: ' + nome);
            const jid = validar(pessoa), participantes = listas.get(nome);
            if (!participantes.includes(jid)) {
                if (participantes.length >= maxDestinatarios) throw new RangeError('Limite de destinatários excedido');
                participantes.push(jid);
            }
            return participantes.length;
        },
        remover(nome, jid) {
            if (!listas.has(nome)) return false;
            const antigos = listas.get(nome);
            listas.set(nome, antigos.filter(item => item !== jid));
            return antigos.length !== listas.get(nome).length;
        },
        listar() { return [...listas].map(([nome, destinatarios]) => ({ nome, quantidade: destinatarios.length })); },
        destinatarios(nome) { return [...(listas.get(nome) ?? [])]; },
        apagar(nome) { return listas.delete(nome); },
        async enviar(nome, conteudo, { pausaMs = 500, enviarPara = undefined } = {}) {
            if (!listas.has(nome)) throw new Error('Lista Stone inexistente: ' + nome);
            if (!Number.isInteger(pausaMs) || pausaMs < 0 || pausaMs > 60000) throw new RangeError('pausaMs inválida');
            const destinatarios = [...listas.get(nome)];
            const resultados = [];
            for (const [index, jid] of destinatarios.entries()) {
                try {
                    const resultado = await (enviarPara ?? socket.sendMessage.bind(socket))(jid,
                        typeof conteudo === 'string' ? { text: conteudo } : conteudo);
                    resultados.push({ jid, enviado: true, id: resultado?.key?.id });
                } catch (error) {
                    resultados.push({ jid, enviado: false, erro: String(error?.message ?? error) });
                }
                if (index + 1 < destinatarios.length && pausaMs) {
                    await new Promise(resolve => setTimeout(resolve, pausaMs));
                }
            }
            return resultados;
        }
    };
}
