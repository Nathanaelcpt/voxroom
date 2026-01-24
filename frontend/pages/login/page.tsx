"use client"

import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"

export default function LoginPage() {
  async function loginWithGoogle() {
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
