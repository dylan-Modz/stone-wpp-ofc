import { criarLinkAudio } from './audio.js';
import { criarLinkVideo } from './video.js';
export { criarLinkAudio, criarLinkVideo };

export function criarRecursosChamadas(socket) {
    return {
        linkAudio: (evento, timeoutMs) => criarLinkAudio(socket, evento, timeoutMs),
        linkVideo: (evento, timeoutMs) => criarLinkVideo(socket, evento, timeoutMs),
        rejeitar: (id, remetente) => {
            if (!id || !remetente) throw new TypeError('ID e remetente da chamada são obrigatórios');
            if (typeof socket.rejectCall !== 'function') throw new Error('Rejeição de chamada indisponível');
            return socket.rejectCall(id, remetente);
        }
    };
}
