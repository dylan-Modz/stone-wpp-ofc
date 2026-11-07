<div align="center">

<a href="https://stone-wpp.squareweb.app/">
  <img src="https://readme-typing-svg.herokuapp.com?font=Fira+Code&weight=700&size=31&pause=1000&color=00BFFF&center=true&vCenter=true&width=760&lines=STONE+WPP;ATUALIZA%C3%87%C3%95ES+OFICIAIS;DYLAN+MODZ" alt="Stone WPP — atualizações oficiais">
</a>

<img src="https://raw.githubusercontent.com/Yoshirukkj/Download-/main/1b2li6.jpg" alt="Stone WPP" width="800">

**Novidades e correções da biblioteca Stone WPP.**

<img src="https://img.shields.io/badge/VERS%C3%83O-1.0.7-00BFFF?style=for-the-badge&labelColor=111820" alt="Versão 1.0.7">
<img src="https://img.shields.io/badge/Node.js-20%2B-111820?style=for-the-badge&logo=node.js&logoColor=00BFFF" alt="Node.js 20+">

</div>

---

## Stone WPP 1.0.7

### Novidades

- **Chamadas na conexão principal:** `stone.calls.on('incoming', handler)`, `on('state', handler)` e `on('ended', handler)` acompanham eventos recebidos pelo socket da Stone, sem outra sessão.
- **Controle de chamadas:** `stone.calls.getCall(id)` e `getCalls()` consultam chamadas observadas. `stone.calls.rejectCall(id)` recusa ofertas recebidas.
- **Links de chamada:** `stone.calls.createCallLink(type)` cria um token de participação; `stone.calls.sendGroupCallInvite(grupo, options)` envia o link ao grupo.
- **Capacidades verificáveis:** `stone.calls.getCapabilities()` informa quais operações realmente estão disponíveis.
- **Diagnósticos:** `resolveJidMapping(jid)` e `inspectSignalSession(jid)` consultam identidades e sessões conhecidas.

### Correções

- **Mídia:** nova tentativa pela URL original em falhas HTTP 403, 404 ou 410; validação de chaves e limite de espera no reenvio.
- **Identificação:** tratamento de JIDs por dispositivo nas respostas de mapeamento PN/LID.
- **Independência:** removida a integração opcional com outra conexão de chamadas e respectivas dependências.
- **Compatibilidade:** APIs de mensagens, grupos e os convites de chamadas existentes permanecem disponíveis.

### Teste de chamadas recebidas

```js
stone.calls.on('incoming', async call => {
  console.log('Chamada recebida:', call.callId, call.from)
  // Para recusar, quando desejado:
  // await stone.calls.rejectCall(call.callId)
})

stone.calls.on('state', call => {
  console.log(call.callId, call.status)
})

console.log(stone.calls.getCapabilities())
```

**Limitação atual:** iniciar/atender/entrar em ligações e transmitir áudio ou vídeo **ainda não estão implementados nativamente**. Os métodos correspondentes recusam a operação com `STONE_CALL_MEDIA_NOT_IMPLEMENTED`; não simulam funcionamento real. Não há motor RTP/SRTP, codec e negociação de chamadas pronto. A versão do código no GitHub é 1.0.7; a publicação no npm é independente.

[Documentação oficial](https://stone-wpp.squareweb.app/#/features/chamadas) · [Código-fonte](https://github.com/dylan-Modz/stone-wpp-ofc)

<sub>Stone WPP · Dylan Modz</sub>
