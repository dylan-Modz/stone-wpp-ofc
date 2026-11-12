/**
 * Escolhe o transporte de mídia sem criar uma segunda sessão WhatsApp.
 * WebRTC é a primeira opção. Hosts sem binário nativo podem tentar UDP
 * direto; essa alternativa continua experimental e depende do relay.
 */
export async function resolveStoneVoipTransport(options = {}, loadWebRtc = () => import('@roamhq/wrtc')) {
  if (options.useRawUdpTransport === true) {
    return { kind: 'raw-udp', fallback: false, warning: null }
  }

  try {
    const module = await loadWebRtc()
    const connection = module?.RTCPeerConnection || module?.default?.RTCPeerConnection
    if (typeof connection !== 'function') {
      const invalid = new Error('Módulo WebRTC não exporta RTCPeerConnection')
      invalid.code = 'STONE_VOIP_WEBRTC_INVALID'
      throw invalid
    }
    return { kind: 'webrtc', fallback: false, warning: null }
  } catch (error) {
    const code = error?.code === 'ERR_MODULE_NOT_FOUND'
      ? 'STONE_VOIP_WEBRTC_MISSING'
      : 'STONE_VOIP_WEBRTC_LOAD_FAILED'

    if (options.rawUdpFallback === false) {
      const unavailable = new Error(
        'WebRTC não está disponível neste host. Use um host compatível ou habilite o fallback UDP experimental.',
        { cause: error }
      )
      unavailable.code = code
      throw unavailable
    }

    return {
      kind: 'raw-udp',
      fallback: true,
      warning: {
        code,
        message: 'WebRTC indisponível; usando transporte UDP experimental: ' +
          (error?.message || String(error))
      }
    }
  }
}
