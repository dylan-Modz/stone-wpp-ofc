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

## Terminal ao vivo do Stone Studio

O Gateway fornece `GET /v1/console?since=0` (exige token Bearer). A resposta contém `entries`, `cursor` e `retentionMinutes`; chamadas posteriores usam `since=<cursor>` para receber somente as novas linhas. Cada entrada inclui direção (`recebida`, `enviada`, `sistema`), tipo (`texto`, `imagem`, `vídeo`, `áudio`, `figurinha`, `documento` etc.), sessão, horário e identificador de conversa **mascarado**.

**Privacidade:** prévias de texto e legendas **não são enviadas por padrão**. Somente o pedido explícito `GET /v1/console?since=0&preview=1` inclui `preview` (até 4.096 caracteres). No painel, a pessoa precisa ativar **Mostrar prévias de mensagens**. O Gateway armazena texto recente **somente em RAM**, até 80 linhas por até 15 minutos: use com token privado, HTTPS e dispositivo de confiança. As entradas não são persistidas e somem ao reiniciar. Nenhuma mídia é baixada automaticamente. Apenas mídias normais, recentes e compatíveis podem ser abertas sob demanda em uma rota autenticada.

O terminal recebe mensagens novas via `messages.upsert` e confirmações de envio pela API; ignora a sincronização de histórico (`type: append`) para evitar flood de conversas antigas. Um envio aceito pelo socket não significa entrega ou leitura. O painel consulta eventos a cada 2,5 segundos enquanto está aberto.

Se a interface for atualizada antes do Gateway, ela usa o endpoint legado `/v1/activity` como modo de compatibilidade, sem prévia ou classificação de mídia. Atualize o Gateway para habilitar tudo.


## Contato e conteúdo no terminal (correção de LID)

O terminal exibe **nome do contato** (quando recebido em `pushName` ou nos eventos de contatos), o número em formato mascarado e, em linhas separadas, a **direção**, o **tipo** e o **conteúdo textual** da mensagem. Um identificador WhatsApp `@lid` não é número de telefone e nunca é exibido como se fosse. Quando o evento fornecer `remoteJidAlt` / `participantAlt` com identificador telefônico, ele é usado para resolver o número. Se não houver nome nem PN disponível, o painel indica apenas `Contato` ou `Participante do grupo`, sem inventar informações.

O conteúdo de texto ou a legenda de imagem/vídeo (até 4096 caracteres) e o **número completo** só são retornados após ativar a opção de prévias no painel. O tipo de áudio, figurinha, vídeo e outras mídias aparece mesmo sem prévia. O arquivo só é baixado se o usuário clicar explicitamente em **Ver / baixar mídia**.

## Webhooks inválidos e avisos HTTP 401/403

Se o destinatário do webhook responder `401` ou `403`, o Gateway **suspende automaticamente as entregas**, mas **mantém URL, eventos e chave HMAC salvos** em `.stone-gateway/gateway-webhook.json`. O estado passa a `enabled: false` e `disabledReason` explica o erro. O Termux mostra apenas um aviso. Corrija o endpoint receptor e salve a configuração novamente para reativar as entregas. O motivo pode ser visto na configuração `GET /v1/webhook` pelo campo `disabledReason`. Outros erros de conexão são exibidos no máximo uma vez por minuto para evitar flood de logs. Para reativar, configure uma URL HTTPS **do sistema receptor de verdade**, não a própria URL pública do Gateway, e ajuste a autenticação do receptor.


## Prévia e download de mídia do terminal (opcional)

O terminal exibe **IMAGEM**, **VÍDEO**, **GIF**, **ÁUDIO**, **VOZ**, **FIGURINHA** ou **DOCUMENTO** sem carregar o arquivo. Quando o painel estiver conectado e a pessoa ativar a opção de prévias, mídias recentes compatíveis apresentam o botão **Ver / baixar mídia**. O botão faz uma única solicitação autenticada em `GET /v1/console/media/:seq` (o `:seq` vem de `GET /v1/console`). O Gateway só então decripta a mídia que a Stone recebeu do WhatsApp e retorna os bytes no formato seguro correspondente. Fotos abrem em uma janela, vídeos e áudios usam controles nativos e documentos são oferecidos para download.

Por segurança: apenas arquivos de **até 20 MB**, até **15 minutos após a mensagem** (e enquanto a referência continuar em memória), são elegíveis. Nenhum arquivo é salvo no disco pelo Gateway ou no histórico do painel; a janela libera a URL temporária ao fechar. Nunca disponibilizamos mídias de **visualização única**, mensagens efêmeras embrulhadas ou históricos antigos por esse caminho. Destinos, tokens, URLs da mídia e chaves de decriptação não são incluídos nos eventos retornados ao navegador. A API exige o mesmo token Bearer das demais rotas e retorna `Cache-Control: no-store`.

Se a mídia já tiver expirado, não tiver mais disponibilidade no WhatsApp ou exceder o limite, o painel mostra um aviso, mantendo o tipo de conteúdo no terminal. O botão não significa que a mídia foi armazenada ou que sempre pode ser recuperada.


### Salvamento de webhook e confirmação

O botão **Salvar alterações** do Stone Studio usa `PUT /v1/webhook` e faz `GET /v1/webhook` em seguida para confirmar que URL, eventos e assinatura foram realmente gravados. O destino deve ser um **endpoint HTTPS receptor** separado do próprio endereço do Gateway. A chave configurada como HMAC gera o cabeçalho `X-Stone-Signature`; **ela não fornece automaticamente um cabeçalho Authorization ou Bearer** ao sistema de destino. Se esse sistema exigir outra autenticação, configure o receptor para validar a assinatura ou prover um endpoint compatível.

O Gateway registra os webhooks no disco e serializa as gravações, impedindo que um erro `401` atrasado sobrescreva uma configuração recém-salva. Se o receptor rejeitar uma notificação, a URL permanece salva, mas o envio é suspenso até um novo salvamento; isso evita tentativas em loop e perda de campos. O painel consulta periodicamente o estado e mostra o problema no próprio formulário.
