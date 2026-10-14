# Stone WPP

Biblioteca de conexão com WhatsApp. Pacote **`@stone-wpp/ofc`**, versão **1.0.0**.

> Biblioteca em desenvolvimento e ainda não publicada no npm. A conexão real com o WhatsApp precisa de validação antes do uso em produção.

## Instalação por GitHub

```bash
npm install github:dylan-Modz/stone-wpp-ofc#main
```

## Exemplo de uso

```js
import createStone, { useMultiFileAuthState } from '@stone-wpp/ofc'

const { state, saveCreds } = await useMultiFileAuthState('./sessao')
const socket = createStone({ auth: state })
socket.ev.on('creds.update', saveCreds)

const dados = await socket.stone.canais.informacoes('0@newsletter')
console.log(dados)
```

## Organização

- `lib/Socket/`: conexão e mensagens existentes
- `lib/Recursos/`: canais, grupos, bots, listas e chamadas
- `lib/Store/`: dados em memória, JSON e SQLite opcional
- `lib/Plugins/`: extensões com limpeza de recursos

## Requisitos

- **Stone WPP normal:** Node.js **20 ou superior**; não exige SQLite.
- **Store de memória e JSON:** disponíveis normalmente no Node.js 20+.
- **SQLite nativo opcional:** Node.js **22.13+** ou **24+** (em Node.js 22.5–22.12, somente com `--experimental-sqlite`).
- Quem não utilizar SQLite não precisa atualizar para Node.js 24 nem instalar dependências adicionais.

## Desenvolvimento

```bash
npm install
```

A interface antiga de mensagens e grupos continua disponível para compatibilidade. Os novos recursos são acessados pelo namespace `socket.stone`.

## Licença

MIT. Os direitos autorais e os avisos legais das contribuições anteriores permanecem preservados em [LICENSE](./LICENSE). Projeto independente, sem afiliação com o WhatsApp.
