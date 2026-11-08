import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadStoneVoipCodec } from './stone-voip-codec.js'

test('codec ESM import-only é aceito sem require.resolve()', async () => {
  let imported = false
  const mod = { createEncoder: async () => {}, createDecoder: async () => {} }
  const result = await loadStoneVoipCodec(async () => {
    imported = true
    return mod
  })
  assert.equal(imported, true)
  assert.equal(result, mod)
})

test('distinção entre pacote ausente e falha de carregamento', async () => {
  await assert.rejects(
    loadStoneVoipCodec(async () => {
      const err = new Error('Cannot find package')
      err.code = 'ERR_MODULE_NOT_FOUND'
      throw err
    }),
    err => err.code === 'STONE_VOIP_CODEC_MISSING'
  )
  await assert.rejects(
    loadStoneVoipCodec(async () => {
      const err = new Error('WASM load failure')
      err.code = 'ERR_INVALID_PACKAGE_CONFIG'
      throw err
    }),
    err => err.code === 'STONE_VOIP_CODEC_LOAD_FAILED'
  )
})

test('codec de API incompatível retorna diagnóstico específico', async () => {
  await assert.rejects(loadStoneVoipCodec(async () => ({})),
    error => error.code === 'STONE_VOIP_CODEC_INVALID')
})
