import type { StoneStore } from '../Store/index.js';
import type { StonePluginManager } from '../Plugins/index.js';

export interface StoneFeatures {
    readonly store: StoneStore;
    readonly plugins: StonePluginManager;
    readonly canais: {
        informacoes(chave: string, tipo?: string): Promise<unknown>;
        mensagens(jid: string, quantidade?: number, desde?: number, depois?: number): Promise<unknown>;
        seguidores(jid: string): Promise<unknown>;
        reagir(jid: string, id: string, emoji: string): Promise<unknown>;
        seguir(jid: string): Promise<unknown>;
        deixar(jid: string): Promise<unknown>;
        buscarLocal(canais: unknown[], termo: string, options?: { limite?: number }): unknown[];
        estatisticasLocais(mensagens?: unknown[]): { mensagens: number; visualizacoes: number; reacoes: number; enquetes: number; taxaDeReacao: number };
        resumirReacoes(reacoes?: unknown[]): Record<string, number>;
        resumirEnquete(enquete: unknown): unknown;
    };
    readonly grupos: {
        permissoes: {
            somenteAdminsEnviam(jid: string, ativar?: boolean): Promise<unknown>;
            somenteAdminsEditam(jid: string, ativar?: boolean): Promise<unknown>;
            aprovarEntrada(jid: string, ativar?: boolean): Promise<unknown>;
            permitirAdicaoPorMembros(jid: string, ativar?: boolean): Promise<unknown>;
            solicitacoes(jid: string): Promise<unknown>;
            decidirSolicitacoes(jid: string, jids: string[], acao: 'approve' | 'reject'): Promise<unknown>;
        };
        historico: {
            salvar(jid: string, mensagem: unknown, limite?: number): Promise<number>;
            listar(jid: string, limite?: number): Promise<unknown[]>;
            apagar(jid: string): Promise<boolean>;
        };
    };
    readonly bots: {
        listar(): Promise<unknown>;
        enviar(jid: string, mensagem: unknown, opcoes?: unknown): Promise<unknown>;
        escutar(jid: string, callback: (mensagem: unknown) => void): () => void;
    };
    readonly listas: {
        criar(nome: string, pessoas?: Array<{jid: string; consentimento: true}>): number;
        adicionar(nome: string, pessoa: {jid: string; consentimento: true}): number;
        remover(nome: string, jid: string): boolean;
        listar(): Array<{nome: string; quantidade: number}>;
        destinatarios(nome: string): string[];
        apagar(nome: string): boolean;
        enviar(nome: string, conteudo: unknown, opcoes?: { pausaMs?: number }): Promise<Array<{jid: string; enviado: boolean; erro?: string; id?: string}>>;
    };
    readonly chamadas: {
        linkAudio(evento?: unknown, timeoutMs?: number): Promise<string | undefined>;
        linkVideo(evento?: unknown, timeoutMs?: number): Promise<string | undefined>;
        rejeitar(id: string, remetente: string): Promise<unknown>;
    };
}
export declare function criarRecursosCanais(socket: unknown): StoneFeatures['canais'];
export declare function criarRecursosGrupos(socket: unknown, store: StoneStore): StoneFeatures['grupos'];
export declare function criarRecursosBots(socket: unknown): StoneFeatures['bots'];
export declare function criarListasTransmissao(socket: unknown): StoneFeatures['listas'];
export declare function criarRecursosChamadas(socket: unknown): StoneFeatures['chamadas'];
