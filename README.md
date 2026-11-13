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

## 🚀 Stone WPP 1.0.7 — novidades e melhorias

A **1.0.7** apresenta um módulo totalmente novo de chamadas e aperfeiçoa recursos que a Stone WPP já oferecia.

### 🆕 Novidades desta versão

**📞 Vox**

**Vox** é o novo módulo de chamadas da Stone WPP. Ele utiliza a tecnologia VoIP na **mesma conexão autenticada do WhatsApp**, pela interface `stone.calls`.

- **Chamadas de voz:** iniciar, atender, recusar e encerrar ligações.
- **Música e áudio:** carregar arquivos de áudio e transmitir áudio em tempo real, conforme o suporte do ambiente.
- **Eventos de chamadas:** acompanhar ligações recebidas, alterações de estado e encerramentos.
- **Links e convites:** gerar links de chamada de voz ou vídeo e compartilhá-los com grupos.
- **Chamadas em grupo:** novas interfaces para iniciar, entrar e sair de chamadas, ainda em caráter experimental.
- **Controle do módulo:** consultar a disponibilidade dos recursos com `getVoipStatus()` e `getCapabilities()`.

> **Vox é uma novidade experimental.** Algumas funções, principalmente chamadas em grupo, dependem da compatibilidade com o WhatsApp e podem não funcionar em todos os ambientes.

**🔎 Novas ferramentas de diagnóstico**

- `resolveJidMapping(jid)` — consulta o mapeamento conhecido entre identificadores PN e LID.
- `inspectSignalSession(jid)` — consulta a existência de uma sessão criptográfica Signal.

### 🛠️ Melhorias nas funções que já existiam

- **Downloads de mídia:** recuperação aprimorada quando a URL direta responde com HTTP 403, 404 ou 410, tentando a URL original quando possível.
- **Arquivos e descriptografia:** identificação mais clara de mídias sem chave e limites de espera para evitar processamento preso em tentativas de recuperação.
- **Identificadores PN/LID:** tratamento aprimorado dos JIDs de usuários e dispositivos nas respostas da sincronização USync.
- **Estabilidade e integração:** ajustes no tratamento dos eventos e na consistência das informações de sessão, mantendo os recursos de mensagens, grupos e canais.

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
| Vox | Chamadas de voz, áudio, links e eventos |
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
