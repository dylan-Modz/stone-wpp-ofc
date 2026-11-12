<div align="center">

<a href="https://stone-wpp.squareweb.app/">
  <img src="https://readme-typing-svg.herokuapp.com?font=Fira+Code&weight=700&size=31&pause=1000&color=00BFFF&center=true&vCenter=true&width=760&lines=STONE+WPP;DOCUMENTA%C3%87%C3%83O+OFICIAL;CRIADO+POR+DYLAN+MODZ" alt="STONE WPP — Documentação Oficial" />
</a>

<br>

<a href="https://stone-wpp.squareweb.app/">
  <img src="https://raw.githubusercontent.com/Yoshirukkj/Download-/main/1b2li6.jpg" alt="Banner oficial Stone WPP — clique para acessar a documentação" width="800" />
</a>

<br><br>

**STONE WPP — Biblioteca modular para WhatsApp em Node.js**

*Conexão • Autenticação • Mensagens • Botões • Grupos • Canais • Extensions*

<br>

<a href="https://github.com/dylan-Modz/stone-wpp-ofc"><img src="https://img.shields.io/badge/VERS%C3%83O-1.0.8-00BFFF?style=for-the-badge&logo=github&logoColor=white&labelColor=111820" alt="Versão 1.0.8 do código no GitHub"></a>
<img src="https://img.shields.io/badge/NODE.JS-20%2B-111820?style=for-the-badge&logo=node.js&logoColor=00BFFF" alt="Node.js 20 ou superior">
<img src="https://img.shields.io/badge/LICENSE-MIT-00BFFF?style=for-the-badge&labelColor=111820" alt="Licença MIT">

<br><br>

<a href="https://stone-wpp.squareweb.app/">
  <img src="https://img.shields.io/badge/ACESSAR-DOCUMENTA%C3%87%C3%83O%20OFICIAL-00BFFF?style=for-the-badge&labelColor=111820&logo=readthedocs&logoColor=white" alt="ACESSAR DOCUMENTAÇÃO OFICIAL STONE WPP">
</a>

<br>

**[📖 Clique aqui para abrir o site completo da documentação](https://stone-wpp.squareweb.app/)**

<sub>Guias, referências, comandos, explicações e exemplos de uso organizados no site.</sub>

</div>

---

## 📚 DOCUMENTAÇÃO COMPLETA

A documentação principal da **Stone WPP** está disponível no nosso site oficial, com navegação por categorias, pesquisa e exemplos. Em vez de repetir todos os tutoriais aqui no npm, centralizamos as explicações no site para você encontrar cada recurso no lugar certo.

<div align="center">

### **[🌐 ABRIR DOCUMENTAÇÃO — STONE WPP](https://stone-wpp.squareweb.app/)**

**https://stone-wpp.squareweb.app/**

</div>

| O que você encontra | Conteúdo |
| :--- | :--- |
| 🚀 **Primeiros passos** | Instalação, configuração e uso inicial. |
| 🔐 **Autenticação** | Sessão, conexão e reconexão. |
| 💬 **Mensagens** | Envio, recebimento e eventos. |
| 🧩 **Botões** | Exemplos e referências das mensagens interativas. |
| 👥 **Grupos e comunidades** | Operações e gerenciamento. |
| 📢 **Canais** | Métodos e recursos disponíveis. |
| ⚙️ **Outros módulos** | API, DataLayer (armazenamento), Extensions (extensões) e funcionalidades relacionadas. |

> **Importante:** a Stone WPP está em desenvolvimento. Consulte a documentação para conhecer os recursos disponíveis e suas limitações. Nem todas as funções planejadas estão implementadas.

---

## 🧪 VoIP experimental — chamadas e áudio

A partir do código **1.0.8**, os componentes de sinalização e o codec MLow fazem parte das **dependências normais da Stone WPP**. O gerenciador de pacotes instala esses módulos junto com a biblioteca, sem exigir comandos separados. O transporte WebRTC e o conversor FFmpeg são opcionais por conterem componentes binários que podem não funcionar em todos os sistemas.

A chamada utiliza **a mesma conexão WhatsApp autenticada** da Stone: não cria outro cliente e não exige outro QR Code.

### Ativação depois da conexão

```js
// Depois de connection: 'open':
await stone.calls.enableVoip({ maxConcurrentCalls: 1 })

console.log(stone.calls.getVoipStatus())
console.log(stone.calls.getCapabilities())
```

Para habilitar automaticamente após a conexão, configure `STONE_VOIP_ENABLED=1` no ambiente do processo.

**Transporte:** quando o WebRTC está disponível, ele é usado. Caso não carregue, o motor tenta **UDP direto experimental** e informa `transport: 'raw-udp'` e `transportFallback: true`. Para proibir esse fallback, use `enableVoip({ rawUdpFallback: false })`; para forçar UDP use `enableVoip({ useRawUdpTransport: true })`. O suporte final depende do servidor e da plataforma.

### Exemplo de ligação e áudio

```js
stone.calls.on('state', async call => {
  console.log('Chamada:', call.callId, call.stateData.state)
  if (call.stateData.state === 'active') {
    // Faça o envio apenas se este for o ID esperado e houver arquivo local.
    // await stone.calls.loadAudio(call.callId, './musica.mp3')
  }
})

// Depois de enableVoip() ter funcionado:
const callId = await stone.calls.startCall({
  peerJid: '5511999999999@s.whatsapp.net'
})
console.log('ID da chamada iniciada:', callId)
```

`startCall()` retorna o identificador após enviar a oferta; **não comprova conexão ou áudio entregue**. `loadAudio()` precisa de FFmpeg disponível e uma chamada com mídia ativa. `setExternalAudioMode()` e `feedLiveAudio()` aceitam PCM mono Float32 de 16 kHz para áudio ao vivo. Todas essas operações dependem de `enableVoip()` e da disponibilidade do host.

**Estado de validação:** a integração não foi homologada em uma ligação real ponta-a-ponta. Antes de usar em produção, teste com pessoas que consentiram, verifique os eventos `active`, `ended` e `stone.voip.error`, e confirme a mídia nos dois sentidos. `getVoipStatus().error` traz diagnósticos de carregamento. As licenças e os avisos dos componentes instalados devem ser preservados.

---

## 🆕 Stone WPP 1.0.8 — novas funções e correções

### 📞 Chamadas: recursos disponíveis

- **`stone.calls.on('incoming', handler)`** — recebe informações de ofertas de ligação.
- **`stone.calls.on('state', handler)`** — acompanha mudanças de estado de chamadas.
- **`stone.calls.on('ended', handler)`** — observa encerramentos, recusas e expirações.
- **`stone.calls.getCall(callId)`** — consulta uma chamada observada.
- **`stone.calls.getCalls()`** — lista chamadas conhecidas da sessão.
- **`stone.calls.rejectCall(callId)`** — encaminha a recusa de uma oferta válida.
- **`stone.calls.createCallLink(type)`** — solicita link de voz ou vídeo.
- **`stone.calls.sendGroupCallInvite(groupJid, options)`** — envia convite com link ao grupo.
- **`stone.calls.getCapabilities()`** — informa o suporte real das operações de chamadas.

```js
stone.calls.on('incoming', call => {
  console.log('Ligação recebida:', call.callId, call.from)
})

stone.calls.on('state', call => {
  console.log('Estado da ligação:', call.status)
})

console.log(stone.calls.getCapabilities())
```

**Limitação atual:** iniciar, atender ou entrar em chamadas e transmitir áudio agora são encaminhados ao motor VoIP **somente depois de `enableVoip()`**. Antes disso, as operações de mídia continuam retornando `STONE_CALL_MEDIA_NOT_IMPLEMENTED`. A integração segue experimental e não equivale a uma ligação testada ponta-a-ponta. Um convite por link não significa que o bot esteja numa ligação.

### 🔍 Novos diagnósticos

- `resolveJidMapping(jid)` — consulta o vínculo conhecido entre identificadores PN e LID.
- `inspectSignalSession(jid)` — consulta a existência de uma sessão criptográfica sem modificar chaves.

```js
const mapping = await stone.resolveJidMapping('5511999999999@s.whatsapp.net')
const session = await stone.inspectSignalSession('5511999999999@s.whatsapp.net')
console.log({ mapping, session })
```

### 🛠️ Correções e melhorias

- **Mídias:** tenta a URL original quando o caminho direto falha com HTTP 403, 404 ou 410.
- **Segurança da mídia:** sinaliza ausência de chave e limita a espera por reenvios.
- **Mapeamento PN/LID:** melhora o tratamento de JIDs com dispositivos nas respostas USync.
- **Conexão única:** eventos e recusas de chamadas usam o socket principal da Stone.
- **Chamadas em grupo:** recusa enviada ao endereço da própria chamada, com identificador de sinalização válido.
- **Sinalização:** metadados de ofertas preservam criador, grupo e possibilidade de ingresso, sem expor chaves ou tokens de mídia.
- **Compatibilidade:** preserva os recursos existentes de mensagens, grupos e canais.

> **Distribuição:** a versão 1.0.8 descrita está no GitHub. O registro npm pode estar em outra versão até uma publicação separada. A documentação detalhada fica no **[site oficial](https://stone-wpp.squareweb.app/#/features/chamadas)**.

---

## 📦 INSTALAÇÃO

```bash
npm install @stone-wpp/ofc
```

**Requisitos:** Node.js **20+**. Biblioteca em JavaScript com suporte a ES Modules.

Para testar especificamente o código **1.0.8 do GitHub**:

```bash
npm install github:dylan-Modz/stone-wpp-ofc#main
```

O comando npm oficial instala a versão publicada no registro, que pode ser diferente da versão do GitHub.

Para instalar no **Termux**, dentro da pasta da sua aplicação:

```bash
pkg update -y
pkg install nodejs-lts git -y
npm install @stone-wpp/ofc
```

No Android, algumas dependências podem exigir suporte nativo. Prefira instalar na pasta privada do Termux.

---

## ⚡ EXEMPLO RÁPIDO

```js
import createStone, { useMultiFileAuthState } from '@stone-wpp/ofc'

const { state, saveCreds } = await useMultiFileAuthState('./sessao')
const stone = createStone({ auth: state })

stone.ev.on('creds.update', saveCreds)

stone.ev.on('connection.update', ({ connection }) => {
  console.log('[ STONE ]', connection)
})
```

Para entender cada método, opções de conexão, eventos e exemplos, acesse a **[documentação oficial](https://stone-wpp.squareweb.app/)**.

> A Stone WPP é uma **biblioteca**, não um bot pronto. Não possui `npm start` próprio. Proteja suas sessões e credenciais; não as publique em repositórios.

---

## 🔗 LINKS OFICIAIS

| Recurso | Endereço |
| :--- | :--- |
| 📖 **Documentação completa** | **[stone-wpp.squareweb.app](https://stone-wpp.squareweb.app/)** |
| 📦 **Pacote npm** | [@stone-wpp/ofc](https://www.npmjs.com/package/@stone-wpp/ofc) |
| 🛠️ **Código-fonte** | [GitHub — Stone WPP](https://github.com/dylan-Modz/stone-wpp-ofc) |
| 🐛 **Erros e sugestões** | [GitHub Issues](https://github.com/dylan-Modz/stone-wpp-ofc/issues) |

---

<div align="center">

<a href="https://github.com/dylan-Modz">
<img src="https://github.com/dylan-Modz.png?size=150" width="100" height="100" alt="Dylan Modz" />
</a>

### 👨‍💻 Dylan Modz

**Criador e mantenedor da Stone WPP**

<img src="https://img.shields.io/badge/STONE%20WPP-00BFFF?style=for-the-badge&labelColor=111820" alt="Stone WPP" />

<br><br>

**Licença MIT** · Projeto independente, sem afiliação oficial com WhatsApp ou Meta.

<br>

<a href="https://stone-wpp.squareweb.app/"><img src="https://img.shields.io/badge/VER%20TODAS%20AS-DOCUMENTA%C3%87%C3%95ES-00BFFF?style=for-the-badge&labelColor=111820" alt="Ver documentação completa"></a>

**STONE WPP • Conecte. Desenvolva. Evolua.**

</div>
