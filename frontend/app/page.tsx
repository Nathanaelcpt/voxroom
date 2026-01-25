"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { LoginDialog } from "@/components/login-dialog"
import { getSupabase } from "@/lib/supabase"

const rooms = ["andi", "budi", "charlie"]

export default function HomePage() {
  const [open, setOpen] = useState(false)

  // 🔥 INI KUNCI: sync user setelah login Google redirect
  useEffect(() => {
  async function syncUser() {
    const supabase = getSupabase()

    const { data } = await supabase.auth.getUser()
    const user = data.user
    if (!user) return

    const { error } = await supabase
    .from("users")
    .upsert({
      id: user.id,
      email: user.email,
      display_name:
        user.user_metadata?.full_name ?? user.email,
      avatar_url: user.user_metadata?.avatar_url,
      last_active_at: new Date().toISOString(),
    } as any)


    if (error) console.error(error)
  }

  syncUser()
}, [])

  return (
    <>
      <section className="flex flex-col gap-6 p-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Live Rooms
          </h1>
          <p className="text-sm text-muted-foreground">
            Temukan room yang sedang live atau mulai siaranmu sendiri
          </p>
        </div>

        {/* Grid preview ala Twitch */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((name) => (
            <div
              key={name}
              className="rounded-xl border bg-card p-4 transition hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted font-semibold">
                  {name[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-medium">{name}</p>
                  <p className="text-xs text-muted-foreground">
                    Live · Audio only
                  </p>
                </div>
              </div>

              <Button
                className="mt-4 w-full"
                onClick={() => setOpen(true)}
              >
                Join Room
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* Login Modal */}
      <LoginDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
