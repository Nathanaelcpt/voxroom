import { getSupabase } from "./supabase"

export async function loginWithGoogle() {
  const supabase = getSupabase()

  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin,
    },
  })
}

export async function getAccessToken() {
  const supabase = getSupabase()
  const { data, error } = await supabase.auth.getSession()

  if (error) {
    console.error("getSession error:", error)
    return null
  }

  return data.session?.access_token ?? null
}
