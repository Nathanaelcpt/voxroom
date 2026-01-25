"use client"

import { useEffect, useState } from "react"
import { getSupabase } from "@/lib/supabase"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

type Mode = "login" | "register"

export function AuthDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [mode, setMode] = useState<Mode>("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // reset state tiap dialog ditutup
  useEffect(() => {
    if (!open) {
      setMode("login")
      setEmail("")
      setPassword("")
      setError(null)
      setLoading(false)
    }
  }, [open])

  async function submit() {
    if (loading) return

    const supabase = getSupabase()
    setError(null)
    setLoading(true)

    const { error } =
      mode === "login"
        ? await supabase.auth.signInWithPassword({
            email,
            password,
          })
        : await supabase.auth.signUp({
            email,
            password,
          })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setLoading(false)
    onOpenChange(false)
    // ❌ tidak reload — useUser yang handle
  }

  async function loginWithGoogle() {
    const supabase = getSupabase()
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-none bg-transparent shadow-none">
        <DialogTitle className="sr-only">
          Auth VoxRoom
        </DialogTitle>

        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-lg">
              {mode === "login"
                ? "Masuk ke VoxRoom"
                : "Daftar VoxRoom"}
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />

            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />

            {error && (
              <p className="text-xs text-red-500">{error}</p>
            )}

            <Button
              className="w-full"
              onClick={submit}
              disabled={loading || !email || !password}
            >
              {loading
                ? "Loading..."
                : mode === "login"
                ? "Masuk"
                : "Daftar"}
            </Button>

            <div className="flex items-center gap-2">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">
                or
              </span>
              <Separator className="flex-1" />
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={loginWithGoogle}
              disabled={loading}
            >
              Continue with Google
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              {mode === "login" ? (
                <>
                  Belum punya akun?{" "}
                  <button
                    type="button"
                    className="underline font-medium"
                    onClick={() => setMode("register")}
                  >
                    Daftar
                  </button>
                </>
              ) : (
                <>
                  Sudah punya akun?{" "}
                  <button
                    type="button"
                    className="underline font-medium"
                    onClick={() => setMode("login")}
                  >
                    Masuk
                  </button>
                </>
              )}
            </p>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  )
}
