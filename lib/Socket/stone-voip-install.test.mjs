import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const getPackage = async () => JSON.parse(
  await readFile(new URL('../../package.json', import.meta.url), 'utf8')
)

test('o motor e o codec de chamadas entram na instalação normal da Stone', async () => {
  const manifest = await getPackage()
  for (const name of ['@zapo-js/voip', 'zapo-js', 'libmlow-wasm-fork']) {
    assert.ok(manifest.dependencies[name], name + ' deve ser dependência obrigatória')
    assert.equal(manifest.optionalDependencies?.[name], undefined)
  }
})

test('componentes com binários nativos continuam opcionais para outros hosts', async () => {
  const manifest = await getPackage()
  for (const name of ['@roamhq/wrtc', 'ffmpeg-static']) {
    assert.ok(manifest.optionalDependencies[name])
  }
})

test('README público descreve instalação Stone sem referência de marca externa', async () => {
  const readme = await readFile(new URL('../../README.md', import.meta.url), 'utf8')
  assert.doesNotMatch(readme, /zapo[\s.-]?js/i)
  // A marca pública do módulo é Vox; o detalhe técnico não é um nome de produto.
  assert.match(readme, /\bVox\b/)
  assert.match(readme, /experimental/i)
})
