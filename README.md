<div align="center">

<img src="https://readme-typing-svg.herokuapp.com/?font=monospace&size=30&duration=2500&color=00BFFF&center=true&vCenter=true&width=720&lines=STONE+WPP+%F0%9F%AA%A8;CRIADO+POR+DYLAN+MODZ;BIBLIOTECA+PARA+WHATSAPP;STONE+WPP+V1.0.0" alt="Stone WPP">

<p align="center">
  <img src="https://raw.githubusercontent.com/Yoshirukkj/Download-/main/1b2li6.jpg" alt="Stone WPP — Banner" width="720">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/STONE%20WPP-EM%20DESENVOLVIMENTO-00BFFF?style=for-the-badge&labelColor=111111" alt="Stone WPP em desenvolvimento">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Autor-Dylan%20Modz-00BFFF?style=for-the-badge&logo=github&logoColor=white&labelColor=111111" alt="Autor">
  <img src="https://img.shields.io/badge/Vers%C3%A3o-1.0.0-00BFFF?style=for-the-badge&logo=node.js&logoColor=white&labelColor=111111" alt="Versão">
</p>

<p align="center">
  <a href="https://github.com/dylan-Modz/stone-wpp-ofc">
    <img src="https://img.shields.io/badge/GITHUB-111111?style=for-the-badge&logo=github&logoColor=white" alt="GitHub">
  </a>
  <a href="https://github.com/dylan-Modz/stone-wpp-ofc/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/LICENSE-MIT-00BFFF?style=for-the-badge&logoColor=white" alt="Licença MIT">
  </a>
  <img src="https://img.shields.io/badge/NODE.JS-20%2B-111111?style=for-the-badge&logo=node.js&logoColor=00BFFF" alt="Node.js 20+">
</p>

</div>

---

## 🪨 ATENÇÃO

> [!IMPORTANT]
> A **Stone WPP** é uma biblioteca para projetos que utilizam conexão com WhatsApp. Ela **não é um bot pronto**.
>
> A instalação pode ser feita diretamente pelo GitHub. A conexão real deve ser validada antes de utilizar em produção.

<details>
<summary><b>🪨 Ler mais...</b></summary>

A Stone oferece uma interface de conexão e módulos complementares organizados em pastas, permitindo que cada aplicação monte seus próprios recursos.

As funções adicionais de canais, grupos e armazenamento possuem limites documentados nesta página. Nenhuma chave de API é exigida pela instalação básica.

</details>

---

<details>
<summary><b>🪨 INSTALAÇÃO POR GITHUB</b></summary>

Para adicionar a **Stone WPP** ao seu projeto:

```bash
npm install github:dylan-Modz/stone-wpp-ofc#main
```

Se preferir baixar o repositório para desenvolver a biblioteca:

```bash
git clone https://github.com/dylan-Modz/stone-wpp-ofc.git
cd stone-wpp-ofc
npm install
```

> A biblioteca não possui comando próprio `npm start`. A inicialização é feita pelo projeto que utiliza a Stone.

</details>

---

<details>
<summary><b>🪨 INSTALAÇÃO PELO TERMUX</b></summary>

Atualize os pacotes e instale Node.js e Git:

```bash
pkg update -y && pkg upgrade -y
pkg install nodejs-lts git -y
```

Dentro da pasta do **seu bot ou aplicação**:

```bash
npm install github:dylan-Modz/stone-wpp-ofc#main
```

Se o projeto estiver no armazenamento compartilhado do Android, algumas instalações podem exigir `--no-bin-links`. Sempre que possível, instale as dependências na pasta privada do Termux.

> [!CAUTION]
> A instalação e a conexão podem variar de acordo com o aparelho, a versão do Node.js e o ambiente. Algumas dependências podem precisar de suporte nativo no Android.

</details>

---

<details>
<summary><b>🪨 VPS / LINUX</b></summary>

Utilize Node.js 20 ou superior no seu projeto e execute:

```bash
npm install github:dylan-Modz/stone-wpp-ofc#main
```

Para editar o código da biblioteca, clone o repositório e instale as dependências com `npm install`.

</details>

---

## 🪨 EXEMPLO DE CONEXÃO

```js
import createStone, { useMultiFileAuthState } from '@stone-wpp/ofc'

const { state, saveCreds } = await useMultiFileAuthState('./sessao')
const stone = createStone({ auth: state })

stone.ev.on('creds.update', saveCreds)

stone.ev.on('connection.update', ({ connection }) => {
  console.log('[ STONE ]', connection)
})
```

Para utilizar os recursos adicionais:

```js
const canais = stone.stone.canais
const grupos = stone.stone.grupos
const plugins = stone.stone.plugins
```

> Proteja os arquivos de autenticação. Não publique sessões ou credenciais no GitHub.

---

## 🪨 REQUISITOS

| Componente | Requisito |
| :--- | :--- |
| Node.js | **20 ou superior** para a biblioteca normal |
| SQLite nativo (opcional) | **22.13+** ou **24+**; versões 22.5–22.12 exigem sinalizador experimental |
| Git | Para clonar o repositório |
| Internet | Conexão necessária para utilizar o serviço |
| npm | Para instalar as dependências |

Quem não utiliza SQLite pode continuar usando a Stone no Node.js 20+, sem instalar um banco de dados adicional.

---

## 🪨 SISTEMAS

| Sistema | Função |
| :--- | :--- |
| Socket | Conexão, autenticação, mensagens e eventos |
| Grupos | Gerenciamento de membros, permissões e solicitações |
| Comunidades | Operações com comunidades e grupos vinculados |
| Canais | Informações, mensagens e reações; buscas e métricas locais |
| Bots | Envio e recebimento por meio dos eventos disponíveis |
| Listas | Envio individual para contatos com consentimento |
| Chamadas | Links de áudio/vídeo e rejeição quando disponível |
| Store | Armazenamento em memória, JSON e SQLite opcional |
| Plugins | Registro, gerenciamento e remoção de extensões |

> Busca remota avançada de canais, listas de transmissão nativas, compartilhamento de histórico antigo com novos membros, chamadas com mídia em tempo real e conexão móvel primária **ainda não estão implementados**.

---

<details>
<summary><b>🪨 ESTRUTURA DA BIBLIOTECA</b></summary>

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

</details>

---

## 🪨 SOBRE O PROJETO

A **Stone WPP** é um projeto independente, voltado à evolução de uma biblioteca de comunicação com WhatsApp. A proposta é manter o código organizado, modular e preparado para receber melhorias sem obrigar os usuários a instalar funcionalidades opcionais.

**Pacote:** `@stone-wpp/ofc`  
**Versão:** `1.0.0`  
**Repositório:** [Stone WPP no GitHub](https://github.com/dylan-Modz/stone-wpp-ofc)

---

## 🪨 DESENVOLVEDOR

<div align="center">

<table>
<tr>
<td align="right" valign="middle">

<img src="https://github.com/dylan-Modz.png?size=120" alt="Dylan Modz" width="120" height="120">

</td>
<td align="left" valign="middle">

<h2>Dylan Modz</h2>

<p>Desenvolvedor e mantenedor da Stone WPP.</p>

<p>
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/Node.js-00BFFF?style=flat-square&logo=node.js&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/STONE%20WPP-00BFFF?style=flat-square&logo=whatsapp&logoColor=white" alt="Stone WPP">
</p>

</td>
</tr>
</table>

</div>

---

## 🪨 LICENÇA

O projeto utiliza a licença **MIT**. Os avisos de copyright e os direitos dos contribuidores anteriores permanecem preservados no arquivo [LICENSE](./LICENSE).

A Stone WPP não possui afiliação oficial com o WhatsApp.

---

<div align="center">

# 🪨 STONE WPP

### Desenvolvido por Dylan Modz

**Stone WPP • Biblioteca para WhatsApp • 1.0.0**

</div>
