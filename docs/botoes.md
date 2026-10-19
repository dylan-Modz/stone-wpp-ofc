# Botões e mensagens interativas na Stone WPP

Este guia explica os formatos implementados em **@stone-wpp/ofc**, como enviar, como tratar as respostas e quando escolher cada visual. Os exemplos partem de um cliente Stone **já conectado**, chamado **stone**. Não é necessário repetir o processo de autenticação em cada comando.

> Os botões são recursos do protocolo do WhatsApp Web. Aparência, disponibilidade e possibilidade de clicar variam entre plataformas e versões do aplicativo. A biblioteca não concede selo de verificação da Meta.

## 1. Qual formato escolher?

| Formato | Recurso da Stone | Características | Melhor uso |
| --- | --- | --- | --- |
| Botões tradicionais | **buttonsMessage** | Botões com texto e identificador próprio | Ações rápidas e escolhas simples |
| Tradicionais com capa de localização | **buttonsMessage** + **locationMessage** | Miniatura JPEG no cabeçalho de localização (**headerType: 6**) | Layout especial parecido com o Play2 |
| Botões nativos | **interactive** + **buttons** | Permite tipos como **quick_reply**, **cta_url**, **cta_copy**, **cta_call** e **single_select** | Painéis interativos e menus |
| Nativos com imagem | **interactive.image** | Cabeçalho com mídia real, sem fingir uma localização | Quando a capa ou foto deve aparecer como imagem |

### Importações utilizadas

~~~js
import { sendInteractiveMessage } from '@stone-wpp/ofc'

const jid = '5511999999999@s.whatsapp.net'
// stone é o socket já conectado.
// Dentro do manipulador de uma mensagem, use o remoteJid daquela conversa.
~~~

## 2. Botões tradicionais de resposta

**buttonsMessage** usa **contentText** (texto principal), **footerText** e uma lista de botões com **buttonId** (valor enviado de volta), **buttonText.displayText** (rótulo visível) e **type: 1**. A Stone também aceita os atalhos **{ id, text }** e normaliza esses campos.

~~~js
await sendInteractiveMessage(stone, jid, {
  buttonsMessage: {
    contentText: 'Escolha o formato da música:',
    footerText: 'Stone WPP',
    buttons: [
      { buttonId: 'musica_audio', buttonText: { displayText: '🎧 Áudio' }, type: 1 },
      { buttonId: 'musica_video', buttonText: { displayText: '🎬 Vídeo' }, type: 1 },
      { buttonId: 'musica_doc', buttonText: { displayText: '📄 Documento' }, type: 1 }
    ]
  }
})
~~~

O rótulo pode mudar sem alterar a ação, pois a identificação é feita pelo **buttonId**. Use IDs estáveis e trate-os no evento de mensagens recebidas.

## 3. Botões com miniatura de localização (visual Play2)

A Stone suporta o cabeçalho **LOCATION** e aceita a miniatura como um **Buffer** JPEG em **locationMessage.jpegThumbnail**. A miniatura deve ser a capa da música, a foto do produto ou outra imagem escolhida pelo desenvolvedor, e não um mapa gerado automaticamente.

Antes do exemplo, salve uma imagem como **capa.jpg**. Se a imagem estiver em outro formato, converta para JPEG. Você pode preparar a capa com **sharp**, instalado separadamente:

~~~bash
npm install sharp
~~~

~~~js
import { readFile } from 'node:fs/promises'
import sharp from 'sharp'
import { sendInteractiveMessage } from '@stone-wpp/ofc'

const original = await readFile('./capa.jpg')
const jpegThumbnail = await sharp(original)
  .resize(300, 300, { fit: 'cover', position: 'centre' })
  .jpeg({ quality: 60 })
  .toBuffer()

await sendInteractiveMessage(stone, jid, {
  buttonsMessage: {
    contentText: '🎶 Música encontrada\n\nEscolha como baixar:',
    footerText: '',
    headerType: 6,
    locationMessage: {
      degreesLatitude: 0,
      degreesLongitude: 0,
      name: 'Capa da música',
      address: 'Artista / álbum',
      jpegThumbnail
    },
    buttons: [
      { id: 'download_audio', text: '🎧 Áudio' },
      { id: 'download_video', text: '🎬 Vídeo' },
      { id: 'download_documento', text: '📄 Documento' }
    ]
  }
})
~~~

**Entenda os campos:**

- **headerType: 6**: declara o cabeçalho do tipo localização, que a Stone também define automaticamente quando existe **locationMessage**.
- **jpegThumbnail**: bytes da capa em JPEG; é diferente de uma URL e de um arquivo PNG/WebP bruto.
- **degreesLatitude / degreesLongitude**: valores da estrutura de localização. No exemplo são **0** apenas para demonstrar um cabeçalho visual. Não anuncie essa estrutura como uma localização física real.
- **name / address**: textos do cabeçalho; não determinam se o usuário receberá um selo de verificação.
- **buttons**: IDs independentes para áudio, vídeo e documento.

**Importante:** por ser uma mensagem de localização, alguns clientes podem priorizar o mapa ou outro elemento de localização mesmo com **jpegThumbnail**. Se você precisa garantir que a mídia apareça como uma **imagem real**, prefira a seção seguinte. O WhatsApp também pode ocultar botões de formatos legados.

## 4. Botões com imagem real: alternativa recomendada para capas

Para mostrar a capa como uma mídia de verdade, use o formato nativo com **interactive.image**. Ele evita depender do visual de localização:

~~~js
await sendInteractiveMessage(stone, jid, {
  interactive: {
    text: '🎶 Música encontrada\n\nEscolha o download:',
    footer: 'Stone WPP',
    image: { url: 'https://exemplo.com/capa.jpg' },
    buttons: [
      { type: 'quick_reply', id: 'audio', text: '🎧 Áudio' },
      { type: 'quick_reply', id: 'video', text: '🎬 Vídeo' },
      { type: 'quick_reply', id: 'documento', text: '📄 Documento' }
    ]
  }
})
~~~

A Stone prepara o **imageMessage** e o cabeçalho interativo. Use uma URL de imagem acessível ou uma mídia compatível com o formato de upload. Isso também depende do suporte do cliente WhatsApp.

## 5. Botões nativos: resposta rápida, URL, copiar, ligar e lista

A Stone transforma os tipos abaixo em botões do **nativeFlowMessage**:

| Tipo / apelido de entrada | Enviado no protocolo | Campo principal |
| --- | --- | --- |
| **quick_reply** | quick_reply | **id** |
| **url**, **link**, **cta_url** | cta_url | **url** |
| **copy**, **copiar**, **cta_copy** | cta_copy | **copy_code** |
| **call**, **ligar**, **cta_call** | cta_call | **phone_number** |
| **list**, **lista**, **single_select** | single_select | **sections** |

Exemplos de ação rápida, link e copiar:

~~~js
await sendInteractiveMessage(stone, jid, {
  interactive: {
    title: 'Central de recursos',
    text: 'Escolha uma ação abaixo.',
    footer: 'Stone WPP',
    buttons: [
      { type: 'quick_reply', id: 'ajuda', text: '❔ Ajuda' },
      { type: 'cta_url', text: '🌐 Abrir site', url: 'https://stone-wpp.vercel.app/' },
      { type: 'cta_copy', text: '📋 Copiar código', copy_code: 'STONE-123' },
      { type: 'cta_call', text: '📞 Ligar', phone_number: '+5511999999999' }
    ]
  }
})
~~~

Para uma lista com seções:

~~~js
await sendInteractiveMessage(stone, jid, {
  interactive: {
    text: 'Selecione a categoria:',
    buttons: [
      {
        type: 'single_select',
        title: 'Abrir categorias',
        sections: [
          {
            title: 'Downloads',
            rows: [
              { title: 'Músicas', id: 'categoria_musica' },
              { title: 'Vídeos', id: 'categoria_video' }
            ]
          }
        ]
      }
    ]
  }
})
~~~

Os itens de uma lista, links e botões de chamada podem ter comportamentos diferentes conforme o WhatsApp e o tipo de conta. Enviar a mensagem sem erro não garante que cada cliente mostre todos os controles.

## 6. Recebendo o clique e identificando o botão

Use **messages.upsert** para observar respostas. O formato de resposta depende do modelo do botão enviado:

~~~js
stone.ev.on('messages.upsert', ({ messages }) => {
  for (const item of messages || []) {
    const message = item.message || {}

    // Botões tradicionais:
    let id = message.buttonsResponseMessage?.selectedButtonId

    // Botões de templates:
    id ||= message.templateButtonReplyMessage?.selectedId

    // Botões nativos: paramsJson pode conter o id:
    const paramsJson = message.interactiveResponseMessage
      ?.nativeFlowResponseMessage?.paramsJson

    if (!id && paramsJson) {
      try {
        id = JSON.parse(paramsJson)?.id
      } catch {
        // Resposta incompleta ou de outro tipo.
      }
    }

    if (id === 'audio' || id === 'download_audio' || id === 'musica_audio') {
      console.log('Usuário escolheu áudio')
    } else if (id === 'video' || id === 'download_video' || id === 'musica_video') {
      console.log('Usuário escolheu vídeo')
    }
  }
})
~~~

**Atenção:** o clique não baixa um arquivo por si só. O seu aplicativo deve mapear o ID recebido para a operação real, validar o remetente e conferir permissões antes de executar ações.

## 7. Citação (quote), fallback e cuidados

Para responder citando uma mensagem existente:

~~~js
await sendInteractiveMessage(
  stone,
  jid,
  { buttonsMessage: {
    contentText: 'Escolha uma opção:',
    buttons: [{ id: 'continuar', text: 'Continuar' }]
  }},
  { quoted: mensagemRecebida }
)
~~~

A opção **quote** também é aceita como apelido de **quoted**. Isso é uma **mensagem citada**: não é o selo Meta Verified. Nenhum botão da Stone cria um selo de conta verificada.

Ao usar botões no seu produto, implemente um plano B em texto, especialmente para versões do WhatsApp que não renderizam o tipo interativo escolhido:

~~~js
try {
  await sendInteractiveMessage(stone, jid, {
    interactive: {
      text: 'Escolha uma ação',
      buttons: [{ type: 'quick_reply', id: 'continuar', text: 'Continuar' }]
    }
  })
} catch (error) {
  console.error('Falha no interativo:', error.message)
  await stone.sendMessage(jid, { text: 'Responda CONTINUAR para prosseguir.' })
}
~~~

O fallback acima trata falhas de envio. Se o WhatsApp aceitar o envio mas o aplicativo de destino esconder os botões, não haverá um erro automático; seu fluxo precisa oferecer também uma alternativa acessível em texto.

---

**Fonte de referência:** implementações exportadas de **lib/Utils/messages.js**, **lib/Utils/index.js** e **lib/index.js** na biblioteca Stone WPP.
