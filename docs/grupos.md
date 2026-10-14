# Stone WPP — grupos

```js
const permissoes = socket.stone.grupos.permissoes
await permissoes.somenteAdminsEnviam('123@g.us', true)
await permissoes.aprovarEntrada('123@g.us', true)
const pedidos = await permissoes.solicitacoes('123@g.us')
```

Há também `somenteAdminsEditam`, `permitirAdicaoPorMembros` e `decidirSolicitacoes`.

## Histórico local opcional

```js
await socket.stone.grupos.historico.salvar('123@g.us', { texto: 'Olá' })
console.log(await socket.stone.grupos.historico.listar('123@g.us'))
```

Esse histórico é armazenado **somente quando a aplicação chama `salvar`**. Ele não compartilha histórico antigo com membros novos nem recupera automaticamente mensagens do servidor. Por padrão fica em memória; use [Stone Store](./dados.md) para uma persistência que você controle.
