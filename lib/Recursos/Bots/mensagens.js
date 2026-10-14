export function criarRecursosBots(socket) {
    return {
        listar: () => {
            if (typeof socket.getBotListV2 !== 'function') throw new Error('Busca de bots indisponível');
            return socket.getBotListV2();
        },
        enviar: (jid, mensagem, opcoes = {}) => socket.sendMessage(jid,
            typeof mensagem === 'string' ? { text: mensagem } : mensagem, opcoes),
        escutar: (jid, callback) => {
            if (typeof callback !== 'function') throw new TypeError('Callback obrigatório');
            if (!socket.ev?.on || !socket.ev?.off) throw new Error('Eventos indisponíveis');
            const listener = event => {
                for (const msg of event?.messages ?? []) {
                    if (msg?.key?.remoteJid === jid) callback(msg);
                }
            };
            socket.ev.on('messages.upsert', listener);
            return () => socket.ev.off('messages.upsert', listener);
        }
    };
}
