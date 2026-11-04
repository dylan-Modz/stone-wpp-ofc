export type GroupProtectionMode = 'alert' | 'delete' | 'remove' | 'protect'

/** Persistência opcional: utilize createStoneStore({ type: 'json' | 'sqlite', path }). */
export interface GroupProtectionStore {
  get<T = unknown>(key: string): Promise<T | undefined>
  set(key: string, value: unknown): Promise<boolean>
}

export interface GroupProtectionHistoryEntry {
  type: 'alert' | 'action'
  jid: string
  participant: string | null
  reason: string | null
  severity: string | null
  action: string | null
  mode: string | null
  deleted: boolean
  removed: boolean
  locked: boolean
  receivedAt: number
}

export interface GroupProtectionMonitor {
  ev: {
    on(name: string, fn: (...args: any[]) => void): unknown
    off(name: string, fn: (...args: any[]) => void): unknown
  }
}

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
  monitors?: GroupProtectionMonitor[]
  /** Factories de até 3 sessões extras já autenticadas; reconecta em queda temporária.
   *  O próprio aplicativo deve criar os sockets e persistir as credenciais.
   *  Logout não causa novo pareamento automático. */
  monitorFactories?: Array<(args: { jid: string; attempt: number }) => Promise<GroupProtectionMonitor>>
  monitorReconnectMs?: number
  /** Recibos de retry são tratados apenas como telemetria, nunca prova de ataque. */
  observeReceipts?: boolean
  receiptBurst?: number
  /** JIDs imunes a remoção (PN e LID são comparados separadamente). */
  immunity?: string[]
  /** Limite de registros mantidos por grupo, entre 20 e 500. */
  historyLimit?: number
  /** StoneStore opcional para persistir regras e histórico. */
  store?: GroupProtectionStore
  /** Restaura regras previamente salvas no store; requer store. */
  restore?: boolean
  /** Consulta o histórico sem modificar as configurações; requer store ou ativação prévia. */
  getHistory?: boolean
  /** Limita linhas retornadas na consulta de histórico. */
  limit?: number
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
  observeReceipts?: boolean
  receiptBurst?: number
  immunity?: string[]
  historyLimit?: number
  history?: GroupProtectionHistoryEntry[]
  restored?: boolean
  monitorCount: number
  alerts: number
  actions: number
}

export interface GroupProtectionAlert {
  jid: string
  participant: string
  messageId: string
  reason: 'payment' | 'flood' | 'invisible-suspected' | 'quoted-payment' | 'receipt-suspected'
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
  noticeEdited?: boolean
  noticeError?: string
  noticeEditError?: string
}

export interface GroupProtectionMethods {
  /** Configura, consulta, restaura, desativa ou consulta histórico por grupo.
   * Persistência exige store explícito; login de monitores exige autenticação prévia. */
  groupProtection(jid: string, options?: GroupProtectionOptions): Promise<GroupProtectionStatus>
}

export declare function createGroupProtectionMethods(socket: unknown): GroupProtectionMethods
