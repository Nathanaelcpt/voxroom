"use client"
export const dynamic = "force-dynamic"

import { Button } from "@/components/ui/button"
import { getSupabase } from "@/lib/supabase"

export default function LoginPage() {
  async function loginWithGoogle() {
    const supabase = getSupabase()

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    })
  }

  return (
    <div className="flex h-screen items-center justify-center">
      <Button onClick={loginWithGoogle}>
        Login dengan Google
      </Button>
    </div>
  )
}
