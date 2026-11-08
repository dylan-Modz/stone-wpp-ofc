export type StoneCallEvent = 'incoming' | 'state' | 'ended'
export interface StoneCallInfo {
  callId: string
  id: string
  status: string
  chatId: string | null
  peerJid: string | null
  from: string | null
  groupJid: string | null
  callerPn: string | null
  callCreator: string | null
  sourceJid: string | null
  stanzaId: string | null
  joinable: boolean
  reRing: boolean
  latencyMs: number | null
  isGroupCall: boolean
  isVideo: boolean
  date: Date
  stateData: { state: string; endReason?: string }
}
export interface StoneCallCapabilities {
  sharedSocket: true
  incomingEvents: true
  rejectIncomingCall: true
  groupCallReject: boolean
  incomingMetadata: true
  callLinks: true
  groupCallInvites: boolean
  startCall: boolean
  acceptCall: boolean
  joinCall: boolean
  liveAudio: boolean
  audioFiles: boolean
  videoMedia: boolean
}
export interface StoneCalls {
  on(event: StoneCallEvent, handler: (call: StoneCallInfo) => void): StoneCalls
  once(event: StoneCallEvent, handler: (call: StoneCallInfo) => void): StoneCalls
  off(event: StoneCallEvent, handler: (call: StoneCallInfo) => void): StoneCalls
  enableVoip(options?: { maxConcurrentCalls?: number; useRawUdpTransport?: boolean; logLevel?: string }): Promise<StoneCallCapabilities>
  getVoipStatus(): { initialized: boolean; initializing: boolean; error: { code: string; message: string } | null }
  getCapabilities(): StoneCallCapabilities
  getCall(callId: string): StoneCallInfo | null
  getCalls(): StoneCallInfo[]
  rejectCall(callId: string): Promise<void>
  createCallLink(type?: 'audio' | 'video', event?: { startTime: number }, timeoutMs?: number): Promise<string | undefined>
  sendGroupCallInvite(groupJid: string, options?: { type?: 'audio' | 'video'; text?: string }): Promise<{
    groupJid: string
    type: 'audio' | 'video'
    url: string
    message: import('../Types/index.js').WAMessage
  }>
  /** Disponíveis SOMENTE depois de enableVoip() concluir com o motor de mídia carregado. */
  startCall(options: { peerJid?: string; groupJid?: string; participants?: Array<{ jid: string; devices?: string[] }>; isVideo?: boolean; audioFile?: string }): Promise<string>
  startGroupCall(options: { groupJid: string; participants: Array<{ jid: string; devices?: string[] }>; isVideo?: boolean; audioFile?: string }): Promise<string>
  acceptCall(callId: string): Promise<void>
  joinCall(callId: string): Promise<void>
  leaveCall(callId: string): Promise<void>
  endCall(callId: string): Promise<void>
  loadAudio(callId: string, file: string): Promise<void>
  playAudio(...args: any[]): never
  setExternalAudioMode(callId: string, enabled: boolean): void
  feedLiveAudio(callId: string, samples: Float32Array): number
  getLiveBufferMs(callId: string): number
  getFeedWatermarksMs(callId: string): unknown
  setMute(callId: string, muted: boolean): void
  destroy(): void
}
export declare function createStoneCalls(socket: {
  ev: { on(event: string, handler: (event: any) => void): any; off(event: string, handler: (event: any) => void): any }
  rejectCall(callId: string, from: string): Promise<void>
  sendNode?: (node: any) => Promise<void>
  createCallLink(type: 'audio' | 'video', event?: { startTime: number }, timeoutMs?: number): Promise<string | undefined>
  sendGroupCallInvite?: (jid: string, options?: { type?: 'audio' | 'video'; text?: string }) => Promise<any>
}): StoneCalls
