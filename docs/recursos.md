# Recursos da Stone WPP 1.0.0

## Implementado

- Namespace `socket.stone` associado à conexão existente.
- Canais: informações, mensagens, seguidores, reações, seguir e deixar, além de busca e estatísticas **locais**.
- Grupos: permissões, aprovação de solicitações e histórico **local e voluntário**.
- Bots: listagem quando disponível no cliente, envio e escuta de eventos.
- Listas: organização em memória de destinatários com consentimento, envio direto controlado.
- Chamadas: criação de tokens para links de áudio/vídeo e rejeição quando suportada pelo socket.
- Store: memória, JSON atômico e SQLite opcional.
- Plugins: instalação, remoção e limpeza.
- Tipos e testes unitários.

## Não implementado nesta versão

- Busca remota de canais e métricas avançadas privadas do servidor.
- Recuperar votantes/remetentes sem dados do serviço.
- Compartilhamento de histórico antigo de grupos com membros novos via protocolo.
- Listas de transmissão nativas do serviço.
- Chamada de voz/vídeo com mídia em tempo real (VoIP completo).
- Modo de conexão como cliente móvel principal.
- Adaptadores prontos para Redis, MySQL, PostgreSQL e MongoDB.
- Respostas de bots transmitidas em fluxo por protocolo específico.

Esses itens exigem pesquisa de protocolo, implementação independente e testes reais. Não foram simulados como funcionalidades prontas.

Veja as pastas de documentação de cada área para exemplos.
