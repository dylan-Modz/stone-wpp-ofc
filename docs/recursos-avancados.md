# Recursos avançados da Stone WPP — referência verificada

Este guia reúne operações já presentes no código da biblioteca **@stone-wpp/ofc** que podem não estar detalhadas em tutoriais antigos. Cada assinatura abaixo foi conferida na implementação da Stone. Exemplos usam um socket **stone** já conectado; autenticação e QR Code não são repetidos.

> **Regra:** a existência de um método no código não garante permissão para cada operação nem suporte uniforme em todas as versões do WhatsApp. Quando a operação depende de privilégios ou configuração da conta, trate erros e teste com a conta real.

## 1. Fixar e desafixar uma mensagem

O envio de mensagem da Stone aceita um conteúdo com **pin**, **type** e **time**. O tempo é informado em **segundos**:

~~~js
const jid = '120363000000000000@g.us'
const mensagemKey = mensagemRecebida.key

// Fixar durante 24 horas
await stone.sendMessage(jid, {
  pin: mensagemKey,
  type: 1,
  time: 24 * 60 * 60
})

// Desafixar
await stone.sendMessage(jid, {
  pin: mensagemKey,
  type: 2
})
~~~

**pin** é a chave da mensagem a ser fixada, não o texto; **type: 1** indica fixar e **type: 2** indica remover a fixação. Não confunda isso com **star** (favoritos). O WhatsApp pode exigir privilégios administrativos ou aplicar limites próprios.

## 2. Apagar somente para a conta conectada

**deleteMessageForMe(jid, key, timestamp, deleteMedia = false)** modifica a mensagem na conta conectada. Não apaga para todos os integrantes da conversa.

~~~js
const jid = mensagemRecebida.key.remoteJid
const key = mensagemRecebida.key
const timestamp = Number(mensagemRecebida.messageTimestamp)

await stone.deleteMessageForMe(jid, key, timestamp)
~~~

**timestamp** precisa ser o horário original da mensagem (segundos Unix), não a hora atual. Guarde a chave e o timestamp quando receber a mensagem. Se o valor vier como um tipo de número longo, normalize-o antes do uso. Para operações que apagam para todos, consulte os métodos de revogação e suas restrições próprias; não substitua um método pelo outro.

## 3. Favoritar e desfavoritar

**star(jid, messages, star)** adiciona ou remove o marcador de favorito nas mensagens especificadas. **messages** é a lista de chaves/descritores no formato aceito por **chatModify**.

~~~js
// Exemplo conceitual com o descritor da mensagem:
const mensagem = {
  id: mensagemRecebida.key.id,
  fromMe: mensagemRecebida.key.fromMe
}

await stone.star(jid, [mensagem], true)   // Favoritar
await stone.star(jid, [mensagem], false)  // Desfavoritar
~~~

A assinatura é confirmada na implementação de **lib/Socket/chats.js**. Alguns tipos de conversa e versões do WhatsApp podem exigir outros campos do descritor.

## 4. Etiquetas de chats e mensagens

A Stone oferece quatro operações distintas:

| Método | Descrição |
| --- | --- |
| **addChatLabel(jid, labelId)** | Aplica uma etiqueta ao chat |
| **removeChatLabel(jid, labelId)** | Remove uma etiqueta do chat |
| **addMessageLabel(jid, messageId, labelId)** | Etiqueta uma mensagem específica |
| **removeMessageLabel(jid, messageId, labelId)** | Retira a etiqueta de uma mensagem |

~~~js
const contato = '5511999999999@s.whatsapp.net'
const labelId = '1'  // Identificador de etiqueta existente nesta conta

await stone.addChatLabel(contato, labelId)
await stone.removeChatLabel(contato, labelId)

const messageId = mensagemRecebida.key.id
await stone.addMessageLabel(contato, messageId, labelId)
await stone.removeMessageLabel(contato, messageId, labelId)
~~~

**Importante:** o **labelId** deve identificar uma etiqueta que faça sentido para a conta conectada. O exemplo não cria uma etiqueta automaticamente. Algumas funções de etiquetas dependem de compatibilidade com conta Business.

## 5. Solicitações de entrada em grupos

A Stone permite consultar as solicitações pendentes e aceitar ou rejeitar participantes, conforme privilégios do grupo:

~~~js
const grupo = '120363000000000000@g.us'

// Lista de solicitações pendentes
const pedidos = await stone.groupRequestParticipantsList(grupo)
console.log(pedidos)

// Aprovar ou rejeitar JIDs, conforme permissões
await stone.groupRequestParticipantsUpdate(
  grupo,
  ['5511999999999@s.whatsapp.net'],
  'approve'
)

await stone.groupRequestParticipantsUpdate(
  grupo,
  ['5511888888888@s.whatsapp.net'],
  'reject'
)
~~~

**groupRequestParticipantsList(jid)** retorna os dados de pedidos recebidos do WhatsApp. **groupRequestParticipantsUpdate(jid, participants, action)** envia a decisão. Verifique se o bot é administrador e se a aprovação de entrada está configurada no grupo.

## 6. Mensagens temporárias em grupos

~~~js
const grupo = '120363000000000000@g.us'

await stone.groupToggleEphemeral(grupo, 24 * 60 * 60) // 24 horas
await stone.groupToggleEphemeral(grupo, 0) // Desativar
~~~

**groupToggleEphemeral(jid, ephemeralExpiration)** define o prazo das mensagens temporárias. Não altera retroativamente todas as mensagens antigas e depende das permissões do grupo.

## 7. Reações e informações de canais

As operações de newsletter/canal recebem um JID de canal (normalmente terminado em **@newsletter**):

~~~js
const canal = '120363000000000000@newsletter'

// Metadados do canal
const metadata = await stone.newsletterMetadata('jid', canal)
console.log(metadata)

// Consulta de assinantes/seguidores
const inscritos = await stone.newsletterSubscribers(canal)
console.log(inscritos)

// Reagir a uma publicação pelo ID do servidor
const serverMessageId = '123456789'
await stone.newsletterReactMessage(canal, serverMessageId, '❤️')

// Retirar a reação (sem código do emoji)
await stone.newsletterReactMessage(canal, serverMessageId, '')
~~~

**newsletterMetadata(type, key)** aceita um tipo de identificação, como **jid**. **newsletterSubscribers(jid)** retorna a resposta da consulta de assinantes, cuja estrutura pode variar. **newsletterReactMessage(jid, serverId, reaction)** usa o identificador da publicação no servidor, não o identificador comum de uma mensagem de chat.

## 8. Criar link para chamada de voz

O método **createCallLink(type, event?, timeoutMs?)** cria o token de um link de chamada. Para voz:

~~~js
const token = await stone.createCallLink('audio')
if (!token) throw new Error('WhatsApp não retornou um token de chamada')

const link = 'https://call.whatsapp.com/' + token
await stone.sendMessage('5511999999999@s.whatsapp.net', {
  text: 'Entre na chamada de voz: ' + link
})
~~~

**Atenção:** criar um link é diferente de **iniciar uma chamada de voz, atender automaticamente ou transmitir áudio em tempo real**. Não anuncie essas três capacidades como implementadas apenas porque **createCallLink** existe. Não inclui recursos de videochamada neste guia.

## 9. Rótulo de membro em grupo

**updateMemberLabel(jid, memberLabel)** envia a alteração de rótulo do membro pela infraestrutura de mensagens da Stone:

~~~js
const grupo = '120363000000000000@g.us'

await stone.updateMemberLabel(grupo, 'Equipe')

// O rótulo é limitado a 30 caracteres na implementação.
~~~

O método aplica uma alteração associada à conta que executa a operação no grupo; não é uma API para editar arbitrariamente rótulos de qualquer participante. Considere a disponibilidade real dessa funcionalidade no WhatsApp.

## 10. Privacidade e bloqueados

A Stone expõe métodos para configurações de privacidade, incluindo **updateLastSeenPrivacy**, **updateOnlinePrivacy**, **updateProfilePicturePrivacy**, **updateStatusPrivacy**, **updateReadReceiptsPrivacy**, **updateGroupsAddPrivacy** e outros disponíveis em **lib/Socket/chats.js**. Antes de alterar uma preferência, consulte quais valores são aceitos pelo protocolo da versão utilizada.

Para bloqueados, os métodos são concretos:

~~~js
const bloqueados = await stone.fetchBlocklist()
console.log('Contas bloqueadas:', bloqueados)

// Atualizar bloqueio de contato específico:
await stone.updateBlockStatus('5511999999999@s.whatsapp.net', 'block')
await stone.updateBlockStatus('5511999999999@s.whatsapp.net', 'unblock')
~~~

**fetchBlocklist()** retorna uma lista de JIDs bloqueados, e **updateBlockStatus(jid, action)** atualiza o estado. Não use automaticamente o bloqueio sem um pedido explícito do usuário da aplicação.

## 11. Edição de mensagens

A Stone também aceita a propriedade **edit** no conteúdo enviado: deve ser fornecida a chave da mensagem original, com novo conteúdo de texto.

~~~js
const keyOriginal = mensagemEnviadaPeloBot.key

await stone.sendMessage(jid, {
  text: 'Texto corrigido',
  edit: keyOriginal
})
~~~

A edição é feita pelo próprio protocolo, com suas regras e limites de prazo, propriedade e tipo de mensagem. Não confunda editar texto enviado pela conta com editar uma mensagem escrita por outra pessoa.

## 12. Como determinar se um recurso está pronto para documentar?

- **Implementado:** a função realmente existe e é exportada ou exposta no socket, e o exemplo usa sua assinatura exata.
- **Dependente de plataforma:** a função existe, mas sua disponibilidade depende da conta, das permissões ou do aplicativo WhatsApp.
- **Planejado:** ainda não existe uma implementação exposta verificável; não apresente como recurso disponível.

Em particular, **atendimento automático de chamadas e áudio bidirecional em tempo real** não foram validados como recursos implementados da biblioteca, e não aparecem aqui como tutoriais de uso.

**Arquivos de referência conferidos:** **lib/Utils/messages.js**, **lib/Socket/chats.js**, **lib/Socket/newsletter.js**, **lib/Socket/groups.js** e **lib/Socket/messages-send.js**. Esta página descreve a biblioteca Stone WPP; não depende de comandos específicos do Tokito Bot.
