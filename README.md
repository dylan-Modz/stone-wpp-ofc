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

- **Motor opcional de chamadas:** `stone.calls` permite iniciar chamadas individuais e em grupo, atender, entrar em chamadas conhecidas, sair e encerrar.
- **Áudio em ligações:** `stone.calls.playAudio(callId, caminho)` reproduz MP3/arquivos locais usando FFmpeg, e `feedLiveAudio` transmite PCM mono 16 kHz.
- **Eventos de chamadas:** QR da sessão de chamadas, chamada recebida, estado, participantes, fim e erros.

- **Convites para chamadas em grupo:** o novo método `sendGroupCallInvite(groupJid, options)` gera um link de chamada de voz ou vídeo no WhatsApp e envia o convite diretamente ao grupo.
- **Diagnóstico de identidades:** `resolveJidMapping(jid)` consulta o vínculo conhecido entre número (PN) e LID.
- **Diagnóstico de sessões:** `inspectSignalSession(jid)` verifica se há uma sessão Signal registrada, sem modificar chaves.

### Correções e melhorias

- **Isolamento:** motor de ligações usa sessão vinculada separada da conexão principal do bot, preservando suas chaves e comandos.

- **Recuperação de mídia:** tenta a URL original quando o caminho direto retorna HTTP 403, 404 ou 410.
- **Reenvio de mídia:** valida chaves antes da solicitação e limita a espera por resposta.
- **Identificação LID/PN:** trata respostas do USync com identificação por dispositivo sem falhar durante a conversão.
- **Compatibilidade:** preserva as assinaturas dos métodos e os comandos existentes.

### Novo recurso: convite de chamada em grupo

```js
// Convite para chamada de voz.
await stone.sendGroupCallInvite('120363000000000000@g.us', {
  type: 'audio'
})

// Convite para chamada de vídeo, com mensagem personalizada.
await stone.sendGroupCallInvite('120363000000000000@g.us', {
  type: 'video',
  text: 'Entrem na chamada do grupo!'
})
```

**Importante:** o recurso envia um convite com link, mas **não inicia uma chamada tocando para todos**, nem transmite áudio ou vídeo pelo bot. Depende de o WhatsApp gerar o link e de os participantes entrarem na chamada.


### Exemplo: chamada de voz com música

```js
// A sessão de chamadas é um dispositivo vinculado independente.
stone.calls.on('qr', ({ qr }) => console.log('QR da sessão de chamadas:', qr))
await stone.calls.connect({ authPath: './auth/stone-calls.sqlite' })

// Convide participantes explícitos para tocar seus celulares.
const callId = await stone.calls.startGroupCall('120363000000000000@g.us', [
  '5511999999999@s.whatsapp.net'
])

// Começa quando houver participante e a chamada estiver ativa.
await stone.calls.playAudio(callId, './musica.mp3')
```

**Limites:** a sessão de chamadas deve ser pareada à parte e precisa de dependências VoIP opcionais, transportes nativos compatíveis e FFmpeg para arquivos de áudio. `joinCall` só entra em chamadas conhecidas pela sessão. A transmissão de vídeo não está implementada no módulo. Valide numa conta de testes; testes automatizados não garantem conectividade real.

**Status da publicação:** as mudanças estão no código-fonte do GitHub. A disponibilidade da versão 1.0.7 no npm precisa ser confirmada separadamente.

[Documentação oficial](https://stone-wpp.squareweb.app/) · [Código-fonte](https://github.com/dylan-Modz/stone-wpp-ofc)

<sub>Stone WPP · Dylan Modz</sub>
