# Stone WPP — conexão

```js
import createStone, { useMultiFileAuthState } from '@stone-wpp/ofc'

const { state, saveCreds } = await useMultiFileAuthState('./sessao')
const socket = createStone({ auth: state })
socket.ev.on('creds.update', saveCreds)

socket.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    console.log(connection, lastDisconnect?.error?.message)
})
```

Use o gerenciamento de reconexão da sua aplicação e proteja os arquivos de sessão. Não compartilhe credenciais.

A interface `socket.stone` é adicionada automaticamente quando o socket é criado.

A Stone **não** implementa conexão móvel primária nesta versão.
