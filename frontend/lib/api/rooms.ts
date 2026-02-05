// lib/api/rooms.ts

import type {
  Room,
  RoomDetail,
  CreateRoomRequest,
  CreateRoomResponse,
  JoinRoomResponse,
} from "@/app/types/room"
import { getAccessToken } from "@/lib/auth"
import { getSupabase } from "@/lib/supabase"

const API_URL = process.env.NEXT_PUBLIC_API_URL

/**
 * Fetch all active rooms
 */
export async function getActiveRooms(): Promise<Room[]> {
  const res = await fetch(`${API_URL}/rooms`)

  if (!res.ok) {
    throw new Error("Failed to fetch rooms")
  }

  return res.json()
}

/**
 * Fetch room details by ID
 */
export async function getRoomDetails(roomId: string): Promise<RoomDetail> {
  const res = await fetch(`${API_URL}/rooms/${roomId}`)

  if (!res.ok) {
    throw new Error("Room not found")
  }

  return res.json()
}

/**
 * Create a new room
 */
export async function createRoom(
  data: CreateRoomRequest
): Promise<CreateRoomResponse> {
  const token = await getAccessToken()

  if (!token) {
    throw new Error("Unauthorized")
  }

  const res = await fetch(`${API_URL}/rooms`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || "Failed to create room")
  }

  return res.json()
}

/**
 * Join a room
 */
// lib/api/rooms.ts - UPDATE joinRoom function

/*export async function joinRoom(
  roomId: string, 
  preferredRole?: "speaker" | "listener"  // ✅ ADD THIS
): Promise<JoinRoomResponse> {
  const token = await getAccessToken()

  if (!token) {
    throw new Error("Unauthorized")
  }

  const res = await fetch(`${API_URL}/rooms/${roomId}/join`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",  // ✅ ADD THIS
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({  // ✅ ADD THIS
      preferred_role: preferredRole || "listener"
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || "Failed to join room")
  }

  return res.json()
}*/

export async function joinRoom(roomId: string, as: "speaker" | "listener" = "listener") {
  const supabase = getSupabase()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session?.access_token) {
    throw new Error("Not authenticated")
  }

  const response = await fetch(`${API_URL}/rooms/${roomId}/join?as=${as}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || "Failed to join room")
  }

  return response.json()
}

// ================================
// ADD makeSpeaker FUNCTION (NEW)
// ================================
export async function makeSpeaker(roomId: string, userId: string) {
  const supabase = getSupabase()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session?.access_token) {
    throw new Error("Not authenticated")
  }

  const response = await fetch(`${API_URL}/rooms/${roomId}/make-speaker`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ user_id: userId }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || "Failed to promote user")
  }

  return response.json()
}


/**
 * End a room (host only)
 */
export async function endRoom(roomId: string): Promise<void> {
  const token = await getAccessToken()

  if (!token) {
    throw new Error("Unauthorized")
  }

  const res = await fetch(`${API_URL}/rooms/${roomId}/end`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!res.ok) {
    throw new Error("Failed to end room")
  }
}

/**
 * Invite user to be speaker (host only)
 */
export async function inviteSpeaker(
  roomId: string,
  userId: string
): Promise<void> {
  const token = await getAccessToken()

  if (!token) {
    throw new Error("Unauthorized")
  }

  const res = await fetch(`${API_URL}/rooms/${roomId}/invite-speaker`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ user_id: userId }),
  })

  if (!res.ok) {
    throw new Error("Failed to invite speaker")
  }
}

/**
 * Remove speaker (host only)
 */
export async function removeSpeaker(
  roomId: string,
  userId: string
): Promise<void> {
  const token = await getAccessToken()

  if (!token) {
    throw new Error("Unauthorized")
  }

  const res = await fetch(`${API_URL}/rooms/${roomId}/remove-speaker`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ user_id: userId }),
  })

  if (!res.ok) {
    throw new Error("Failed to remove speaker")
  }
}

export async function getParticipantsWithProfiles(roomId: string) {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/rooms/${roomId}/participants-with-profiles`,
    {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${await getAccessToken()}`,
      },
    }
  )

  if (!response.ok) {
    throw new Error("Failed to fetch participants with profiles")
  }

  return response.json()
}