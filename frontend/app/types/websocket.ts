// app/types/websocket.ts

export type WSMessageType =
  | "role_assigned"
  | "role_updated"
  | "listener_count"
  | "room_ended"
  | "mic_on"
  | "mic_off"
  | "audio"        // ✅ Audio chunk data
  | "speaking"     // ✅ Speaking indicator

export interface WSMessage {
  type: WSMessageType
  room_id?: string
  from?: string
  payload?: any
}

// Specific message payloads for type safety
export interface RoleAssignedPayload {
  role: "host" | "speaker" | "listener"
  can_speak: boolean
}

export interface RoleUpdatedPayload {
  user_id: string
  role: "host" | "speaker" | "listener"
}

export interface ListenerCountPayload {
  count: number
}

export interface AudioPayload {
  user_id: string
  chunk: string  // Base64 encoded audio data
}

export interface SpeakingPayload {
  user_id: string
  is_speaking: boolean
}
