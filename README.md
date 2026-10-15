<div align="center">

<img src="https://readme-typing-svg.herokuapp.com?font=Fira+Code&weight=700&size=32&pause=1100&color=00BFFF&center=true&vCenter=true&width=700&lines=STONE+WPP+%F0%9F%AA%A8;DOCUMENTA%C3%87%C3%83O+OFICIAL;CRIADO+POR+DYLAN+MODZ" alt="Stone WPP — Documentação Oficial" />

<br>

<a href="https://stone-wpp.vercel.app/">
  <img src="https://raw.githubusercontent.com/Yoshirukkj/Download-/main/1b2li6.jpg" alt="Stone WPP — Banner Oficial" width="800" />
</a>

<br><br>

**Uma biblioteca modular para criar aplicações conectadas ao WhatsApp com Node.js.**

*Conexão • Autenticação • Mensagens • Grupos • Canais • Plugins*

<br>

<a href="https://www.npmjs.com/package/@stone-wpp/ofc">
  <img src="https://img.shields.io/npm/v/%40stone-wpp%2Fofc?style=for-the-badge&logo=npm&logoColor=white&label=NPM&color=00BFFF&labelColor=101820" alt="Versão no npm" />
</a>
<img src="https://img.shields.io/badge/NODE.JS-20%2B-101820?style=for-the-badge&logo=node.js&logoColor=00BFFF" alt="Node.js 20+" />
<img src="https://img.shields.io/badge/LICEN%C3%87A-MIT-00BFFF?style=for-the-badge&labelColor=101820" alt="Licença MIT" />

<br>

<img src="https://img.shields.io/badge/STATUS-EM%20DESENVOLVIMENTO-00BFFF?style=flat-square&labelColor=101820" alt="Em desenvolvimento" />
<img src="https://img.shields.io/badge/ESM-SUPORTADO-00BFFF?style=flat-square&labelColor=101820" alt="ES Modules" />
<img src="https://img.shields.io/badge/CRIADOR-DYLAN%20MODZ-00BFFF?style=flat-square&labelColor=101820" alt="Dylan Modz" />

<br><br>

<a href="https://www.npmjs.com/package/@stone-wpp/ofc">
  <img src="https://img.shields.io/badge/📦%20NPM-INSTALAR%20PACOTE-00BFFF?style=for-the-badge&labelColor=101820" alt="Instalar pelo npm" />
</a>
<a href="https://stone-wpp.vercel.app/">
  <img src="https://img.shields.io/badge/📖%20DOCS-VER%20DOCUMENTA%C3%87%C3%83O-101820?style=for-the-badge&labelColor=00BFFF" alt="Documentação" />
</a>
<a href="https://github.com/dylan-Modz/stone-wpp-ofc">
  <img src="https://img.shields.io/badge/GITHUB-C%C3%93DIGO%20FONTE-101820?style=for-the-badge&logo=github&logoColor=white" alt="GitHub" />
</a>

</div>

---

## 🪨 INSTALAÇÃO

A **Stone WPP** está disponível no registro público do npm sob o nome **`@stone-wpp/ofc`**.

```bash
npm install @stone-wpp/ofc
```

Outros gerenciadores de pacotes:

```bash
pnpm add @stone-wpp/ofc
# ou
yarn add @stone-wpp/ofc
```

> **Importante:** a Stone WPP é uma **biblioteca**, não um bot pronto. A inicialização e a configuração são feitas pela aplicação que a utiliza. Node.js **20 ou superior** é necessário.

**Links úteis:** [NPM](https://www.npmjs.com/package/@stone-wpp/ofc) · [Documentação online](https://stone-wpp.vercel.app/) · [Repositório](https://github.com/dylan-Modz/stone-wpp-ofc)

---

## ⚡ PRIMEIROS PASSOS

### 01 — Criar a conexão

```js
import createStone, { useMultiFileAuthState } from '@stone-wpp/ofc'

const { state, saveCreds } = await useMultiFileAuthState('./sessao')
const stone = createStone({ auth: state })

stone.ev.on('creds.update', saveCreds)

stone.ev.on('connection.update', ({ connection }) => {
  console.log('[ STONE ]', connection)
})
```

### 02 — Acessar recursos adicionais

```js
const canais = stone.stone.canais
const grupos = stone.stone.grupos
const plugins = stone.stone.plugins
```

> Guarde os arquivos de autenticação com segurança. Nunca publique sessões, chaves ou credenciais em repositórios.

Para guias completos, parâmetros e exemplos, visite a **[documentação oficial](https://stone-wpp.vercel.app/)**.

---

## 🧩 MÓDULOS DA STONE

| Sistema | Recursos |
| :--- | :--- |
| 🔌 **Socket** | Conexão, autenticação, envio e recebimento de mensagens e eventos. |
| 👥 **Grupos** | Gerenciamento de membros, permissões e solicitações. |
| 🏘️ **Comunidades** | Operações com comunidades e grupos vinculados. |
| 📢 **Canais** | Informações, mensagens, reações e métricas locais. |
| 🤖 **Bots** | Integrações baseadas nos eventos disponíveis. |
| 📃 **Listas** | Envio individual para contatos com consentimento. |
| 📞 **Chamadas** | Links de áudio/vídeo e rejeição, quando disponível. |
| 💾 **Store** | Dados em memória, JSON e SQLite opcional. |
| 🧩 **Plugins** | Registro, organização e remoção de extensões. |

**Estado do projeto:** a Stone continua em desenvolvimento. Busca remota avançada de canais, listas de transmissão nativas, compartilhamento de histórico antigo com novos membros, chamadas com mídia em tempo real e conexão móvel primária **ainda não estão implementados**.

---

## 📱 TERMUX / ANDROID

Atualize os pacotes e instale Node.js e Git:

```bash
pkg update -y && pkg upgrade -y
pkg install nodejs-lts git -y
```

Dentro da pasta do seu bot ou aplicação:

```bash
npm install @stone-wpp/ofc
```

> **Atenção:** algumas dependências podem exigir suporte nativo no Android. A instalação e a conexão devem ser verificadas no aparelho utilizado. Prefira a pasta privada do Termux ao armazenamento compartilhado.

---

## 🖥️ VPS / LINUX

Com o Node.js **20+** instalado:

```bash
npm install @stone-wpp/ofc
```

Para contribuir ou estudar o código-fonte:

```bash
git clone https://github.com/dylan-Modz/stone-wpp-ofc.git
cd stone-wpp-ofc
npm install
```

A biblioteca não define seu próprio comando `npm start`. O projeto que usa a Stone deve gerenciar sua execução.

---

## ⚙️ REQUISITOS

| Componente | Versão / observação |
| :--- | :--- |
| **Node.js** | 20 ou superior. |
| **JavaScript** | ES Modules (ESM). |
| **SQLite** *(opcional)* | Node.js 22.13+ ou 24+; 22.5–22.12 exige sinalizador experimental. |
| **npm** | Para instalar e atualizar a biblioteca. |
| **Git** | Necessário apenas para clonar o repositório. |
| **Internet** | Necessária para a comunicação online. |

Sem SQLite, a Stone pode ser usada no Node.js 20+ sem um banco de dados adicional.

---

## 🗂️ ORGANIZAÇÃO DO PROJETO

```text
stone-wpp-ofc/
├── WAProto/
├── lib/
│   ├── Socket/
│   ├── Recursos/
│   │   ├── Canais/
│   │   ├── Grupos/
│   │   ├── Bots/
│   │   ├── Listas/
│   │   └── Chamadas/
│   ├── Store/
│   ├── Plugins/
│   ├── Signal/
│   ├── Defaults/
│   ├── Types/
│   ├── Utils/
│   ├── WABinary/
│   ├── WAUSync/
│   └── WAM/
├── package.json
├── engine-requirements.js
├── README.md
└── LICENSE
```

---

## 📚 DOCUMENTAÇÃO E SUPORTE

A documentação navegável contém páginas para instalação, autenticação, mensagens, botões, grupos, comunidades, canais e mais.

<div align="center">

<a href="https://stone-wpp.vercel.app/">
  <img src="https://img.shields.io/badge/ABRIR-DOCUMENTA%C3%87%C3%83O%20STONE%20WPP-00BFFF?style=for-the-badge&labelColor=101820" alt="Abrir documentação oficial" />
</a>

<br><br>

<a href="https://github.com/dylan-Modz/stone-wpp-ofc/issues">Reportar problemas</a> · <a href="https://github.com/dylan-Modz/stone-wpp-ofc">Acompanhar atualizações</a>

</div>

---

## 👨‍💻 DESENVOLVEDOR

<div align="center">

<a href="https://github.com/dylan-Modz">
  <img src="https://github.com/dylan-Modz.png?size=140" width="112" height="112" alt="Avatar do Dylan Modz" />
</a>

### Dylan Modz

**Criador e mantenedor da Stone WPP**

<img src="https://img.shields.io/badge/JavaScript-101820?style=flat-square&logo=javascript&logoColor=F7DF1E" alt="JavaScript" />
<img src="https://img.shields.io/badge/Node.js-101820?style=flat-square&logo=node.js&logoColor=00BFFF" alt="Node.js" />
<img src="https://img.shields.io/badge/Stone%20WPP-00BFFF?style=flat-square&labelColor=101820" alt="Stone WPP" />

</div>

---

## 📜 LICENÇA

Distribuído sob a licença **MIT**. Consulte o arquivo [LICENSE](https://github.com/dylan-Modz/stone-wpp-ofc/blob/main/LICENSE). Os avisos e direitos dos contribuidores anteriores permanecem preservados.

A Stone WPP é um projeto independente e **não possui afiliação oficial com o WhatsApp ou a Meta**.

---

<div align="center">

### 🪨 STONE WPP

*Conecte. Desenvolva. Evolua.*

**Desenvolvido por Dylan Modz**

<a href="https://www.npmjs.com/package/@stone-wpp/ofc">npm</a> · <a href="https://stone-wpp.vercel.app/">documentação</a> · <a href="https://github.com/dylan-Modz/stone-wpp-ofc">GitHub</a>

</div>
