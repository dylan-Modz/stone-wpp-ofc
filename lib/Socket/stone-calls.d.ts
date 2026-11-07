export type StoneCallParticipant = string | { jid: string; devices?: string[] }
export interface StoneCallInfo {
  callId: string
  isGroupCall?: boolean
  groupJid?: string
  peerJid?: string
  canAccept?: boolean
  stateData?: { state?: string; endReason?: string }
}
export interface StoneCallConnectionOptions {
  /** Arquivo SQLite EXCLUSIVO da sessão de chamadas. Nunca a sessão principal da Stone. */
  authPath: string
  sessionId?: string
  maxConcurrentCalls?: number
  logLevel?: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace'
  autoAccept?: boolean
  driver?: 'auto' | 'node' | 'better-sqlite3'
}
export interface StoneCalls {
  on(event: string, handler: (...args: any[]) => void): StoneCalls
  off(event: string, handler: (...args: any[]) => void): StoneCalls
  once(event: string, handler: (...args: any[]) => void): StoneCalls
  connect(options: StoneCallConnectionOptions): Promise<{ connected: true; sessionId: string }>
  disconnect(): Promise<void>
  startCall(peerJid: string, options?: { isVideo?: boolean }): Promise<string>
  startCall(options: { peerJid: string; isVideo?: boolean } | { groupJid: string; participants: StoneCallParticipant[]; isVideo?: boolean }): Promise<string>
  startGroupCall(groupJid: string, participants: StoneCallParticipant[], options?: { isVideo?: boolean }): Promise<string>
  acceptCall(callId: string): Promise<void>
  rejectCall(callId: string): Promise<void>
  joinCall(callId: string): Promise<void>
  leaveCall(callId: string): Promise<void>
  endCall(callId: string): Promise<void>
  getCall(callId: string): StoneCallInfo | null
  getCalls(): readonly StoneCallInfo[]
  setMute(callId: string, muted: boolean): void
  /** Carrega o arquivo de áudio informado para a chamada; não se limita a músicas. */
  loadAudio(callId: string, path: string, options?: { timeoutMs?: number }): Promise<void>
  /** Atalho de compatibilidade para loadAudio. */
  playAudio(callId: string, path: string, options?: { timeoutMs?: number }): Promise<void>
  setExternalAudioMode(callId: string, enabled?: boolean): void
  feedLiveAudio(callId: string, pcmChunk: Float32Array): number
  getLiveBufferMs(callId: string): number
  getFeedWatermarksMs(): { pauseMs: number; resumeMs: number }
}
export declare function createStoneCalls(options?: { engineLoader?: () => Promise<any> }): StoneCalls
