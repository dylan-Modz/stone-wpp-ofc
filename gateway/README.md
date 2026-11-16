# Stone Gateway (opcional)

Servidor REST integrado à Stone WPP. Não altera o socket nem o comportamento dos bots existentes.

## Executar

Use Node.js 20+, instale as dependências na raiz do repositório e defina um token secreto com **24 caracteres ou mais**.

```bash
npm install
STONE_API_TOKEN="troque-esta-chave-por-uma-aleatoria-segura" npm run gateway
```

Por padrão escuta apenas em `127.0.0.1:3017`. As sessões persistem no diretório privado `.stone-gateway/sessions`, que **nunca** deve ser publicado. As sessões com credenciais são restauradas no reinício.

Para usar o Stone Studio em https://stone-wpp.squareweb.app/studio/ com um Gateway remoto, configure um reverse proxy **HTTPS** protegido e defina `STONE_ALLOWED_ORIGINS=https://stone-wpp.squareweb.app`. Não exponha o servidor HTTP em texto claro à internet. Token deve ficar privado e não deve ser salvo no site da documentação.

## API (todas as rotas exigem Authorization: Bearer SEU_TOKEN)

- `GET /v1/health` — saúde autenticada.
- `GET /v1/sessions` — sessões conectadas, contadores e estados.
- `POST /v1/sessions` — cria sessão, corpo `{"id":"bot1"}`.
- `GET /v1/sessions/bot1` — estado e imagem do QR Code, quando disponível.
- `POST /v1/sessions/bot1/pair` — pareamento, corpo `{"phoneNumber":"5511999999999"}`.
- `POST /v1/sessions/bot1/messages` — envio individual, corpo `{"to":"5511999999999@s.whatsapp.net","text":"Olá!"}`.
- `GET /v1/webhook` — configuração atual, omitindo segredo.
- `PUT /v1/webhook` — `{"url":"https://seuservico.com/hook","secret":"segredo-com-16-caracteres"}`.

Webhooks: `connection.update`, `messages.upsert`, `groups.update`, `call`. Se o segredo estiver configurado, valide a assinatura HMAC SHA-256 no cabeçalho `X-Stone-Signature` sobre os bytes originais do corpo. Por padrão, cada webhook tem até 5 segundos e não existe fila durável/reentrega garantida. Implementação destinada a uso administrado, não multitenant.

## Segurança e limitações

- O Gateway não instala login público, não aceita origens arbitrárias e não salva o token no navegador.
- WhatsApp e VoIP dependem do protocolo, disponibilidade da conta e ambiente.
- O QR só é exibido para um operador autenticado. Não o compartilhe.
- API de texto individual apenas. Mensagens em massa, filas persistentes e recursos de IA são integrações futuras.
- Para produção utilize rate limiting e proxy/firewall apropriados.

## Diagnóstico de pareamento e reconexão

Após a confirmação no WhatsApp, o serviço pode pedir que o socket reinicie (código `515`). O Gateway reinicia somente o socket dessa sessão, preserva a autenticação em memória e aguarda a abertura da conexão. Falhas de rede são tentadas novamente com intervalos crescentes; erros definitivos, como sessão desvinculada (`401`) e conexão substituída (`440`), ficam visíveis como erro e não são repetidos automaticamente. Uma conexão que exceda o limite de tempo deixa de ficar presa em "Conectando".

`GET /v1/sessions` e `GET /v1/sessions/:id` incluem `status`, `lastError`, `disconnectCode`, `reconnectAttempts` e `nextRetryAt`. Os estados possíveis são `connecting`, `waiting_pairing`, `pairing`, `reconnecting`, `open` e `error`. Para tentar novamente uma sessão que parou, envie `POST /v1/sessions` com o mesmo identificador, sem apagar as credenciais.

**Apenas uma instância do Gateway pode usar cada diretório de dados** (por padrão `.stone-gateway`). O processo mantém um lock exclusivo. Não inicie dois `npm run gateway` na mesma pasta em portas diferentes: isso pode causar conflito de sessão. Se o Termux já tiver um Gateway antigo rodando, pare-o com `Ctrl+C` antes de iniciar a versão atualizada. Reinicie sempre com o token original; não compartilhe o token nem o código de pareamento.

Para conferir apenas o estado de uma conexão no mesmo aparelho:

```bash
curl -sS -H "Authorization: Bearer $(cat ~/.stone-token-teste)" http://127.0.0.1:3018/v1/sessions
```

A porta `3018` é a usada no teste do Termux; para a porta padrão, ajuste para `3017`. Evite tentar vincular repetidamente a conta enquanto uma reconexão já estiver em andamento.


## Logs do Gateway e sessões antigas

O modo padrão do Gateway é **warn**: elimina a enxurrada de mensagens informativas de sincronização e histórico no terminal (por exemplo, `histNotification`, `connected to WA` e `opened connection to WA`), **sem parar a sincronização real**. Alertas e erros continuam visíveis. Isso afeta apenas o processo do Gateway: bots existentes que utilizam a biblioteca continuam com suas próprias configurações de log.

Para consultar os logs detalhados quando estiver diagnosticando um problema, use `STONE_GATEWAY_LOG_LEVEL=info` ou `STONE_GATEWAY_LOG_LEVEL=debug` ao executar `npm run gateway`. Evite compartilhar logs brutos: o protocolo pode incluir identificadores e metadados.

Quando uma sessão recebe `401` (desvinculada), o Gateway mantém os arquivos de credenciais, mas registra um marcador local `.stone-relink-required.json` na pasta daquela sessão para **não insistir na restauração inválida nos próximos reinícios**. O marcador não altera `creds.json`. É possível tentar iniciar a sessão manualmente pelo endpoint `POST /v1/sessions`; se a autenticação não for mais válida, crie uma nova sessão e faça novo pareamento. Sessões saudáveis são restauradas normalmente.


## Controles de sessão pelo painel

- `POST /v1/sessions/:id/pause` — **pausa a sessão** e encerra somente seu socket. Não chama `logout`, não apaga `creds.json`, não desconecta a conta permanentemente do WhatsApp. A pausa é registrada localmente e preservada após reiniciar o Gateway.
- `POST /v1/sessions` com `{"id":"identificador-existente"}` — **retoma a sessão pausada** ou repete a tentativa de uma sessão com erro. A autenticação salva é reutilizada, sem novo código caso permaneça válida.

Os estados retornados pela API incluem `paused`; sessões pausadas permanecem listadas após um reinício do Gateway. Para interromper a exposição temporária do Gateway em testes, encerre o Cloudflare Tunnel separadamente; **pausar uma conta não interrompe a API**.

Não existe exclusão definitiva de credenciais pelo painel nesta versão. Para prevenir apagamentos acidentais, o comando de pausa preserva todos os arquivos da conta.


## Eventos recentes do painel (somente em memória)

`GET /v1/activity` — retorna até 30 eventos operacionais recentes, como `open`, `error`, `reconnecting`, `paused`, `sent` e `received`, exigindo o mesmo token Bearer da API. O Gateway mantém no máximo 50 eventos em memória, descartados ao reiniciar. **Não armazena o texto das mensagens, o destino, os códigos de pareamento ou o token no feed.** Os contadores continuam sendo calculados apenas desde o início do processo.
