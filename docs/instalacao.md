# Stone WPP — instalação

Requisitos: Node.js 20 ou superior e npm ou yarn.

Enquanto o pacote não estiver publicado, use a origem GitHub:

```bash
npm install github:dylan-Modz/stone-wpp-ofc#main
```

Para desenvolver a Stone:

```bash
git clone https://github.com/dylan-Modz/stone-wpp-ofc
cd stone-wpp-ofc
npm install
npm test
```

A interface principal continua aceitando as opções de conexão existentes. As extensões aparecem em `socket.stone`. Para configurar o armazenamento, veja [dados](./dados.md).

A versão atual da biblioteca é **1.0.0 em desenvolvimento**. Nenhuma publicação no npm foi feita por este projeto.

Os testes automatizados são unitários; a conexão e o pareamento reais precisam ser testados separadamente.
