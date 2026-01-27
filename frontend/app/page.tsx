"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { AuthDialog } from "@/components/auth-dialog"
import { useUser } from "@/hooks/use-user"
import { getAccessToken } from "@/lib/auth"

type Room = {
  id: string
  title: string
  listeners: number
}

export default function HomePage() {
  const { user, loading } = useUser()
  const [open, setOpen] = useState(false)
  const [rooms, setRooms] = useState<Room[]>([])
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    async function loadRooms() {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/rooms`
        )

        if (!res.ok) {
          const text = await res.text()
          throw new Error(text || "Failed to load rooms")
        }

        const data = await res.json()
        setRooms(data)
      } catch (err: any) {
        console.error("❌ LOAD ROOMS ERROR:", err.message)
        setError("Gagal memuat room")
        setRooms([])
      }
    }

    loadRooms()
  }, [])

  async function joinRoom(roomId: string) {
    if (!user) {
      setOpen(true)
      return
    }

    const token = await getAccessToken()
    if (!token) {
      alert("Session invalid, silakan login ulang")
      return
    }

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/rooms/${roomId}/join`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )

    if (!res.ok) {
      const text = await res.text()
      alert(text || "Gagal join room")
      return
    }

    router.push(`/room/${roomId}`)
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
        Loading…
      </div>
    )
  }

  return (
    <>
      <section className="flex flex-col gap-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">
              Live Rooms
            </h1>
            <p className="text-sm text-muted-foreground">
              Temukan room yang sedang live
            </p>
          </div>

          <Button onClick={startStreaming}>
            Mulai Streaming
          </Button>
        </div>

        {/* Error */}
        {error && (
          <div className="text-sm text-red-500">
            {error}
          </div>
        )}

        {/* Rooms */}
        {rooms.length === 0 && !error && (
          <div className="text-sm text-muted-foreground">
            Belum ada room yang live
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map(room => (
            <div
              key={room.id}
              className="rounded-xl border bg-card p-4"
            >
              <p className="font-medium">
                {room.title}
              </p>
              <p className="text-xs text-muted-foreground">
                {room.listeners} listening
              </p>

              <Button
                className="mt-4 w-full"
                onClick={() => joinRoom(room.id)}
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
