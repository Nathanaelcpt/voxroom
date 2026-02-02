// hooks/use-presence.ts - TypeScript strict mode compatible

import { useEffect, useRef } from "react"
import { useUser } from "./use-user"
import { getSupabase } from "@/lib/supabase"

interface UsePresenceOptions {
  roomId?: string
}

export function usePresence({ roomId }: UsePresenceOptions = {}) {
  const { user } = useUser()
  const hasSetPresence = useRef(false)

  useEffect(() => {
    if (!user) return
    
    // Prevent duplicate calls
    if (hasSetPresence.current) return
    hasSetPresence.current = true

    // Set online when component mounts
    async function setOnline() {
      try {
        const supabase = getSupabase()
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session?.access_token) return

        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/presence/online`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            room_id: roomId ?? null,
          }),
        })

        if (response.ok) {
          console.log("✅ Presence: Online", roomId ? `(room: ${roomId.slice(0, 8)}...)` : "")
        }
      } catch (error) {
        console.error("Failed to update presence:", error)
      }
    }

    setOnline()

    // Set offline when page closes (not when component unmounts)
    const handleBeforeUnload = () => {
      const supabase = getSupabase()
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session?.access_token) return

        // Use sendBeacon for reliability during page close
        navigator.sendBeacon(
          `${process.env.NEXT_PUBLIC_API_URL}/presence/offline`,
          new Blob([JSON.stringify({})], { type: "application/json" })
        )
      })
    }

    window.addEventListener("beforeunload", handleBeforeUnload)

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
      hasSetPresence.current = false
    }
  }, [user, roomId])

  // Separate effect for room changes (only when roomId is defined)
  useEffect(() => {
    if (!user || !roomId) return

    // Skip initial mount (already handled above)
    if (!hasSetPresence.current) return

    // ✅ Capture roomId in const to satisfy TypeScript
    const currentRoomId = roomId

    async function updateRoom() {
      try {
        const supabase = getSupabase()
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session?.access_token) return

        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/presence/online`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            room_id: currentRoomId,
          }),
        })

        console.log("🔄 Presence: Updated room", currentRoomId.slice(0, 8))
      } catch (error) {
        // Silently fail
      }
    }

    updateRoom()
  }, [user, roomId])
}
