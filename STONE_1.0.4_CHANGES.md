# Stone WPP — recursos novos (1.0.4, código-fonte)

> **Atenção:** versão preparada no GitHub; publicar no npm é uma operação separada. O uso efetivo dos novos formatos precisa ser validado com uma conta WhatsApp compatível.

## Métodos adicionados

### Pix: `socket.sendPixKeyMessage(jid, dados, options?)`
Envia um Native Flow `payment_info` com a chave Pix. **Não recebe pagamentos e não confirma transferências**.

```js
await socket.sendPixKeyMessage('5511999999999@s.whatsapp.net', {
  keyType: 'PHONE', key: '5511888888888', name: 'Minha Loja',
  instructions: 'Confira os dados antes de transferir'
})
```

### Mensagens temporárias: `socket.keepMessage(jid, key, manter?)`
Envia uma mensagem de protocolo KeepInChat com `true` (manter) ou `false` (desfazer).
**Experimental:** o WhatsApp pode exigir permissões, a mensagem ainda não pode ter expirado e um ID de envio não comprova aceitação da operação. Testar antes de anunciar como estável.

```js
await socket.keepMessage(msg.key.remoteJid, msg.key, true)
```

### Etiquetas comerciais: `editLabel` e `deleteLabel`
Aproveitam a operação `addLabel` já existente, com sincronização de app-state.

```js
await socket.editLabel('3', { name: 'Clientes VIP', color: 2 })
await socket.deleteLabel('3')
```

`getLabels()` e `getLabelById(id)` observam os eventos `labels.edit` da conexão atual, **não consultam todas as etiquetas no servidor**. Se a sincronização inicial não emitir as etiquetas, a lista poderá estar incompleta.

## Consulta de username — queryUsernameExists(username, pin?)
Consulta o @username por meio do **USyncContactProtocol** da própria Stone, que já oferece parâmetros de username e PIN. Retorna o JID/LID encontrado ou `null`. Não converte o resultado em telefone, e a resposta `null` não distingue username inexistente de restrições/recusa da conta.

```js
const user = await socket.queryUsernameExists('@usuario', '1234') // PIN opcional
console.log(user?.jid)
```

## Notas comerciais — setCustomerNote, getCustomerNote, deleteCustomerNote
Esses métodos usam a ação `noteEditAction` do **app-state regular_low**, e não um arquivo JSON local. As notas são visíveis somente se a conta permitir o recurso nativo. O `getCustomerNote` lê as notas sincronizadas em `notes.edit` e as criadas nesta conexão; pode retornar `null` quando a sincronização ainda não carregou os dados. É possível fornecer `noteId` em edições para não duplicar uma nota cujo id ainda não foi sincronizado.

```js
const novaNota = await socket.setCustomerNote(jid, 'Cliente interessou-se pelo plano')
console.log(socket.getCustomerNote(jid))
await socket.deleteCustomerNote(jid, novaNota.id)
```

## Recursos ainda não implementados

Permanecem em estudo: listas nativas de conversas, leitura/exclusão avançada de Status, carrinhos/pedidos nativos, consulta histórica de ex-participantes e denúncias. Esses recursos dependem de operações de protocolo que ainda não foram verificadas na Stone. **Não foram adicionados métodos falsos ou substitutos locais com o mesmo nome de APIs nativas.**

## Testes antes da publicação

- Instalar e iniciar uma sessão real com uma conta de testes.
- Verificar a renderização e o envio do Pix em diferentes contas.
- Verificar o recebimento e os efeitos de KeepInChat, permissões em grupos e a operação de desfazer.
- Sincronizar etiquetas em conta comercial, editar/excluir e validar os eventos.
- Validar importação ESM e tipos TypeScript após `npm pack`.
