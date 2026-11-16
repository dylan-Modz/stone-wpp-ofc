import { createSessionManager } from './session-manager.js'
import { createGatewayHttpServer } from './server.js'

const token = process.env.STONE_API_TOKEN
if (!token || token.length < 24) {
  console.error('[stone-gateway] Defina STONE_API_TOKEN com pelo menos 24 caracteres.')
  process.exitCode = 1
} else {
  const host = process.env.STONE_HOST || '127.0.0.1'
  const port = Number(process.env.STONE_PORT || 3017)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('STONE_PORT inválida')
  const origins = (process.env.STONE_ALLOWED_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean)
  let manager
  try {
    manager = await createSessionManager({ dataDir: process.env.STONE_DATA_DIR })
  } catch (error) {
    if (error.message === 'gateway_data_directory_in_use') {
      console.error('[stone-gateway] Esta pasta de sessão já está sendo usada por outro processo. Encerre o Gateway antigo antes de iniciar novamente.')
    } else {
      console.error('[stone-gateway] Não foi possível iniciar o Gateway:', error.message)
    }
    process.exit(1)
  }
  await manager.restore()
  const server = createGatewayHttpServer({ manager, token, origins })
  server.listen(port, host, () => {
    console.log('[stone-gateway] Servidor ativo em ' + host + ':' + port)
    if (host !== '127.0.0.1' && host !== '::1' && host !== 'localhost') {
      console.warn('[stone-gateway] Exposição externa exige proxy HTTPS, firewall e autenticação.')
    }
  })
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, async () => {
      server.close()
      await manager.shutdown()
      process.exit(0)
    })
  }
}
