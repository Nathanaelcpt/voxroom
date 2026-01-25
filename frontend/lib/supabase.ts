import { createClient } from "@supabase/supabase-js"

let client: ReturnType<typeof createClient> | null = null

export function getSupabase() {
  if (typeof window === "undefined") {
    throw new Error("Supabase can only be used in the browser")
  }

  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!url || !key) {
      throw new Error("Supabase env not set")
    }

    client = createClient(url, key)
  }

  return client
}
