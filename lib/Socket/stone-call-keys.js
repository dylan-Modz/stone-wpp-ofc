import { proto } from '../../Protocol/index.js'
import { encodeWAMessage, unpadRandomMax16 } from '../Utils/generics.js'

const children = node => Array.isArray(node?.content) ? node.content.filter(Boolean) : []

// Seleciona envelopes sem expor qualquer chave no evento de chamada.
export function collectCallKeyEnvelopes(node) {
  const offer = node?.tag === 'call' ? children(node).find(x => x.tag === 'offer') : node
  if (!offer) return []
  const direct = children(offer).filter(x => x.tag === 'enc')
  const destinations = children(offer).filter(x => x.tag === 'destination')
  const nested = destinations.flatMap(group =>
    children(group).filter(x => x.tag === 'to')
      .flatMap(target => children(target).filter(x => x.tag === 'enc')))
  return [...direct, ...nested].filter(x =>
    (x.attrs?.type === 'msg' || x.attrs?.type === 'pkmsg') &&
    x.content instanceof Uint8Array && x.content.length > 0)
}

// Descriptografa chave de chamada para uso INTERNO, usando Signal da sessão Stone.
// Não persiste material sensível nem envia a chave a eventos ou logs.
export async function decryptIncomingCallKey(signalRepository, offerNode, peerDeviceJid) {
  if (typeof signalRepository?.decryptMessage !== 'function') {
    throw new TypeError('Repositório de criptografia da Stone indisponível')
  }
  if (typeof peerDeviceJid !== 'string' || !/^[^@\s]+@[^@\s]+$/.test(peerDeviceJid)) {
    throw new TypeError('Identificador do dispositivo de origem inválido')
  }
  for (const envelope of collectCallKeyEnvelopes(offerNode)) {
    try {
      const plain = Buffer.from(await signalRepository.decryptMessage({
        jid: peerDeviceJid, type: envelope.attrs.type,
        ciphertext: Buffer.from(envelope.content)
      }))
      try {
        const message = proto.Message.decode(unpadRandomMax16(plain))
        if (message.call?.callKey?.length === 32) {
          return Buffer.from(message.call.callKey)
        }
      } finally {
        plain.fill(0)
      }
    } catch {
      // Envelopes destinados a outros dispositivos não interrompem a leitura.
    }
  }
  return null
}

// Prepara envelopes criptografados (não envia oferta nem inicia chamada).
export async function encryptCallKeyForDevices(signalRepository, ensureSessions, deviceJids, callKey) {
  if (typeof signalRepository?.encryptMessage !== 'function') {
    throw new TypeError('Repositório de criptografia da Stone indisponível')
  }
  if (typeof ensureSessions !== 'function') {
    throw new TypeError('É necessário verificar as sessões dos dispositivos')
  }
  if (!Array.isArray(deviceJids) || deviceJids.length < 1 || deviceJids.length > 32 ||
      deviceJids.some(jid => typeof jid !== 'string' || !/^[^@\s]+@[^@\s]+$/.test(jid)) ||
      new Set(deviceJids).size !== deviceJids.length) {
    throw new TypeError('Lista de dispositivos inválida ou duplicada')
  }
  if (!(callKey instanceof Uint8Array) || callKey.length !== 32) {
    throw new TypeError('A chave de chamada precisa ter 32 bytes')
  }
  await ensureSessions(deviceJids)
  const encoded = encodeWAMessage({ call: { callKey: Buffer.from(callKey) } })
  try {
    // Aguarde todas as criptografias antes de zerar o buffer compartilhado:
    // Promise.all pode rejeitar enquanto outras operações ainda o utilizam.
    const settled = await Promise.allSettled(deviceJids.map(async jid => {
      const value = await signalRepository.encryptMessage({ jid, data: encoded })
      if ((value.type !== 'msg' && value.type !== 'pkmsg') ||
          !(value.ciphertext instanceof Uint8Array) || !value.ciphertext.length) {
        throw new Error('Mensagem criptografada de chamada inválida')
      }
      return {
        jid,
        node: {
          tag: 'enc', attrs: { v: '2', type: value.type, count: '0' },
          content: Buffer.from(value.ciphertext)
        },
        identity: value.type === 'pkmsg'
      }
    }))
    const failure = settled.find(entry => entry.status === 'rejected')
    if (failure) throw failure.reason
    const results = settled.map(entry => entry.value)
    return {
      destinations: results.map(x => ({ tag:'to', attrs:{jid:x.jid}, content:[x.node] })),
      requiresDeviceIdentity: results.some(x => x.identity)
    }
  } finally {
    if (typeof encoded.fill === 'function') encoded.fill(0)
  }
}
