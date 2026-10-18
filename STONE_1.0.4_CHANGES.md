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

## Recursos ainda não implementados

Permanecem em estudo: listas nativas de conversas, leitura/exclusão avançada de Status, carrinhos/pedidos nativos, notas de clientes, consulta de usuários por @username, consulta histórica de ex-participantes e denúncias. Esses recursos dependem de operações de protocolo que ainda não foram verificadas na Stone. **Não foram adicionados métodos falsos ou substitutos locais com o mesmo nome de APIs nativas.**

## Testes antes da publicação

- Instalar e iniciar uma sessão real com uma conta de testes.
- Verificar a renderização e o envio do Pix em diferentes contas.
- Verificar o recebimento e os efeitos de KeepInChat, permissões em grupos e a operação de desfazer.
- Sincronizar etiquetas em conta comercial, editar/excluir e validar os eventos.
- Validar importação ESM e tipos TypeScript após `npm pack`.
