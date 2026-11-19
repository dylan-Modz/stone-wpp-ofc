import test from 'node:test'
import assert from 'node:assert/strict'
import {
  inspecionarMidiaStone,
  decidirTransporteStone,
  perfilAndroidStone
} from './stone-mobile-receiver.js'

test('mídia de visualização única recebida com chave é reconhecida', () => {
  const event = {
    message: {
      viewOnceMessageV2: {
        message: { imageMessage: {
          mediaKey: Uint8Array.of(1),
          directPath: '/arquivo'
        } }
      }
    }
  }
  assert.deepEqual(inspecionarMidiaStone(event), {
    tipo: 'imageMessage', temChave: true, temCaminho: true, recebida: true
  })
})

test('mensagem sem mídia não inventa chave', () => {
  assert.equal(inspecionarMidiaStone({ message: {} }), null)
})

test('mídia normal não entra no diagnóstico de view-once', () => {
  assert.equal(inspecionarMidiaStone({ message: {
    imageMessage: { mediaKey: Uint8Array.of(1) }
  } }), null)
})

test('mensagem com viewOnce direto também é identificada', () => {
  assert.equal(inspecionarMidiaStone({ message: {
    videoMessage: { viewOnce: true }
  } }).temChave, false)
})

test('sem sessão registrada usa modo vinculado', () => {
  assert.equal(decidirTransporteStone(null).modo, 'vinculado')
})

test('credenciais vinculadas não viram mobile por engano', () => {
  assert.equal(decidirTransporteStone({ meJid: '5511@s.whatsapp.net' }).modo, 'vinculado')
})

test('credenciais mobile reais ativam mobile', () => {
  assert.equal(decidirTransporteStone({
    meJid: '5511@s.whatsapp.net', deviceInfo: { device: 'Pixel' }
  }).modo, 'mobile')
})

test('troca de transporte requer opt-in explícito para sessão vinculada', () => {
  assert.equal(decidirTransporteStone(
    { meJid: '5511@s.whatsapp.net' },
    { tentarAndroidAposVinculo: true }
  ).modo, 'mobile-experimental')
})

test('perfil Business tem identidade separada', () => {
  assert.equal(perfilAndroidStone({ business: true }).business, true)
  assert.equal(perfilAndroidStone({ business: false }).business, false)
})
