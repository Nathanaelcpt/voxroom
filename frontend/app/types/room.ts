// types/room.ts

export type Role = "host" | "speaker" | "listener"

export interface Room {
  id: string
  title: string
  is_live: boolean
  listeners: number
}

export interface RoomDetail extends Room {
  participants: Participant[]
}

export interface Participant {
  user_id: string
  username?: string
  role: Role
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
}