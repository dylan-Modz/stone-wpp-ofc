# groupProtection — proteção de grupos na Stone WPP

A API nativa `sock.groupProtection(jid, options)` usa a recepção da própria Stone e
não modifica o protocolo de criptografia. Detecta rajadas de mensagens de pagamento
e flood, observa falhas de descriptografia, recibos de retry e solicitações PDO de
recuperação. **Nenhuma dessas observações é garantia de ataque ou de mensagem recuperada.**

## 1. Ativar sem risco

```js
await sock.groupProtection(grupoJid, {
  enabled: true,
  mode: 'alert',
  observeInvisible: true,
  observeReceipts: true
})

sock.ev.on('group-protection.alert', alerta => {
  console.log(alerta.jid, alerta.reason, alerta.severity, alerta.verified)
})
```

O modo `alert` não apaga conteúdo e não remove pessoas. Use-o em um grupo próprio
para calibrar os limites antes de optar por moderação automática.

## 2. Moderação automática e imunidade

```js
await sock.groupProtection(grupoJid, {
  enabled: true,
  mode: 'protect',
  paymentBurst: 3,
  messageBurst: 14,
  windowMs: 8000,
  lockMs: 12000,
  editNotice: true,
  immunity: [donoJid, moderadorJid]
})
```

| Opção | Significado |
| --- | --- |
| `mode: 'alert'` | Só registra alertas (padrão) |
| `mode: 'delete'` | Tenta excluir a mensagem de rajada verificada |
| `mode: 'remove'` | Tenta excluir e remover participante |
| `mode: 'protect'` | Tenta fechar temporariamente, excluir e remover |
| `paymentBurst` | Número de mensagens de pagamento por remetente na janela (2–30) |
| `messageBurst` | Número de mensagens por remetente na janela (3–100) |
| `windowMs` | Janela de observação em milissegundos (1.000–60.000) |
| `lockMs` | Intervalo de fechamento do grupo (3.000–120.000 ms) |
| `immunity` | Até 200 JIDs que jamais serão removidos automaticamente |
| `editNotice` | Edita **somente avisos enviados pelo bot**, nunca mensagens de terceiros |
| `observeReceipts` | Observa recibos de retry (padrão: true) |
| `receiptBurst` | Volume que gera alerta leve de recibos (3–50) |
| `historyLimit` | Registros recentes mantidos por grupo (20–500) |

O bot precisa ser administrador. Pessoas sem identidade confirmada, administradores
e JIDs imunes não são expulsos. **PN e LID são tipos diferentes de identificador**:
inclua as formas conhecidas na imunidade se aplicável. Rajadas de mensagens legítimas
podem parecer ataques; ajuste os limites conforme o grupo.

## 3. Recibos ocultos e PDO já existente

A Stone já possui `requestPlaceholderResend`, retry e PDO. A proteção acrescenta
**telemetria passiva** ao caminho nativo, sem duplicar solicitações:

```js
sock.ev.on('group-protection.pdo-observed', ({ jid, messageId, status }) => {
  console.log('PDO do grupo:', jid, messageId, status)
})

sock.ev.on('group-protection.alert', alerta => {
  if (alerta.reason === 'receipt-suspected') {
    console.log('Rajada de retry observada — sem expulsão automática')
  }
})
```

`group-protection.receipt` é o evento bruto com `remoteJid`, `participant`,
`messageId` e `type: 'retry'`. `group-protection.pdo` informa eventos nativos
`requested`, `resolved` ou `timeout`; `group-protection.pdo-observed`
exibe apenas os PDO dos grupos ativados. Recebimentos de retry e falhas de
descriptografia são **sinais técnicos**, não prova de intenção maliciosa.
Um pedido PDO pode falhar, expirar ou retornar sem recuperar o conteúdo.

## 4. Salvar configurações e consultar histórico

Use `createStoneStore` com JSON ou SQLite. O armazenamento é **opcional** e
precisa ser informado explicitamente. Exemplo:

```js
import { createStoneStore } from '@stone-wpp/ofc'

const store = await createStoneStore({ type: 'json', path: './dados/protecao.json' })
await sock.groupProtection(grupoJid, {
  enabled: true,
  mode: 'alert',
  store,
  immunity: [donoJid],
  historyLimit: 100
})

// Após reiniciar o bot, com o mesmo store:
await sock.groupProtection(grupoJid, { restore: true, store })

// Consultar últimos 30 registros, sem dados de mensagens:
const status = await sock.groupProtection(grupoJid, { getHistory: true, limit: 30 })
console.log(status.history)

// Desativar e salvar o estado desligado:
await sock.groupProtection(grupoJid, { enabled: false, store })
```

O histórico salva somente grupo, participante, tipo de alerta/ação, situação de
moderação e horário. Não armazena automaticamente texto de mensagens, ciphertext
ou chaves da sessão. A proteção só restaura grupos que o seu aplicativo indicar;
o store **não inicia sessões nem descobre todos os grupos sozinho**.

## 5. Até três monitores complementares com reconexão

`monitors` aceita sockets Stone já criados. Para **recriação automática**
de um monitor após queda temporária use `monitorFactories`: a função factory
deve criar o socket autenticado e carregar/persistir sua própria sessão.

```js
await sock.groupProtection(grupoJid, {
  enabled: true,
  mode: 'alert',
  monitorFactories: [
    async ({ attempt }) => criarMonitorComSessaoSalva('auxiliar1', attempt),
    async ({ attempt }) => criarMonitorComSessaoSalva('auxiliar2', attempt)
  ],
  monitorReconnectMs: 3000
})

sock.ev.on('group-protection.monitor', ({ index, status, error }) => {
  console.log('Monitor:', index, status, error || '')
})
```

A função `criarMonitorComSessaoSalva` é criada **pela sua aplicação**;
ela não é uma exportação da Stone. Ela deve utilizar suas próprias credenciais
de WhatsApp, do mesmo modo que você cria a sessão principal. Cada número
auxiliar precisa ser autenticado **com autorização do proprietário** e
participar do grupo. Não há pareamento silencioso: em caso de logout (401),
a proteção não tenta conectar novamente sem novo vínculo.

`monitors` e `monitorFactories` juntos aceitam **até três** sessões adicionais.
A Stone deduplica IDs recebidos de mais de uma sessão e observa apenas os
grupos em que o monitor foi configurado. Uma mensagem omitida pelo WhatsApp
para todas as sessões continua invisível.

## 6. Status, erros e testes

```js
const state = await sock.groupProtection(grupoJid)
console.log(state.enabled, state.mode, state.monitorCount)
console.log(state.alerts, state.actions)
```

Eventos de acompanhamento:
- `group-protection.alert` — motivo, gravidade, evidência limitada e origem.
- `group-protection.action` — tentativa e resultado da moderação.
- `group-protection.monitor` — monitor conectado, erro ou logout.
- `group-protection.pdo-observed` — telemetria de recuperação de placeholder.

Testes locais: `npm test`. Ative inicialmente `mode: 'alert'` em grupos controlados,
verifique casos normais (pagamento legítimo, perda de conexão, um participante
muito ativo) e só depois considere `delete`, `remove` ou `protect`.
A proteção não falsifica mensagens atribuídas a terceiros, não garante
detectar todos os bypasses e não substitui as regras oficiais do WhatsApp.
