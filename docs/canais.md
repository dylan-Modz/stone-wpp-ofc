# Stone WPP — canais

```js
const c = socket.stone.canais
const infos = await c.informacoes('0@newsletter')
const recentes = await c.mensagens('0@newsletter', 10)
await c.reagir('0@newsletter', 'ID_DA_MENSAGEM', '❤️')
```

Operações disponíveis do cliente: `informacoes`, `mensagens`, `seguidores`, `reagir`, `seguir` e `deixar`.

## Dados locais

```js
const encontrados = c.buscarLocal([
    { id: '0@newsletter', name: 'Notícias do dia' }
], 'noticias')
const numeros = c.estatisticasLocais([{ views: 100, reactions: ['❤️'] }])
const emojis = c.resumirReacoes(['❤️', '❤️', '👍'])
const votos = c.resumirEnquete({ name: 'Pergunta', options: [
    { optionName: 'Sim', votes: 2 }, { optionName: 'Não', votes: 1 }
]})
```

**Importante:** `buscarLocal` não consulta a rede. Os cálculos de estatísticas e enquetes usam dados fornecidos pela aplicação; não consultam métricas privadas do servidor nem descobrem votantes automaticamente.
