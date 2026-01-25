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
