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
