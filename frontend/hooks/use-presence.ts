// hooks/use-presence.ts - Real-time presence tracker

import { useEffect } from "react"
import { useUser } from "./use-user"
import { getSupabase } from "@/lib/supabase"

interface UsePresenceOptions {
  roomId?: string
}

export function usePresence({ roomId }: UsePresenceOptions = {}) {
  const { user } = useUser()

  useEffect(() => {
    if (!user) return

    // Update presence to online when component mounts
    async function setOnline() {
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
            room_id: roomId || null,
          }),
        })

        console.log("✅ Presence: Online", roomId ? `in room ${roomId}` : "")
      } catch (error) {
        console.error("Failed to update presence:", error)
      }
    }

    // Update presence to offline when component unmounts
    async function setOffline() {
      try {
        const supabase = getSupabase()
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session?.access_token) return

        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/presence/offline`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
        })

        console.log("✅ Presence: Offline")
      } catch (error) {
        console.error("Failed to update presence:", error)
      }
    }

    setOnline()

    // Set offline on unmount or page close
    return () => {
      setOffline()
    }
  }, [user, roomId])

  // Also update on visibility change
  useEffect(() => {
    if (!user) return

    function handleVisibilityChange() {
      if (document.hidden) {
        // Page hidden - user might be away
        console.log("👁️ Page hidden")
      } else {
        // Page visible again
        console.log("👁️ Page visible")
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [user])
}
