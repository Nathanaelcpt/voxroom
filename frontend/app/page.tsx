"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { AuthDialog } from "@/components/auth-dialog"
import { useUser } from "@/hooks/use-user"
import { getAccessToken } from "@/lib/auth"

const rooms = ["andi", "budi", "charlie"]

export default function HomePage() {
  const { user, loading } = useUser()
  const [open, setOpen] = useState(false)
  const router = useRouter()

  async function joinRoom(roomName: string) {
    if (!user) {
      setOpen(true)
      return
    }

    const token = await getAccessToken()

    // 🔍 DEBUG (hapus nanti)
    console.log("=== JOIN ROOM DEBUG ===")
    console.log("Room:", roomName)
    console.log("User ID:", user.id)
    console.log("JWT OK:", !!token)
    console.log("JWT Preview:", token?.slice(0, 20), "...")

    if (!token) {
      alert("Session invalid, silakan login ulang")
      return
    }

    // NEXT STEP:
    // router.push(`/room/${roomName}`)
    // connect WebSocket pakai token
  }

  function startStreaming() {
    if (!user) {
      setOpen(true)
      return
    }

    router.push("/go-live/setup")
  }

  if (loading) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Loading...
      </div>
    )
  }

  return (
    <>
      <section className="flex flex-col gap-6 p-6 bg-background text-foreground">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Live Rooms
            </h1>
            <p className="text-sm text-muted-foreground">
              Temukan room yang sedang live atau mulai siaranmu sendiri
            </p>
          </div>

          <Button onClick={startStreaming}>
            Mulai Streaming
          </Button>
        </div>

        {/* Rooms */}
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
                onClick={() => joinRoom(name)}
              >
                Join Room
              </Button>
            </div>
          ))}
        </div>
      </section>

      <AuthDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
