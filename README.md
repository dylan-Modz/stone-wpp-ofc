# Stone WPP

Biblioteca de conexão com WhatsApp. Pacote **`@stone-wpp/ofc`**, versão **1.0.0**.

> Biblioteca em desenvolvimento, sem publicação no registro npm. Os módulos novos possuem testes unitários; a conexão com o serviço precisa de validação real.

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
- `tests/`: testes automatizados
- `docs/`: guias e limites das funcionalidades

Veja [documentação](./docs/instalacao.md) e [referência dos recursos](./docs/recursos.md).

## Desenvolvimento

```bash
npm install
npm test
```

A interface antiga de mensagens e grupos continua disponível para compatibilidade. Os novos recursos são acessados pelo namespace `socket.stone`.

## Licença

MIT. Os direitos autorais e os avisos legais das contribuições anteriores permanecem preservados em [LICENSE](./LICENSE). Projeto independente, sem afiliação com o WhatsApp.
