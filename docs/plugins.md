# Stone WPP — plugins

Cada plugin informa `name` e implementa `install`, que pode devolver uma função de limpeza.

```js
await socket.stone.plugins.use({
    name: 'eventos',
    install({ socket }) {
        const handler = evento => console.log(evento)
        socket.ev.on('messages.upsert', handler)
        return () => socket.ev.off('messages.upsert', handler)
    }
})

console.log(socket.stone.plugins.list())
await socket.stone.plugins.remove('eventos')
```

Você também pode chamar `await socket.stone.plugins.close()` no encerramento da aplicação.

O gerenciador é intencionalmente pequeno e não altera os métodos internos da conexão.
