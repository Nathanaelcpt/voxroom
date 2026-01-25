"use client"

import { useEffect, useState } from "react"
import { getSupabase } from "@/lib/supabase"
import type { User } from "@supabase/supabase-js"

export function useUser() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = getSupabase()

    // session awal
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null)
      setLoading(false)
    })

    // realtime auth listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  return { user, loading }
}
