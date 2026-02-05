export type WSMessageType =
  | "audio"
  | "mic_on"
  | "mic_off"
  | "speaking"
  | "role_assigned"
  | "role_updated"
  | "listener_count"
  | "room_state"
  | "room_ended"
  | "user_joined"
  | "user_left"
  | "chat"
  | "speaker_invited"

export interface WSMessage {
  type: WSMessageType

  /** metadata */
  from?: string
  room_id?: string

  /** 🔊 AUDIO STREAM (binary / chunk) */
  payload?: {
    chunk?: string
    [key: string]: any
  }

  /** 💬 CHAT / EVENT / ROLE / PRESENCE */
  data?: {
    // common
    user_id?: string
    username?: string
    role?: "host" | "speaker" | "listener"
    avatar_url?: string

    // chat
    content?: string
    message_id?: string
    timestamp?: string | number

    // speaking / mic
    is_speaking?: boolean
    can_speak?: boolean

    // listener count
    count?: number

    // room state
    participants?: Array<{
      user_id: string
      username?: string
      role: string
      can_speak: boolean
    }>
    total?: number

    // events
    event_type?: "join" | "leave" | "speaker_invited" | "mic_on" | "mic_off"

    [key: string]: any
  }
}
