"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Mic, MicOff, Users, Radio, LogOut, Volume2, UserPlus } from "lucide-react"
import { useUser } from "@/hooks/use-user"
import { getRoomDetails, endRoom } from "@/lib/api/rooms"
import { useWebSocket } from "@/hooks/use-websocket"
import type { RoomDetail, Participant, Role } from "@/app/types/room"
import type { WSMessage } from "@/app/types/websocket"

export default function RoomPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useUser()

  const roomId = params?.roomId as string | undefined

  const [room, setRoom] = useState<RoomDetail | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [myRole, setMyRole] = useState<Role>("listener")
  const [isMuted, setIsMuted] = useState(true)
  const [loading, setLoading] = useState(true)
  const [roomLoaded, setRoomLoaded] = useState(false) // ✅ Flag untuk WebSocket

  const canSpeak = myRole === "host" || myRole === "speaker"
  const isHost = myRole === "host"

  // ✅ STEP 1: Load room details FIRST (before WebSocket)
  useEffect(() => {
    if (!roomId || !user) {
      if (!user) {
        setLoading(false)
      }
      return
    }

    async function loadRoom() {
      if (!roomId || !user) return

      try {
        console.log("📥 Loading room details BEFORE WebSocket...")
        const data = await getRoomDetails(roomId!)
        setRoom(data)
        setParticipants(data.participants)

        // ✅ Get role from database
        const me = data.participants.find((p) => p.user_id === user.id)
        if (me) {
          setMyRole(me.role)
          console.log("✅ Role from DB:", me.role)
        } else {
          console.warn("⚠️ User not in participants yet")
        }

        // ✅ CRITICAL: Set roomLoaded AFTER we have the data
        setRoomLoaded(true)
        console.log("✅ Room loaded, WebSocket can connect now")
      } catch (err) {
        console.error("Failed to load room:", err)
        alert("Room tidak ditemukan")
        router.push("/")
      } finally {
        setLoading(false)
      }
    }

    loadRoom()
  }, [roomId, user, router])

  // WebSocket message handler
  const handleWSMessage = useCallback(
    (message: WSMessage) => {
      switch (message.type) {
        case "role_assigned":
          if (message.payload?.role) {
            console.log("📨 WS Role assigned:", message.payload.role, "| DB role:", myRole)
            // ✅ Don't overwrite if we already have correct role from DB
            if (myRole === "listener") {
              setMyRole(message.payload.role)
            } else {
              console.log("ℹ️ Keeping DB role:", myRole)
            }
          }
          break

        case "role_updated":
          if (message.payload?.user_id && message.payload?.role) {
            setParticipants((prev) =>
              prev.map((p) =>
                p.user_id === message.payload.user_id
                  ? { ...p, role: message.payload.role }
                  : p
              )
            )

            if (user !== null && message.payload.user_id === user.id) {
              setMyRole(message.payload.role)
              console.log("✅ Your role updated:", message.payload.role)
            }
          }
          break

        case "listener_count":
          if (message.payload?.count !== undefined) {
            setRoom((prev) =>
              prev ? { ...prev, listeners: message.payload.count } : prev
            )
          }
          break

        case "room_ended":
          alert("Room telah ditutup oleh host")
          router.push("/")
          break

        default:
          console.log("📨 Unhandled message:", message.type)
      }
    },
    [user, router, myRole]
  )

  // ✅ STEP 2: Connect WebSocket ONLY AFTER room is loaded
  const { isConnected, send } = useWebSocket({
    roomId: roomLoaded && roomId ? roomId : "", // ✅ Empty string prevents connection
    onMessage: handleWSMessage,
    onOpen: () => console.log("✅ Connected to WebSocket"),
    onClose: () => console.log("🔌 Disconnected from WebSocket"),
  })

  // Toggle mic
  function handleToggleMic() {
    if (!canSpeak) return

    const newMutedState = !isMuted
    setIsMuted(newMutedState)

    send(newMutedState ? "mic_off" : "mic_on")
    console.log(newMutedState ? "🔇 Muted" : "🎤 Unmuted")
  }

  // Leave room
  async function handleLeaveRoom() {
    router.push("/")
  }

  // End room (host only)
  async function handleEndRoom() {
    if (!isHost || !roomId) return

    const confirmed = confirm(
      "Yakin ingin mengakhiri room? Semua participant akan keluar."
    )

    if (!confirmed) return

    try {
      await endRoom(roomId!)
      router.push("/")
    } catch (err) {
      console.error("Failed to end room:", err)
      alert("Gagal mengakhiri room")
    }
  }

  if (!roomId) {
    return null
  }

  if (!user || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">
            {!user ? "Please login..." : "Loading room..."}
          </p>
        </div>
      </div>
    )
  }

  if (!room) {
    return null
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Radio className="h-8 w-8 text-primary" />
              {isConnected && (
                <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-green-500 animate-pulse" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold">{room.title}</h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="secondary" className="gap-1">
                  <Users className="h-3 w-3" />
                  {room.listeners} listening
                </Badge>
                <span>•</span>
                <span>{isConnected ? "Connected" : roomLoaded ? "Connecting..." : "Loading..."}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            {isHost && (
              <Button variant="destructive" onClick={handleEndRoom}>
                End Room
              </Button>
            )}
            <Button variant="outline" onClick={handleLeaveRoom}>
              <LogOut className="h-4 w-4 mr-2" />
              Leave
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Main Stage */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Live Stage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col items-center justify-center py-12 space-y-6">
                <div className="relative">
                  <div
                    className={`absolute inset-0 rounded-full ${
                      !isMuted && canSpeak ? "bg-primary/20 animate-ping" : ""
                    }`}
                  />
                  <Avatar className="h-32 w-32 border-4 border-primary relative">
                    <AvatarFallback className="text-4xl">
                      {isHost ? "🎙️" : canSpeak ? "🗣️" : "👤"}
                    </AvatarFallback>
                  </Avatar>
                </div>

                <div className="text-center">
                  <p className="text-lg font-semibold">
                    {isHost
                      ? "You're Live!"
                      : canSpeak
                      ? "You're a Speaker"
                      : "Listening"}
                  </p>
                  <Badge variant={isHost ? "default" : "secondary"}>
                    {myRole}
                  </Badge>
                </div>

                {canSpeak && (
                  <>
                    <Button
                      size="lg"
                      variant={isMuted ? "destructive" : "default"}
                      className="rounded-full h-16 w-16 p-0"
                      onClick={handleToggleMic}
                    >
                      {isMuted ? (
                        <MicOff className="h-6 w-6" />
                      ) : (
                        <Mic className="h-6 w-6" />
                      )}
                    </Button>
                    <p className="text-sm text-muted-foreground">
                      {isMuted ? "Tap to unmute" : "Tap to mute"}
                    </p>
                  </>
                )}

                {!canSpeak && (
                  <p className="text-sm text-muted-foreground">
                    Hanya host dan speaker yang bisa berbicara
                  </p>
                )}
              </div>

              <div className="h-24 bg-muted rounded-lg flex items-center justify-center">
                <div className="flex gap-1 items-end h-16">
                  {[...Array(20)].map((_, i) => (
                    <div
                      key={i}
                      className={`w-2 bg-primary rounded-full transition-all ${
                        !isMuted && canSpeak ? "animate-pulse" : "opacity-30"
                      }`}
                      style={{
                        height: `${Math.random() * 100}%`,
                        animationDelay: `${i * 0.1}s`,
                      }}
                    />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Participants */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Participants ({participants.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {participants.map((participant) => {
                  const isMe = participant.user_id === user.id
                  const isSpeaker = participant.role === "speaker"
                  const isParticipantHost = participant.role === "host"

                  return (
                    <div
                      key={participant.user_id}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
                    >
                      <Avatar>
                        <AvatarFallback>
                          {isParticipantHost
                            ? "H"
                            : isSpeaker
                            ? "S"
                            : "L"}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {isMe
                            ? "You"
                            : participant.username ||
                              `User ${participant.user_id.slice(0, 6)}`}
                        </p>
                        <Badge
                          variant={
                            isParticipantHost ? "default" : "secondary"
                          }
                          className="text-xs"
                        >
                          {participant.role}
                        </Badge>
                      </div>

                      <div>
                        {participant.role !== "listener" ? (
                          <Volume2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <Mic className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>

                      {isHost && !isMe && participant.role === "listener" && (
                        <Button size="sm" variant="outline">
                          <UserPlus className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}