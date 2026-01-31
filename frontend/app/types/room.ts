// app/types/room.ts

export type Role = "host" | "speaker" | "listener"

export interface Room {
  id: string
  title: string
  is_live: boolean
  listeners: number
}

export interface Participant {
  user_id: string
  role: Role
  // ✅ Extended user info
  email?: string
  username?: string
  avatar_url?: string
  full_name?: string
}

export interface RoomDetail {
  id: string
  title: string
  is_live: boolean
  listeners: number
  participants: Participant[]
}

export interface CreateRoomRequest {
  title: string
}

export interface CreateRoomResponse {
  room_id: string
}

export interface JoinRoomResponse {
  status: string
  room_id: string
  role?: string
}
