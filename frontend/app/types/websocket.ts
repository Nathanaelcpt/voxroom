// app/types/websocket.ts - UPDATED with Chat Types
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
  | "user_joined"      // ✅ NEW
  | "user_left"        // ✅ NEW
  | "chat"             // ✅ NEW
  | "speaker_invited"  // ✅ NEW (optional, for future use)

export interface WSMessage {
  type: WSMessageType
  payload?: {
    // Audio
    chunk?: string
    
    // Role management
    role?: "host" | "speaker" | "listener"
    user_id?: string
    username?: string
    can_speak?: boolean
    
    // Speaking status
    is_speaking?: boolean
    
    // Listener count
    count?: number
    
    // Room state
    participants?: Array<{
      user_id: string
      username?: string
      role: string
      can_speak: boolean
    }>
    total?: number
    
    // ✅ NEW: Chat message
    content?: string
    avatar_url?: string
    message_id?: string
    timestamp?: string | number
    
    // ✅ NEW: Join/Leave events
    event_type?: "join" | "leave" | "speaker_invited" | "mic_on" | "mic_off"
    
    // Any other data
    [key: string]: any
  }
  from?: string
  room_id?: string
}
