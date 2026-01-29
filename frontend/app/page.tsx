"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Radio, Users, AlertCircle } from "lucide-react"
import { AuthDialog } from "@/components/auth-dialog"
import { useUser } from "@/hooks/use-user"
import { getActiveRooms, joinRoom as joinRoomAPI } from "@/lib/api/rooms"
import type { Room } from "@/app/types/room"

export default function HomePage() {
  const { user, loading: userLoading } = useUser()
  const [authDialogOpen, setAuthDialogOpen] = useState(false)
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  // Load rooms
  useEffect(() => {
    async function loadRooms() {
      try {
        const data = await getActiveRooms()
        setRooms(data)
        setError(null)
      } catch (err) {
        console.error("Failed to load rooms:", err)
        setError("Gagal memuat daftar room")
        setRooms([])
      } finally {
        setLoading(false)
      }
    }

    loadRooms()

    // Auto-refresh every 10 seconds
    const interval = setInterval(loadRooms, 10000)
    return () => clearInterval(interval)
  }, [])

  async function handleJoinRoom(roomId: string) {
    if (!user) {
      setAuthDialogOpen(true)
      return
    }

    try {
      await joinRoomAPI(roomId)
      router.push(`/room/${roomId}`)
    } catch (err) {
      console.error("Failed to join room:", err)
      alert(err instanceof Error ? err.message : "Gagal join room")
    }
  }

  function handleStartStreaming() {
    if (!user) {
      setAuthDialogOpen(true)
      return
    }
    router.push("/go-live/setup")
  }

  if (userLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <section className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Live Rooms</h1>
            <p className="text-muted-foreground mt-1">
              {rooms.length} room{rooms.length !== 1 ? "s" : ""} sedang live
            </p>
          </div>

          <Button size="lg" onClick={handleStartStreaming}>
            <Radio className="h-4 w-4 mr-2" />
            Mulai Streaming
          </Button>
        </div>

        {/* Error */}
        {error && (
          <Card className="border-destructive">
            <CardContent className="flex items-center gap-2 pt-6 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {rooms.length === 0 && !error && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Radio className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Belum ada room live</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Jadilah yang pertama mulai streaming!
              </p>
              <Button onClick={handleStartStreaming}>Mulai Streaming</Button>
            </CardContent>
          </Card>
        )}

        {/* Rooms Grid */}
        {rooms.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room) => (
              <Card key={room.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg truncate mb-1">
                        {room.title}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Badge variant="secondary" className="gap-1">
                          <Users className="h-3 w-3" />
                          {room.listeners}
                        </Badge>
                        <span>•</span>
                        <span>Audio only</span>
                      </div>
                    </div>
                    {room.is_live && (
                      <div className="flex items-center gap-1 text-xs font-medium text-green-600">
                        <div className="h-2 w-2 rounded-full bg-green-600 animate-pulse" />
                        LIVE
                      </div>
                    )}
                  </div>

                  <Button
                    className="w-full"
                    onClick={() => handleJoinRoom(room.id)}
                  >
                    Join Room
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
    </>
  )
}