export interface ChatMessage {
  id: string
  type: "chat" | "event" | "system"
  username: string
  content: string
  timestamp: Date
  avatar_url?: string
  role?: "host" | "speaker" | "listener"
  user_id?: string
  event_type?:
    | "join"
    | "leave"
    | "speaker_invited"
    | "mic_on"
    | "mic_off"
}
