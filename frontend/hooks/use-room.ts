// hooks/use-room.ts

import { useState, useEffect } from "react"
import { getRoomDetails } from "@/lib/api/rooms"
import type { RoomDetail } from "@/app/types/room"

export function useRoom(roomId: string | undefined) {
  const [room, setRoom] = useState<RoomDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!roomId) {
      setLoading(false)
      setRoom(null)
      return
    }

    // ✅ At this point, TypeScript should know roomId is string
    // But if it still complains, we'll use a const to help TypeScript
    const validRoomId: string = roomId

    async function loadRoom() {
      try {
        setLoading(true)
        const data = await getRoomDetails(validRoomId) // ✅ Use validRoomId
        setRoom(data)
        setError(null)
      } catch (err) {
        console.error("Failed to load room:", err)
        setError(err instanceof Error ? err : new Error("Failed to load room"))
        setRoom(null)
      } finally {
        setLoading(false)
      }
    }

    loadRoom()
  }, [roomId])

  return {
    room,
    loading,
    error,
    refetch: () => {
      if (roomId) {
        // ✅ Same fix here
        const validRoomId: string = roomId
        getRoomDetails(validRoomId).then(setRoom).catch(setError)
      }
    },
  }
}