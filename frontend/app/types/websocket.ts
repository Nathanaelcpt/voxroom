// types/websocket.ts

import type { Role } from "./room.ts"

export type WSMessageType =
  | "role_assigned"
  | "role_updated"
  | "listener_count"
  | "room_ended"
  | "mic_on"
  | "mic_off"
  | "audio"
  | "speaking"
  | "user_joined"
  | "user_left"

export interface WSMessage {
  type: WSMessageType
  room_id?: string
  from?: string
  payload?: any
}

export interface RoleAssignedPayload {
  role: Role
  can_speak: boolean
}

export interface RoleUpdatedPayload {
  user_id: string
  role: Role
  can_speak: boolean
}

export interface ListenerCountPayload {
  count: number
}