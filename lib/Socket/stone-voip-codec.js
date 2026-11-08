/**
 * Verifica o motor MLow usando as condições ESM do pacote. Este codec é
 * distribuído só como módulo ESM: require.resolve() produz
 * ERR_PACKAGE_PATH_NOT_EXPORTED mesmo quando ele está instalado.
 *
 * A função de importação é injetável para o teste de regressão.
 */
export async function loadStoneVoipCodec(load = () => import('libmlow-wasm-fork')) {
  let codec
  try {
    codec = await load()
  } catch (error) {
    const missing = error?.code === 'ERR_MODULE_NOT_FOUND'
    const cause = error?.message || String(error)
    const next = new Error(
      missing
        ? `Codec MLow não instalado: ${cause}`
        : `Falha ao carregar o codec MLow via ESM: ${cause}`,
      { cause: error }
    )
    next.code = missing ? 'STONE_VOIP_CODEC_MISSING' : 'STONE_VOIP_CODEC_LOAD_FAILED'
    throw next
  }
  if (typeof codec?.createEncoder !== 'function' ||
      typeof codec?.createDecoder !== 'function') {
    const error = new Error(
      'Codec MLow instalado, mas sem createEncoder/createDecoder; verifique a versão'
    )
    error.code = 'STONE_VOIP_CODEC_INVALID'
    throw error
  }
  return codec
}
