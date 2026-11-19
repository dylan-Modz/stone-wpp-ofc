import fs from 'node:fs'
import path from 'node:path'

// Receptor isolado da Stone para validar transportes e mídia recebida.
// NUNCA lê a sessão do bot principal nem simula conteúdo que não chegou.
const CAMADAS = [
  'viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension',
  'ephemeralMessage', 'documentWithCaptionMessage'
]
const TIPOS = ['imageMessage', 'videoMessage', 'audioMessage']
const DURACAO_CACHE = 30 * 60 * 1000

export function inspecionarMidiaStone(event) {
  let conteudo = event?.message || {}
  let viewOnce = false
  for (let index = 0; index < 12; index++) {
    const camada = CAMADAS.find(nome => conteudo?.[nome]?.message)
    if (!camada) break
    if (camada.toLowerCase().includes('viewonce')) viewOnce = true
    conteudo = conteudo[camada].message
  }
  const tipo = TIPOS.find(nome => conteudo?.[nome])
  if (!tipo) return null
  const media = conteudo[tipo]
  if (!viewOnce && !media?.viewOnce) return null
  return {
    tipo,
    temChave: Boolean(media?.mediaKey),
    temCaminho: Boolean(media?.directPath || media?.url),
    recebida: true
  }
}

export function decidirTransporteStone(credenciais, opcoes = {}) {
  const registrada = Boolean(credenciais?.meJid || credenciais?.meLid)
  const mobilePersistido = registrada && Boolean(credenciais?.deviceInfo)
  if (!registrada) return { modo: 'vinculado', motivo: 'sessao-nova' }
  if (mobilePersistido) return { modo: 'mobile', motivo: 'credenciais-mobile' }
  if (opcoes.tentarAndroidAposVinculo === true)
    return { modo: 'mobile-experimental', motivo: 'teste-explicito' }
  return { modo: 'vinculado', motivo: 'credenciais-vinculadas' }
}

export function perfilAndroidStone({ business = false, versao = '2.26.27.70' } = {}) {
  return {
    os: 'android',
    business: business === true,
    manufacturer: 'Google',
    device: 'Pixel',
    osVersion: '14',
    osBuildNumber: 'BP11.241121.010',
    appVersion: versao,
    mcc: '000',
    mnc: '000',
    localeLanguageIso6391: 'pt',
    localeCountryIso31661Alpha2: 'BR'
  }
}

/**
 * Sessão independente em SQLite. Modo mobile só é ligado mediante identidade
 * móvel já registrada ou opt-in explícito em uma sessão DE TESTE vinculada.
 * A conexão e a entrega de mídia dependem do servidor remoto.
 *
 * @param {{
 *   diretorio: string, numero: string, business?: boolean,
 *   tentarAndroidAposVinculo?: boolean, avisar?: (texto:string)=>void,
 *   evento?: (tipo:string, dados:object)=>void
 * }} opcoes
 */
export async function criarReceptorExperimentalStone(opcoes) {
  if (!opcoes?.diretorio) throw new Error('STONE_TESTE_SESSAO_OBRIGATORIA')
  const diretorio = path.resolve(opcoes.diretorio)
  const numero = String(opcoes.numero || '').replace(/\D/g, '')
  if (!/^\d{11,15}$/.test(numero)) throw new Error('STONE_TESTE_NUMERO_INVALIDO')
  fs.mkdirSync(diretorio, { recursive: true, mode: 0o700 })

  let WaClient, createStore, fetchLatestWaMobileVersion, createSqliteStore
  try {
    ;({ WaClient, createStore, fetchLatestWaMobileVersion } = await import('zapo-js'))
    ;({ createSqliteStore } = await import('@zapo-js/store-sqlite'))
  } catch (erro) {
    throw new Error('STONE_TESTE_DEPENDENCIAS_MOBILE_AUSENTES: ' + String(erro?.message || erro))
  }
  const sqlite = createSqliteStore({ path: path.join(diretorio, 'stone-mobile.sqlite'), driver: 'auto' })
  const store = createStore({
    backends: { sqlite },
    providers: {
      auth: 'sqlite', signal: 'sqlite', preKey: 'sqlite',
      session: 'sqlite', identity: 'sqlite', senderKey: 'sqlite',
      appState: 'sqlite', privacyToken: 'sqlite',
      messages: 'none', threads: 'none', contacts: 'none'
    }
  })
  const sessionId = 'stone-test'
  const credenciais = await store.session(sessionId).auth.load()
  const modo = decidirTransporteStone(credenciais, opcoes)
  const avisar = opcoes.avisar || (() => {})
  const evento = opcoes.evento || (() => {})
  avisar('Transporte Stone: ' + modo.modo + ' (' + modo.motivo + ')')
  const config = {
    store, sessionId,
    recoverFromClientTooOld: true,
    markOnlineOnConnect: false,
    keepAliveIntervalMs: 30_000,
    history: { enabled: false }
  }
  if (modo.modo !== 'vinculado') {
    const deviceInfo = modo.modo === 'mobile' ? {
      ...credenciais.deviceInfo,
      business: opcoes.business === true || credenciais.deviceInfo.business === true
    } : perfilAndroidStone({ business: opcoes.business })
    config.mobileTransport = { deviceInfo }
    config.version = async () => {
      const versao = await fetchLatestWaMobileVersion({ timeoutMs: 10_000 })
      if (!/^\d+\.\d+\.\d+\.\d+$/.test(String(versao?.version || '')))
        throw new Error('STONE_VERSAO_MOBILE_INVALIDA')
      return versao.version
    }
  }
  const client = new WaClient(config)
  const midias = new Map()
  const registrar = mensagem => {
    const atual = inspecionarMidiaStone(mensagem)
    if (!atual) return
    evento('midia', atual)
    if (!atual.temChave || !mensagem?.key?.remoteJid || !mensagem?.key?.id) return
    const chave = mensagem.key.remoteJid + '|' + mensagem.key.id
    midias.set(chave, { media: mensagem.message, at: Date.now() })
    for (const [id, item] of midias) if (Date.now() - item.at > DURACAO_CACHE) midias.delete(id)
    while (midias.size > 300) midias.delete(midias.keys().next().value)
  }
  const olhar = (jid, id) => {
    const item = midias.get(jid + '|' + id)
    return item && Date.now() - item.at < DURACAO_CACHE ? item.media : null
  }
  let codigoSolicitado = false
  const parear = async () => {
    if (codigoSolicitado) return
    codigoSolicitado = true
    try {
      const code = await client.auth.requestPairingCode(numero)
      evento('codigo', { codigo: code })
    } catch (erro) {
      codigoSolicitado = false
      evento('erro-pareamento', { mensagem: String(erro?.message || erro) })
    }
  }
  client.on('auth_pairing_required', parear)
  client.on('auth_qr', info => {
    if (!codigoSolicitado) void parear()
    if (info?.qr) evento('qr', { disponivel: true })
  })
  client.on('auth_paired', () => evento('pareado', { ok: true }))
  client.on('message', registrar)
  client.on('message_unavailable', dado => {
    evento('indisponivel', {
      tipo: dado?.kind || 'desconhecido',
      temChave: false, temCaminho: false
    })
  })
  client.on('connection', dado => {
    evento('conexao', {
      status: dado?.status || 'desconhecido',
      motivo: dado?.reason || null,
      logout: Boolean(dado?.isLogout)
    })
  })
  return {
    modo,
    buscarMidiaRecebida: olhar,
    async conectar() { await client.connect() },
    client
  }
}
