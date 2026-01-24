"use client"

import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"

export default function RegisterPage() {
  async function register() {
    await supabase.auth.signUp({
      email: "test@mail.com",
      password: "password123",
    })
  }

  return <Button onClick={register}>Register</Button>
}
