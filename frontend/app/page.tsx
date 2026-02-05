"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Radio, Users, AlertCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AuthDialog } from "@/components/auth-dialog"
import { OnlineFriendsSidebar } from "@/components/online-friends-sidebar"
import { JoinRoomModal } from "@/components/join-room-modal"

import { useUser } from "@/hooks/use-user"
import { usePresence } from "@/hooks/use-presence"
import { getActiveRooms, joinRoom as joinRoomAPI } from "@/lib/api/rooms"
import type { Room } from "@/app/types/room"

/* ======================================================= */

export default function HomePage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()

  /* ================= STATE ================= */
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [authDialogOpen, setAuthDialogOpen] = useState(false)

  // Join modal
  const [joinModalOpen, setJoinModalOpen] = useState(false)
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [isFriendHost, setIsFriendHost] = useState(false)

  usePresence()

  /* ================= LOAD ROOMS ================= */
  const loadRooms = useCallback(async () => {
    try {
      const data = await getActiveRooms()
      setRooms(data)
      setError(null)
    } catch (err) {
      console.error("Failed to load rooms:", err)
      if (rooms.length === 0) {
        setError("Koneksi ke database lambat, mencoba lagi...")
      }
    } finally {
      setLoading(false)
    }
  }, [rooms.length])

  useEffect(() => {
    loadRooms()
    const interval = setInterval(loadRooms, 5000)
    return () => clearInterval(interval)
  }, [loadRooms])

  /* ================= HELPERS ================= */
  async function getAccessToken(): Promise<string> {
    const { getSupabase } = await import("@/lib/supabase")
    const supabase = getSupabase()
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? ""
  }

  async function checkIfFriendHost(hostId?: string): Promise<boolean> {
    if (!user || !hostId) return false

    try {
      const token = await getAccessToken()
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/social/is-friend/${hostId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      if (!res.ok) return false
      const data = await res.json()
      return Boolean(data?.is_friend)
    } catch (err) {
      console.error("checkIfFriendHost error:", err)
      return false
    }
  }

  /* ================= ACTIONS ================= */
  function handleStartStreaming() {
    if (!user) {
      setAuthDialogOpen(true)
      return
    }
    router.push("/go-live/setup")
  }

  async function handleJoinRoomClick(room: Room) {
    if (!user) {
      setAuthDialogOpen(true)
      return
    }

    const isFriend = await checkIfFriendHost(room.host_id)
    setSelectedRoom(room)
    setIsFriendHost(isFriend)
    setJoinModalOpen(true)
  }

  async function handleJoinWithRole(roomId: string, asSpeaker: boolean) {
    try {
      await joinRoomAPI(roomId, asSpeaker ? "speaker" : "listener")
      router.push(`/room/${roomId}`)
    } catch (err) {
      console.error("Failed to join room:", err)
      throw err
    }
  }

  /* ================= LOADING ================= */
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

  /* ================= UI ================= */
  return (
    <>
      <section className="container mx-auto p-6">
        <div className="grid lg:grid-cols-4 gap-6">
          {/* MAIN */}
          <div className="lg:col-span-3 space-y-6">
            {/* HEADER */}
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

            {/* ERROR */}
            {error && (
              <Card className="border-destructive">
                <CardContent className="flex items-center gap-2 pt-6 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">{error}</span>
                </CardContent>
              </Card>
            )}

            {/* EMPTY */}
            {rooms.length === 0 && !error && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Radio className="h-16 w-16 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    Belum ada room live
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Jadilah yang pertama mulai streaming!
                  </p>
                  <Button onClick={handleStartStreaming}>
                    Mulai Streaming
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* ROOMS */}
            {rooms.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {rooms.map((room) => (
                  <Card
                    key={room.id}
                    className="hover:shadow-lg transition-shadow"
                  >
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
                        onClick={() => handleJoinRoomClick(room)}
                      >
                        Join Room
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* SIDEBAR */}
          {user && (
            <div className="lg:col-span-1">
              <OnlineFriendsSidebar />
            </div>
          )}
        </div>
      </section>

      <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />

      {selectedRoom && (
        <JoinRoomModal
          open={joinModalOpen}
          onClose={() => {
            setJoinModalOpen(false)
            setSelectedRoom(null)
            setIsFriendHost(false)
          }}
          room={{
            id: selectedRoom.id,
            title: selectedRoom.title,
            hostName: selectedRoom.host_name,
            listeners: selectedRoom.listeners,
          }}
          isFriendHost={isFriendHost}
          onJoin={handleJoinWithRole}
        />
      )}
    </>
  )
}
