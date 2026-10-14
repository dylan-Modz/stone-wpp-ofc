# Stone WPP — mensagens

A interface atual de envio continua disponível:

```js
await socket.sendMessage('5511999999999@s.whatsapp.net', { text: 'Olá!' })
```

Os módulos complementares usam essa interface, sem substituir o envio existente.

## Bots

```js
const remover = socket.stone.bots.escutar(jid, mensagem => {
    console.log('Mensagem recebida:', mensagem)
})
await socket.stone.bots.enviar(jid, 'Olá')
remover()
```

Essa escuta observa eventos locais do cliente. Respostas em fluxo de bots não são implementadas.

## Listas com consentimento

```js
socket.stone.listas.criar('comunicados', [
    { jid: '5511999999999@s.whatsapp.net', consentimento: true }
])
const resultados = await socket.stone.listas.enviar('comunicados', 'Aviso autorizado')
console.log(resultados)
```

As listas são mantidas em memória e enviam mensagens diretas, uma por destinatário. Não são listas de transmissão nativas. Envie apenas a contatos que consentiram e respeite os limites do serviço.
