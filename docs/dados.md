# Stone WPP — dados

Interfaces: `get`, `set`, `delete`, `list`, `clear` e `close`.

```js
import { createStoneStore } from '@stone-wpp/ofc'

const memoria = await createStoneStore({ type: 'memory' })
const arquivo = await createStoneStore({ type: 'json', path: './dados/stone.json' })
await arquivo.set('chave', { valor: 123 })
console.log(await arquivo.get('chave'))
await arquivo.close()
```

SQLite opcional, sem adicionar dependências obrigatórias:

```js
const sqlite = await createStoneStore({ type: 'sqlite', path: './dados/stone.sqlite' })
```

O adaptador SQLite depende de uma versão recente do Node que ofereça `node:sqlite`. O armazenamento local é genérico e **não substitui automaticamente** a autenticação e o armazenamento de Signal existentes.

Para usar um Store próprio no histórico local dos grupos:

```js
const socket = createStone({ auth: state, stone: { store: arquivo } })
```

Nunca armazene chaves de sessão em repositórios públicos.
