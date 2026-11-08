import { spawn } from 'node:child_process'
import { access } from 'node:fs/promises'
import { setTimeout as sleep } from 'node:timers/promises'

const SAMPLE_RATE = 16000
const FRAME_MS = 20
const SAMPLES = SAMPLE_RATE * FRAME_MS / 1000
const STDERR_LIMIT = 8192

/**
 * Decodifica qualquer arquivo reconhecido pelo FFmpeg em quadros PCM de
 * 20 ms, 16 kHz, mono, Float32Array. É uma fonte de áudio, não um socket VoIP.
 * Um transporte de mídia conectado precisa consumir os quadros.
 */
export async function* decodeStoneCallAudio(inputPath, options = {}) {
  if (typeof inputPath !== 'string' || !inputPath.trim()) {
    throw new TypeError('Informe o arquivo de áudio')
  }
  await access(inputPath)
  const { ffmpegPath = 'ffmpeg', signal } = options
  if (typeof ffmpegPath !== 'string' || !ffmpegPath.trim()) {
    throw new TypeError('Executável FFmpeg inválido')
  }
  if (signal?.aborted) throw signal.reason ?? new Error('Operação cancelada')
  const child = spawn(ffmpegPath, [
    '-nostdin', '-hide_banner', '-loglevel', 'error',
    '-i', inputPath, '-vn', '-sn', '-dn',
    '-ac', '1', '-ar', String(SAMPLE_RATE), '-f', 'f32le', 'pipe:1'
  ], { stdio: ['ignore', 'pipe', 'pipe'] })

  let spawnError = null
  let stderr = ''
  const closed = new Promise(resolve => {
    child.once('error', error => { spawnError = error })
    child.once('close', (code, closeSignal) => resolve({ code, closeSignal }))
  })
  const stop = () => { if (!child.killed) child.kill('SIGTERM') }
  signal?.addEventListener('abort', stop, { once: true })
  child.stderr?.on('data', data => {
    stderr = (stderr + String(data)).slice(-STDERR_LIMIT)
  })

  let pending = Buffer.alloc(0)
  const frameBytes = SAMPLES * Float32Array.BYTES_PER_ELEMENT
  try {
    for await (const chunk of child.stdout) {
      if (signal?.aborted) throw signal.reason ?? new Error('Operação cancelada')
      pending = pending.length ? Buffer.concat([pending, chunk]) : chunk
      while (pending.length >= frameBytes) {
        const frame = new Float32Array(SAMPLES)
        for (let i = 0; i < SAMPLES; i++) frame[i] = pending.readFloatLE(i * 4)
        pending = pending.subarray(frameBytes)
        yield frame
      }
    }
    const outcome = await closed
    if (spawnError) throw spawnError
    if (signal?.aborted) throw signal.reason ?? new Error('Operação cancelada')
    if (outcome.code !== 0) {
      throw new Error(`Falha FFmpeg (${outcome.code ?? outcome.closeSignal}): ${stderr.trim()}`)
    }
    if (pending.length) {
      if (pending.length % 4 !== 0) throw new Error('Frame PCM inválido')
      const frame = new Float32Array(SAMPLES)
      for (let i = 0; i < pending.length / 4; i++) frame[i] = pending.readFloatLE(i * 4)
      yield frame
    }
  } finally {
    stop()
    signal?.removeEventListener('abort', stop)
    await closed
  }
}

/**
 * Alimenta um transporte de mídia real, quando disponível, regulando buffer.
 * Não negocia chamada e não simula conexão. Recebe as funções do transporte
 * como injeção de dependência para não duplicar sessões do WhatsApp.
 */
export async function feedStoneCallAudio(frames, {
  feedAudio, getBufferedMs, maxBufferedMs = 600, resumeBelowMs = 200,
  idleTimeoutMs = 30000, signal
} = {}) {
  if (typeof feedAudio !== 'function' || typeof getBufferedMs !== 'function') {
    throw new TypeError('É necessário fornecer o transporte de áudio e a leitura de buffer')
  }
  if (!Number.isFinite(maxBufferedMs) || !Number.isFinite(resumeBelowMs) ||
      resumeBelowMs < 0 || maxBufferedMs < resumeBelowMs || maxBufferedMs > 10000) {
    throw new RangeError('Limites do buffer de áudio inválidos')
  }
  if (!Number.isFinite(idleTimeoutMs) || idleTimeoutMs <= 0) {
    throw new RangeError('Tempo limite inválido')
  }
  let count = 0
  for await (const frame of frames) {
    if (signal?.aborted) throw signal.reason ?? new Error('Operação cancelada')
    if (!(frame instanceof Float32Array) || frame.length !== SAMPLES) {
      throw new TypeError('Frame PCM inválido: esperado Float32Array de 320 amostras')
    }
    let started = 0
    while (getBufferedMs() > maxBufferedMs) {
      if (!started) started = Date.now()
      if (Date.now() - started >= idleTimeoutMs) {
        throw new Error('Transporte de mídia não esvazia o buffer de áudio')
      }
      await sleep(20, undefined, { signal })
      if (getBufferedMs() <= resumeBelowMs) break
    }
    await feedAudio(frame)
    count++
  }
  return { frames: count, durationMs: count * FRAME_MS }
}

export const STONE_CALL_AUDIO_FORMAT = Object.freeze({
  sampleRate: SAMPLE_RATE, channels: 1,
  samplesPerFrame: SAMPLES, frameMs: FRAME_MS, format: 'f32le'
})
