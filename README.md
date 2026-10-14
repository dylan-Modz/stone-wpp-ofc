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

- **Node.js 24 ou superior**, para utilizar os módulos da Stone, incluindo o SQLite nativo opcional.
- O SQLite nativo não precisa ser instalado como dependência adicional.

## Desenvolvimento

```bash
npm install
```

A interface antiga de mensagens e grupos continua disponível para compatibilidade. Os novos recursos são acessados pelo namespace `socket.stone`.

## Licença

MIT. Os direitos autorais e os avisos legais das contribuições anteriores permanecem preservados em [LICENSE](./LICENSE). Projeto independente, sem afiliação com o WhatsApp.
