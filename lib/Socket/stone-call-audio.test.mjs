import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { decodeStoneCallAudio, feedStoneCallAudio, STONE_CALL_AUDIO_FORMAT } from './stone-call-audio.js'

test('Formato de áudio: 16 kHz mono, 20 ms e 320 amostras', () => {
  assert.deepEqual(STONE_CALL_AUDIO_FORMAT, {
    sampleRate: 16000, channels: 1, samplesPerFrame: 320,
    frameMs: 20, format: 'f32le'
  })
})

test('Faz conversão PCM por FFmpeg quando o executável estiver disponível', async t => {
  if (spawnSync('ffmpeg', ['-version'], { stdio:'ignore' }).status !== 0) {
    t.skip('FFmpeg não instalado no ambiente de teste')
    return
  }
  const folder = await mkdtemp(join(tmpdir(),'stone-audio-'))
  try {
    const input = join(folder,'tone.wav')
    const result = spawnSync('ffmpeg',[
      '-hide_banner','-loglevel','error','-f','lavfi',
      '-i','sine=frequency=440:duration=0.17',
      '-c:a','pcm_s16le','-y',input
    ],{encoding:'utf8'})
    assert.equal(result.status,0,result.stderr)
    let count = 0, peak = 0
    const sent = await feedStoneCallAudio(decodeStoneCallAudio(input), {
      feedAudio: frame => {
        count++
        assert.ok(frame instanceof Float32Array)
        assert.equal(frame.length,320)
        for(const sample of frame) peak = Math.max(peak,Math.abs(sample))
      },
      getBufferedMs: () => 0
    })
    assert.equal(sent.frames, count)
    assert.ok(count >= 8 && count <= 10)
    assert.ok(peak > 0)
  } finally {
    await rm(folder,{recursive:true,force:true})
  }
})

test('Rejeita transporte falso e quadro inválido sem declarar sucesso', async () => {
  await assert.rejects(() => feedStoneCallAudio([],{}),/transporte/)
  async function* wrongFrames(){yield new Float32Array(12)}
  await assert.rejects(() => feedStoneCallAudio(wrongFrames(),{
    feedAudio:()=>{},getBufferedMs:()=>0
  }),/Frame PCM inválido/)
})
