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

### Funções adicionadas

- **`stone.calls.startCall(options)`** — inicia uma chamada de voz ou vídeo para um contato ou inicia uma chamada em grupo com os participantes informados. Retorna o identificador da chamada.
- **`stone.calls.acceptCall(callId)`** — aceita uma chamada recebida.
- **`stone.calls.rejectCall(callId)`** — recusa uma chamada recebida.
- **`stone.calls.joinCall(callId)`** — entra novamente em uma chamada de grupo conhecida pela sessão, quando ela permite a entrada.
- **`stone.calls.leaveCall(callId)`** — sai de uma chamada em grupo sem encerrar a participação das outras pessoas.
- **`stone.calls.endCall(callId)`** — encerra a participação da conta na chamada.
- **`stone.calls.loadAudio(callId, path)`** — carrega um arquivo de áudio para transmissão durante a chamada.
- **`stone.calls.setExternalAudioMode(callId, enabled)`** — controla o uso de áudio fornecido externamente.
- **`stone.calls.feedLiveAudio(callId, pcm)`** — alimenta a chamada com amostras de áudio PCM mono de 16 kHz.
- **`stone.calls.getCall(callId)` / `getCalls()`** — consulta as chamadas acompanhadas pela sessão.
- **`stone.calls.setMute(callId, muted)`** — silencia ou reativa o envio de áudio.
- **`stone.sendGroupCallInvite(groupJid, options)`** — cria um link de participação e o envia a um grupo.
- **`stone.resolveJidMapping(jid)`** — consulta o vínculo conhecido entre identificadores PN e LID.
- **`stone.inspectSignalSession(jid)`** — consulta a existência de sessão criptográfica sem alterar as chaves.

### Correções e melhorias

- Recuperação de mídia por URL alternativa em respostas HTTP 403, 404 e 410, quando disponível.
- Validação das chaves antes de solicitar reenvio de mídia e limitação do tempo de espera.
- Tratamento de identificadores de dispositivos nas respostas de mapeamento PN/LID.
- `startCall()` também aceita um objeto de opções; `loadAudio()` utiliza o nome correspondente à operação. O atalho `playAudio()` continua disponível por compatibilidade.

**Disponibilidade:** o módulo de chamadas é opcional, usa sessão de autenticação separada e depende de componentes de transporte e codificação de áudio. Chamadas reais ainda exigem validação em aparelhos. A publicação no npm é independente do GitHub.

[Documentação das funções](https://stone-wpp.squareweb.app/#/features/chamadas) · [Código-fonte](https://github.com/dylan-Modz/stone-wpp-ofc)

<sub>Stone WPP · Dylan Modz</sub>
