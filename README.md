<div align="center">

<a href="https://stone-wpp.vercel.app/">
  <img src="https://readme-typing-svg.herokuapp.com?font=Fira+Code&weight=700&size=31&pause=1000&color=00BFFF&center=true&vCenter=true&width=760&lines=STONE+WPP;DOCUMENTA%C3%87%C3%83O+OFICIAL;CRIADO+POR+DYLAN+MODZ" alt="STONE WPP — Documentação Oficial" />
</a>

<br>

<a href="https://stone-wpp.vercel.app/">
  <img src="https://raw.githubusercontent.com/Yoshirukkj/Download-/main/1b2li6.jpg" alt="Banner oficial Stone WPP — clique para acessar a documentação" width="800" />
</a>

<br><br>

**STONE WPP — Biblioteca modular para WhatsApp em Node.js**

*Conexão • Autenticação • Mensagens • Botões • Grupos • Canais • Plugins*

<br>

<a href="https://www.npmjs.com/package/@stone-wpp/ofc"><img src="https://img.shields.io/npm/v/%40stone-wpp%2Fofc?style=for-the-badge&logo=npm&logoColor=white&label=VERS%C3%83O&color=00BFFF&labelColor=111820" alt="Versão publicada no npm"></a>
<img src="https://img.shields.io/badge/NODE.JS-20%2B-111820?style=for-the-badge&logo=node.js&logoColor=00BFFF" alt="Node.js 20 ou superior">
<img src="https://img.shields.io/badge/LICENSE-MIT-00BFFF?style=for-the-badge&labelColor=111820" alt="Licença MIT">

<br><br>

<a href="https://stone-wpp.vercel.app/">
  <img src="https://img.shields.io/badge/ACESSAR-DOCUMENTA%C3%87%C3%83O%20OFICIAL-00BFFF?style=for-the-badge&labelColor=111820&logo=readthedocs&logoColor=white" alt="ACESSAR DOCUMENTAÇÃO OFICIAL STONE WPP">
</a>

<br>

**[📖 Clique aqui para abrir o site completo da documentação](https://stone-wpp.vercel.app/)**

<sub>Guias, referências, comandos, explicações e exemplos de uso organizados no site.</sub>

</div>

---

## 📚 DOCUMENTAÇÃO COMPLETA

A documentação principal da **Stone WPP** está disponível no nosso site oficial, com navegação por categorias, pesquisa e exemplos. Em vez de repetir todos os tutoriais aqui no npm, centralizamos as explicações no site para você encontrar cada recurso no lugar certo.

<div align="center">

### **[🌐 ABRIR DOCUMENTAÇÃO — STONE WPP](https://stone-wpp.vercel.app/)**

**https://stone-wpp.vercel.app/**

</div>

| O que você encontra | Conteúdo |
| :--- | :--- |
| 🚀 **Primeiros passos** | Instalação, configuração e uso inicial. |
| 🔐 **Autenticação** | Sessão, conexão e reconexão. |
| 💬 **Mensagens** | Envio, recebimento e eventos. |
| 🧩 **Botões** | Exemplos e referências das mensagens interativas. |
| 👥 **Grupos e comunidades** | Operações e gerenciamento. |
| 📢 **Canais** | Métodos e recursos disponíveis. |
| ⚙️ **Outros módulos** | API, armazenamento, plugins e funcionalidades relacionadas. |

> **Importante:** a Stone WPP está em desenvolvimento. Consulte a documentação para conhecer os recursos disponíveis e suas limitações. Nem todas as funções planejadas estão implementadas.

---

## 📦 INSTALAÇÃO PELO NPM

```bash
npm install @stone-wpp/ofc
```

**Requisitos:** Node.js **20+**. Biblioteca em JavaScript com suporte a ES Modules.

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

Para entender cada método, opções de conexão, eventos e exemplos, acesse a **[documentação oficial](https://stone-wpp.vercel.app/)**.

> A Stone WPP é uma **biblioteca**, não um bot pronto. Não possui `npm start` próprio. Proteja suas sessões e credenciais; não as publique em repositórios.

---

## 🔗 LINKS OFICIAIS

| Recurso | Endereço |
| :--- | :--- |
| 📖 **Documentação completa** | **[stone-wpp.vercel.app](https://stone-wpp.vercel.app/)** |
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

<a href="https://stone-wpp.vercel.app/"><img src="https://img.shields.io/badge/VER%20TODAS%20AS-DOCUMENTA%C3%87%C3%95ES-00BFFF?style=for-the-badge&labelColor=111820" alt="Ver documentação completa"></a>

**STONE WPP • Conecte. Desenvolva. Evolua.**

</div>
