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

<a href="https://github.com/dylan-Modz/stone-wpp-ofc"><img src="https://img.shields.io/badge/VERS%C3%83O-1.0.7-00BFFF?style=for-the-badge&logo=github&logoColor=white&labelColor=111820" alt="Versão 1.0.7 do código no GitHub"></a>
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

## 🚀 Stone WPP 1.0.7

A versão **1.0.7** traz novos recursos de chamadas e aprimoramentos na comunicação, no processamento de mídias e na estabilidade da biblioteca.

### 🆕 O que chegou de novo

**📞 Chamadas VoIP (novo módulo experimental)**

A Stone passa a oferecer uma interface integrada para trabalhar com chamadas pela **mesma conexão autenticada do WhatsApp**, sem criar uma sessão adicional.

- **Chamadas de voz:** iniciar, atender, recusar e encerrar ligações pelo gerenciador `stone.calls`.
- **Áudio em chamadas:** reprodução de arquivos de áudio e envio de áudio ao vivo, conforme a disponibilidade do motor.
- **Eventos em tempo real:** informações sobre chamadas recebidas, mudanças de estado e encerramentos.
- **Links de chamada:** criação de links para chamadas de voz e vídeo e envio de convites para grupos.
- **Chamadas em grupo:** API de início, ingresso e saída adicionada em caráter experimental.
- **Informações de recursos:** `getVoipStatus()` e `getCapabilities()` para consultar os recursos disponíveis.

> O módulo VoIP é **experimental** e depende do ambiente e da compatibilidade com o WhatsApp. A presença de uma função na API não garante que uma chamada seja estabelecida, especialmente em grupos.

**🔎 Novas ferramentas de diagnóstico**

- `resolveJidMapping(jid)` — consulta o mapeamento conhecido entre identificadores PN e LID.
- `inspectSignalSession(jid)` — consulta informações sobre a existência de uma sessão Signal.

### 🛠️ O que melhorou nas funções existentes

- **Download de mídias:** tratamento de falhas HTTP **403, 404 e 410**, com nova tentativa pela URL original quando aplicável.
- **Tratamento de arquivos:** identificação mais clara de mídias sem chave de descriptografia e limites de espera durante tentativas de recuperação.
- **Identificadores PN/LID:** melhorias na interpretação de JIDs e dispositivos retornados pela sincronização USync.
- **Conexão e eventos:** ajustes de estabilidade e tratamento de estados, preservando a conexão principal.
- **Compatibilidade:** manutenção dos recursos de mensagens, autenticação, grupos, comunidades e canais.

---

## 📚 Documentação

O site oficial concentra os guias, exemplos e referências das funções disponíveis na Stone WPP.

**[📖 Acessar a documentação completa](https://stone-wpp.squareweb.app/)**

| Área | O que você encontra |
| :--- | :--- |
| Conexão e autenticação | Sessão, eventos e reconexão |
| Mensagens e mídias | Envio, recebimento, downloads e arquivos |
| Grupos e comunidades | Administração e operações de grupos |
| Canais | Recursos de canais do WhatsApp |
| Chamadas | Métodos e eventos do novo módulo VoIP |
| Outros módulos | API, armazenamento e extensões |

---

## 📦 Instalação

**Requisito:** Node.js 20 ou superior.

```bash
npm install @stone-wpp/ofc
```

Para utilizar o código disponível diretamente no GitHub:

```bash
npm install github:dylan-Modz/stone-wpp-ofc#main
```

---

## ⚡ Exemplo rápido

```js
import createStone, { useMultiFileAuthState } from '@stone-wpp/ofc'

const { state, saveCreds } = await useMultiFileAuthState('./sessao')
const stone = createStone({ auth: state })

stone.ev.on('creds.update', saveCreds)

stone.ev.on('connection.update', ({ connection }) => {
  console.log('[ STONE ]', connection)
})
```

Para explorar os métodos e exemplos de integração, consulte a **[documentação oficial](https://stone-wpp.squareweb.app/)**.

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
