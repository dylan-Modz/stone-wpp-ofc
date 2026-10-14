# Stone WPP

**Stone WPP** é uma biblioteca de conexão com WhatsApp, distribuída como `@stone-wpp/ofc`.

**Versão:** `1.0.0`

## Instalação

```bash
npm install @stone-wpp/ofc
```

> O comando acima depende da publicação do pacote no npm. Enquanto isso, é possível instalar diretamente pelo GitHub:
>
> `npm install github:dylan-Modz/stone-wpp-ofc#main`

## Utilização (ESM)

```js
import makeWASocket, { useMultiFileAuthState } from '@stone-wpp/ofc'

const { state, saveCreds } = await useMultiFileAuthState('./session')
const sock = makeWASocket({ auth: state })
sock.ev.on('creds.update', saveCreds)
```

## Requisitos

- Node.js 20 ou superior
- As mesmas dependências e funcionalidades da base utilizada para esta distribuição

## Licença e créditos

MIT. Este projeto preserva o código, a licença e os avisos de copyright dos autores anteriores. Veja [LICENSE](./LICENSE) e [README-UPSTREAM.md](./README-UPSTREAM.md) para a documentação histórica da base.

Este projeto não é afiliado ao WhatsApp.
