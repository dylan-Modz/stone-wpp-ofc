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
  startCall: false
  acceptCall: false
  joinCall: false
  liveAudio: false
  audioFiles: false
  videoMedia: false
}
export interface StoneCalls {
  on(event: StoneCallEvent, handler: (call: StoneCallInfo) => void): StoneCalls
  once(event: StoneCallEvent, handler: (call: StoneCallInfo) => void): StoneCalls
  off(event: StoneCallEvent, handler: (call: StoneCallInfo) => void): StoneCalls
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
  /** Ainda indisponível no motor nativo: requer negociação VoIP e transporte de mídia. */
  startCall(...args: any[]): never
  startGroupCall(...args: any[]): never
  acceptCall(...args: any[]): never
  joinCall(...args: any[]): never
  leaveCall(...args: any[]): never
  endCall(...args: any[]): never
  loadAudio(...args: any[]): never
  playAudio(...args: any[]): never
  setExternalAudioMode(...args: any[]): never
  feedLiveAudio(...args: any[]): never
  getLiveBufferMs(...args: any[]): never
  getFeedWatermarksMs(...args: any[]): never
  setMute(...args: any[]): never
  destroy(): void
}
export declare function createStoneCalls(socket: {
  ev: { on(event: 'call', handler: (calls: any) => void): any; off(event: 'call', handler: (calls: any) => void): any }
  rejectCall(callId: string, from: string): Promise<void>
  sendNode?: (node: any) => Promise<void>
  createCallLink(type: 'audio' | 'video', event?: { startTime: number }, timeoutMs?: number): Promise<string | undefined>
  sendGroupCallInvite?: (jid: string, options?: { type?: 'audio' | 'video'; text?: string }) => Promise<any>
}): StoneCalls
