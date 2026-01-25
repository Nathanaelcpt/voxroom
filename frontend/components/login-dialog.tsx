"use client"

import { useState } from "react"
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

export function LoginDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [step, setStep] = useState<"email" | "password">("email")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleContinue() {
    const supabase = getSupabase() // ✅ PINDAH KE SINI
    setError(null)

    if (step === "email") {
      if (!email) return
      setStep("password")
      return
    }

    setLoading(true)

    const { error: signInError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      })

    if (signInError) {
      const { error: signUpError } =
        await supabase.auth.signUp({
          email,
          password,
        })

      if (signUpError) {
        setError(signUpError.message)
        setLoading(false)
        return
      }
    }

    const { data } = await supabase.auth.getUser()
    const user = data.user

    if (user) {
      await supabase
        .from("users")
        .upsert({
          id: user.id,
          email: user.email,
          display_name:
            user.user_metadata?.full_name ?? user.email,
          avatar_url: user.user_metadata?.avatar_url,
        } as any)
    }

    setLoading(false)
    onOpenChange(false)
    window.location.reload()
  }

  async function loginWithGoogle() {
    const supabase = getSupabase() // ✅ DI DALAM EVENT
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-none bg-transparent shadow-none">
        <DialogTitle className="sr-only">
          Login VoxRoom
        </DialogTitle>

        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-lg">
              Masuk ke VoxRoom
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {step === "email" ? (
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            ) : (
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}

            {error && (
              <p className="text-xs text-red-500">{error}</p>
            )}

            <Button
              className="w-full"
              onClick={handleContinue}
              disabled={loading || (step === "email" && !email)}
            >
              Continue
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
            >
              Login with Google
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Belum punya akun?{" "}
              <a
                href="/register"
                className="underline font-medium hover:text-primary"
              >
                Daftar sekarang
              </a>
            </p>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  )
}
