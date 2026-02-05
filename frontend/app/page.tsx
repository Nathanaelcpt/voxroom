// app/page.tsx - UPDATED with Join Room Modal
"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Radio, Users, AlertCircle } from "lucide-react"
import { AuthDialog } from "@/components/auth-dialog"
import { OnlineFriendsSidebar } from "@/components/online-friends-sidebar"
import { JoinRoomModal } from "@/components/join-room-modal" // ✅ NEW
import { useUser } from "@/hooks/use-user"
import { usePresence } from "@/hooks/use-presence"
import { getActiveRooms, joinRoom as joinRoomAPI } from "@/lib/api/rooms"
import type { Room } from "@/app/types/room"

export default function HomePage() {
  const { user, loading: userLoading } = useUser()
  const [authDialogOpen, setAuthDialogOpen] = useState(false)
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  // ✅ NEW: Join Modal State
  const [joinModalOpen, setJoinModalOpen] = useState(false)
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [isFriendHost, setIsFriendHost] = useState(false)

  usePresence()

  // Load rooms
  useEffect(() => {
    async function loadRooms() {
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
    }

    loadRooms()
    const interval = setInterval(loadRooms, 5000)
    return () => clearInterval(interval)
  }, [])

  // ✅ NEW: Check if room host is user's friend
  async function checkIfFriendHost(roomHostId: string): Promise<boolean> {
    if (!user) return false

    try {
      // Call backend to check if roomHostId is in user's following list
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/social/is-friend/${roomHostId}`,
        {
          headers: {
            Authorization: `Bearer ${await getAccessToken()}`,
          },
        }
      )

      if (!response.ok) return false

      const data = await response.json()
      return data.is_friend || false
    } catch (error) {
      console.error("Failed to check friend status:", error)
      return false
    }
  }

  // ✅ NEW: Handle Join Room Click
  async function handleJoinRoomClick(room: Room) {
    if (!user) {
      setAuthDialogOpen(true)
      return
    }

    // Check if room host is friend
    const isFriend = room.host_id ? await checkIfFriendHost(room.host_id) : false

    setSelectedRoom(room)
    setIsFriendHost(isFriend)
    setJoinModalOpen(true)
  }

  // ✅ NEW: Handle Join with Role
  async function handleJoinWithRole(roomId: string, asSpeaker: boolean) {
    try {
      // Call backend join endpoint with role preference
      await joinRoomAPI(roomId, asSpeaker ? "speaker" : "listener")
      
      // Navigate to room
      router.push(`/room/${roomId}`)
    } catch (err) {
      console.error("Failed to join room:", err)
      throw err // Re-throw to be handled by modal
    }
  }

  // Helper to get access token
  async function getAccessToken() {
    const { getSupabase } = await import("@/lib/supabase")
    const supabase = getSupabase()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    return session?.access_token || ""
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
      <section className="container mx-auto p-6">
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
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
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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

                      {/* ✅ UPDATED: Use handleJoinRoomClick instead of direct navigation */}
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

          {/* Sidebar */}
          {user && (
            <div className="lg:col-span-1">
              <OnlineFriendsSidebar />
            </div>
          )}
        </div>
      </section>

      <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />

      {/* ✅ NEW: Join Room Modal */}
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
