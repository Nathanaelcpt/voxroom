"use client"

export const dynamic = "force-dynamic"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function RegisterPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleRegister() {
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-4 rounded-xl border p-6">
        <h1 className="text-xl font-semibold">
          Daftar VoxRoom
        </h1>

        {success ? (
          <p className="text-sm text-green-600">
            Registrasi berhasil. Silakan login.
          </p>
        ) : (
          <>
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            {error && (
              <p className="text-xs text-red-500">
                {error}
              </p>
            )}

            <Button
              className="w-full"
              onClick={handleRegister}
              disabled={loading || !email || !password}
            >
              {loading ? "Loading..." : "Register"}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
