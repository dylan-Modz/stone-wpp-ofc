# groupProtection — proteção de grupos na Stone WPP

A função `sock.groupProtection(jid, options)` ativa detecção opcional de flood,
mensagens de pagamento em rajada, sinais de falha de descriptografia e mensagens
de pagamento citadas. É integrada à Stone e não depende de patches em `node_modules`.

## Ativar, consultar e desativar

```js
// Modo seguro (padrão): apenas emite eventos.
await sock.groupProtection('123456@g.us', { enabled: true })
console.log(await sock.groupProtection('123456@g.us'))
await sock.groupProtection('123456@g.us', { enabled: false })
```

## Modo automático (opcional)

```js
await sock.groupProtection('123456@g.us', {
  enabled: true,
  mode: 'protect',
  paymentBurst: 3,
  messageBurst: 14,
  windowMs: 8000,
  lockMs: 12000,
  editNotice: true // Edita aviso do próprio bot após a moderação
})

sock.ev.on('group-protection.alert', (alert) => {
  console.log('Stone Protection:', alert.reason, alert.severity, alert.jid)
})

sock.ev.on('group-protection.action', (result) => {
  console.log('Ação executada:', result)
})
```

Modos:
- `alert` (padrão): apenas alerta, sem excluir mensagens ou participantes.
- `delete`: tenta apagar a mensagem de uma rajada comprovada.
- `remove`: tenta apagar a mensagem e remover o participante identificado.
- `protect`: também fecha temporariamente o grupo e reabre após `lockMs`.

A Stone verifica se o bot é administrador e **não tenta remover administradores
ou pessoas cujo JID não pôde ser confirmado no grupo**. Erros de descriptografia
e conteúdo citado são indícios, não provas: **não causam expulsão automática**.

## Monitoramento auxiliar

```js
// monitor1, monitor2 e monitor3 são sockets Stone conectados separadamente.
// Devem participar do grupo e cada um exige autenticação própria.
await sock.groupProtection('123456@g.us', {
  enabled: true,
  mode: 'alert',
  monitors: [monitor1, monitor2, monitor3]
})
```

É possível usar até **três monitores adicionais**. Eventos duplicados da mesma
mensagem são consolidados. Nenhum número é conectado ou pareado automaticamente.
Se o WhatsApp não entregar uma mensagem a nenhuma sessão, ela não pode ser
recuperada por esta API. O mecanismo de retry/PDO nativo da Stone não é alterado.

## Limites e observações

- Exige Node.js 20+ e a Stone WPP com esta implementação.
- O aviso editável é enviado pelo bot. Mensagens de outras pessoas não podem ser reescritas como se fossem delas; a técnica do ZIP não é uma API de edição confiável.
- O modo ativo vale só para a sessão do socket. Configure novamente após reiniciar o bot.
- O comportamento depende das permissões do bot e do protocolo do WhatsApp.
- Uma mensagem de pagamento isolada é registrada como alerta leve; a ação automática
  só é considerada após rajada verificada dentro da janela configurada.
- O sistema não reescreve mensagens em nome de terceiros, não simula provas e
  não promete bloquear todos os métodos de bypass.
- Faça testes em grupos próprios antes de usar ações automáticas em produção.
