export async function criarLinkAudio(socket, evento, timeoutMs) {
    if (typeof socket.createCallLink !== 'function') throw new Error('Links de chamada indisponíveis');
    return socket.createCallLink('audio', evento, timeoutMs);
}
