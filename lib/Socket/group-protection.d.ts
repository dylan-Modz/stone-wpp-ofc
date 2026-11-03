export type GroupProtectionMode = 'alert' | 'delete' | 'remove' | 'protect'

export interface GroupProtectionOptions {
  /** Desativada por padrão; chamar com {enabled: true} para ativar. */
  enabled?: boolean
  /** alert: apenas eventos. delete: apaga; remove: apaga + remove membro; protect: fecha temporariamente + apaga + remove. */
  mode?: GroupProtectionMode
  /** Mínimo de mensagens de pagamento do mesmo remetente por janela (padrão: 3). */
  paymentBurst?: number
  /** Mínimo de mensagens totais por janela (padrão: 14). */
  messageBurst?: number
  /** Janela de detecção em milissegundos (padrão: 8000). */
  windowMs?: number
  /** Tempo de fechamento temporário no modo protect (padrão: 12000). */
  lockMs?: number
  observeInvisible?: boolean
  observePayments?: boolean
  observeQuotes?: boolean
  observeFlood?: boolean
  /** Se true, publica um aviso do bot e edita o aviso ao concluir as ações. */
  editNotice?: boolean
  /** Até três sockets adicionais já autenticados e presentes nos grupos. */
  monitors?: Array<{ ev: any }>
}

export interface GroupProtectionStatus {
  jid: string
  enabled: boolean
  mode?: GroupProtectionMode
  paymentBurst?: number
  messageBurst?: number
  windowMs?: number
  lockMs?: number
  observeInvisible?: boolean
  observePayments?: boolean
  observeQuotes?: boolean
  observeFlood?: boolean
  monitorCount: number
  alerts: number
  actions: number
}

export interface GroupProtectionAlert {
  jid: string
  participant: string
  messageId: string
  reason: 'payment' | 'flood' | 'invisible-suspected' | 'quoted-payment'
  severity: 'low' | 'medium' | 'high'
  verified: boolean
  source: string
  evidence: Record<string, unknown>
  mode: GroupProtectionMode
  receivedAt: number
}

export interface GroupProtectionAction {
  jid: string
  participant?: string
  messageId?: string
  action?: 'reopen'
  attemptedMode?: GroupProtectionMode
  deleted?: boolean
  removed?: boolean
  locked?: boolean
  ok?: boolean
  error?: string
  deleteError?: string
  removeError?: string
  lockError?: string
}

export interface GroupProtectionMethods {
  /** Configura, consulta ou desativa proteção de um grupo. Configurações são por sessão e não são persistidas. */
  groupProtection(jid: string, options?: GroupProtectionOptions): Promise<GroupProtectionStatus>
}

export declare function createGroupProtectionMethods(socket: unknown): GroupProtectionMethods
