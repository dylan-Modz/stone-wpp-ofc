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

## 🆕 Stone WPP 1.0.7 — estabilidade e diagnóstico

- **Mídias:** nova tentativa pelo link original quando o caminho direto retorna HTTP 403, 404 ou 410. Chave ausente agora gera erro claro, sem prometer descriptografar conteúdo indisponível.
- **Reenvio de mídia:** validação de chave e limite de espera de 60 segundos por padrão (ou `defaultQueryTimeoutMs`), evitando espera ilimitada.
- **Identidades LID/PN:** trata respostas USync com números específicos de dispositivo sem provocar erro ao percorrer os dispositivos.
- **Diagnóstico:** os métodos `resolveJidMapping(jid)` e `inspectSignalSession(jid)` consultam os dados da sessão, sem recriar chaves.
- **Compatibilidade:** comandos e configurações existentes continuam com os nomes anteriores.

```js
// Diagnósticos opcionais; não alteram chaves nem enviam mensagens.
const mapping = await stone.resolveJidMapping('5511999999999@s.whatsapp.net')
const session = await stone.inspectSignalSession('5511999999999@s.whatsapp.net')
console.log({ mapping, session })
```

**Limites:** a recuperação de mídia depende de links/chaves válidos; não recria mídia expirada nem garante recuperação de visualização única. Chamadas de voz e vídeo ainda não fazem parte desta versão. Publicação no registro npm é uma etapa independente do código no GitHub.

---

## 🛡️ Proteção nativa dos grupos — v1.0.6

A `groupProtection` integra proteção contra flood, mensagens de pagamento em rajada, citações suspeitas e indícios de mensagens invisíveis. Ela reutiliza o recebimento, o retry e o PDO nativos da Stone. É **opcional** e **não depende de patches externos**.

A função pertence à categoria **Grupos → Configurações de grupos**, no site de documentação.

```js
// 1. Detectar e avisar (padrão: não pune automaticamente)
await stone.groupProtection(grupoJid, { enabled: true })

// 2. Ouvir ocorrências e resultados
stone.ev.on('group-protection.alert', alerta => {
  console.log(alerta.reason, alerta.severity, alerta.participant)
})
stone.ev.on('group-protection.action', resultado => {
  console.log(resultado)
})

// 3. Moderação automática opcional (use apenas em grupos administrados por você)
await stone.groupProtection(grupoJid, {
  enabled: true,
  mode: 'protect',
  paymentBurst: 3,
  messageBurst: 14,
  windowMs: 8000,
  lockMs: 12000,
  editNotice: true // edita apenas o aviso criado pelo próprio bot
})

// 4. Consultar ou desativar
console.log(await stone.groupProtection(grupoJid))
await stone.groupProtection(grupoJid, { enabled: false })
```

Os modos são `alert` (apenas alertas), `delete` (tenta apagar), `remove` (tenta apagar e remover participante) e `protect` (também fecha temporariamente o grupo). Ações administrativas exigem que o bot seja administrador e **não são disparadas por simples falha de descriptografia**.

Agora a proteção também oferece **lista de imunidade** (`immunity`), **telemetria de recibos de retry e PDO**, **histórico de incidentes** e **persistência opcional** com Stone Store. O `PDO` e a descriptografia continuam sendo os mecanismos originais da Stone, sem alteração das chaves.

Para adicionar até três monitores complementares, use `monitors: [monitor1, monitor2, monitor3]` ou `monitorFactories` para criar/reconectar sessões extras após queda. O pareamento exige autorização: o código pode ser entregue ao titular usando `onPairingCode`, mas nunca é confirmado automaticamente em nome dele.

```js
import { createStoneStore } from '@stone-wpp/ofc'
const store = await createStoneStore({ type: 'json', path: './dados/protecao.json' })
await stone.groupProtection(grupoJid, {
  enabled: true,
  mode: 'alert',
  immunity: [administradorJid],
  observeReceipts: true,
  receiptBurst: 6,
  store
})
// Após reiniciar com a mesma base de dados:
await stone.groupProtection(grupoJid, { restore: true, store })
const { history } = await stone.groupProtection(grupoJid, { getHistory: true })
console.log(history)
```

Os registros de histórico contêm somente metadados sanitizados, sem copiar texto ou ciphertext das mensagens. Recibos e PDO são apenas sinais técnicos: não autorizam expulsão automática.

### ✏️ Editar mensagens da própria conta

A Stone já suporta edição nativa com `sendMessage(jid, { text, edit: key })`. A v1.0.6 adiciona o atalho `editMessage`, documentado em **Mensagens → Apagar e editar**:

```js
const enviada = await stone.sendMessage(grupoJid, { text: 'Aviso inicial' })
await stone.editMessage(grupoJid, enviada.key, 'Aviso atualizado')
```

O WhatsApp não garante que seja possível editar texto escrito por terceiros; um administrador pode excluir uma mensagem alheia, mas não reescrevê-la em nome de outra pessoa.

**Documentação completa:** [groupProtection e seus limites](docs/group-protection.md) · [Configurações de grupos no site](https://stone-wpp.squareweb.app/#/groups/configuracoes) · [Apagar e editar no site](https://stone-wpp.squareweb.app/#/messages/apagar).

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
