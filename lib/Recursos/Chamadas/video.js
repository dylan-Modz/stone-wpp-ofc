export async function criarLinkVideo(socket, evento, timeoutMs) {
    if (typeof socket.createCallLink !== 'function') throw new Error('Links de chamada indisponíveis');
    return socket.createCallLink('video', evento, timeoutMs);
}
