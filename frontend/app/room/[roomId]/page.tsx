// app/room/[roomId]/page.tsx - FINAL FIXED (Proper declaration order)
"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect, useState, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AudioMeter } from "@/components/audio-meter"
import { AudioDeviceSelector } from "@/components/audio-device-selector"
import { VolumeControl } from "@/components/volume-control"
import { UserAvatar } from "@/components/user-avatar"
import { InviteFriendsModal } from "@/components/invite-friends-modal"
import { LiveChat } from "@/components/live-chat"
import {
  Mic,
  MicOff,
  Users,
  Radio,
  LogOut,
  UserPlus,
  Settings,
} from "lucide-react"
import { useUser } from "@/hooks/use-user"
import {
  getRoomDetails,
  endRoom,
  inviteSpeaker,
  getParticipantsWithProfiles,
  makeSpeaker,
} from "@/lib/api/rooms"
import { useWebSocket } from "@/hooks/use-websocket"
import { useAudioStream } from "@/hooks/use-audio-stream"
import type { RoomDetail, Participant, Role } from "@/app/types/room"
import type { WSMessage } from "@/app/types/websocket"
import { usePresence } from "@/hooks/use-presence"

interface ChatMessage {
  id: string
  type: "system" | "chat" | "event"
  username: string
  content: string
  timestamp: Date
  avatar_url?: string
  role?: "host" | "speaker" | "listener"
  event_type?: "join" | "leave" | "speaker_invited" | "mic_on" | "mic_off"
  user_id?: string
}

export default function RoomPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useUser()

  const roomId = params?.roomId as string | undefined
  usePresence({ roomId: roomId || undefined })

  const [room, setRoom] = useState<RoomDetail | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [participantCount, setParticipantCount] = useState(0)
  const [myRole, setMyRole] = useState<Role>("listener")
  const [isMuted, setIsMuted] = useState(true)
  const [loading, setLoading] = useState(true)
  const [roomLoaded, setRoomLoaded] = useState(false)
  const [speakingUsers, setSpeakingUsers] = useState<Set<string>>(new Set())
  const [showSettings, setShowSettings] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [playbackVolume, setPlaybackVolume] = useState(1.5)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])

  const canSpeak = myRole === "host" || myRole === "speaker"
  const isHost = myRole === "host"

  // ✅ FIXED: Use ref to hold playAudioChunk function
  const playAudioChunkRef = useRef<((userId: string, audioData: ArrayBuffer) => void) | null>(null)

  // Load room details
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
        console.log("📥 Loading room details...")
        const data = await getRoomDetails(roomId!)
        setRoom(data)

        try {
          const profilesData = await getParticipantsWithProfiles(roomId!)
          setParticipants(profilesData.participants)
          setParticipantCount(profilesData.participants.length)
        } catch (err) {
          console.warn("⚠️ Failed to load participant profiles:", err)
          setParticipants(data.participants)
          setParticipantCount(data.participants.length)
        }

        const me = data.participants.find((p) => p.user_id === user.id)
        if (me) {
          setMyRole(me.role)
          console.log("✅ Role from DB:", me.role)
        }

        setRoomLoaded(true)
        console.log("✅ Room loaded")
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

  // Add system message to chat
  const addSystemMessage = useCallback(
    (
      username: string,
      eventType: ChatMessage["event_type"],
      role?: Role
    ) => {
      const message: ChatMessage = {
        id: `${Date.now()}-${Math.random()}`,
        type: "event",
        username,
        content: "",
        timestamp: new Date(),
        event_type: eventType,
        role,
      }
      setChatMessages((prev) => [...prev, message])
    },
    []
  )

  // WebSocket message handler
  const handleWSMessage = useCallback(
    (message: WSMessage) => {
      const payload = message.payload
      if (!payload) return

      switch (message.type) {
        case "role_assigned":
          if (payload.role) {
            setMyRole(payload.role as Role)
          }
          break

        case "role_updated":
          if (payload.user_id && payload.role) {
            const newRole = payload.role as Role
            
            setParticipants((prev) =>
              prev.map((p) =>
                p.user_id === payload.user_id
                  ? { ...p, role: newRole }
                  : p
              )
            )

            if (user !== null && payload.user_id === user.id) {
              setMyRole(newRole)
              console.log("✅ Your role updated:", newRole)
            }

            if (newRole === "speaker") {
              addSystemMessage(
                payload.username || "User",
                "speaker_invited",
                "speaker"
              )
            }
          }
          break

        case "listener_count":
          if (typeof payload.count === "number") {
            setParticipantCount(payload.count)
            setRoom((prev) => {
              if (!prev) return prev
              return { ...prev, listeners: payload.count as number }
            })
          }
          break

        case "user_joined":
          if (payload.user_id && payload.username) {
            setParticipantCount((prev) => prev + 1)
            addSystemMessage(
              payload.username,
              "join",
              (payload.role as Role) || "listener"
            )
          }
          break

        case "user_left":
          if (payload.user_id && payload.username) {
            setParticipantCount((prev) => Math.max(0, prev - 1))
            addSystemMessage(
              payload.username,
              "leave",
              payload.role as Role
            )
          }
          break

        case "chat":
          if (payload.content) {
            const chatMsg: ChatMessage = {
              id: payload.message_id || `${Date.now()}-${Math.random()}`,
              type: "chat",
              username: payload.username || "User",
              content: payload.content,
              timestamp: new Date(payload.timestamp || Date.now()),
              avatar_url: payload.avatar_url,
              role: payload.role as Role,
              user_id: payload.user_id,
            }
            setChatMessages((prev) => [...prev, chatMsg])
          }
          break

        case "audio":
          // ✅ FIXED: Use ref to access playAudioChunk
          if (message.from && payload.chunk && playAudioChunkRef.current) {
            const binary = atob(payload.chunk)
            const bytes = new Uint8Array(binary.length)
            for (let i = 0; i < binary.length; i++) {
              bytes[i] = binary.charCodeAt(i)
            }
            playAudioChunkRef.current(message.from, bytes.buffer)
          }
          break

        case "speaking":
          if (payload.user_id !== undefined) {
            setSpeakingUsers((prev) => {
              const next = new Set(prev)
              if (payload.is_speaking) {
                next.add(payload.user_id!)
                
                if (payload.user_id !== user?.id && payload.username) {
                  addSystemMessage(
                    payload.username,
                    "mic_on",
                    payload.role as Role
                  )
                }
              } else {
                next.delete(payload.user_id!)
                
                if (payload.user_id !== user?.id && payload.username) {
                  addSystemMessage(
                    payload.username,
                    "mic_off",
                    payload.role as Role
                  )
                }
              }
              return next
            })
          }
          break

        case "room_ended":
          alert("Room telah ditutup oleh host")
          router.push("/")
          break
      }
    },
    [user, router, addSystemMessage]
  )

  // Connect WebSocket
  const { isConnected, send, sendAudioChunk } = useWebSocket({
    roomId: roomLoaded && roomId ? roomId : "",
    onMessage: handleWSMessage,
  })

  // Audio streaming
  const {
    micPermission,
    isCapturing,
    playAudioChunk,
    setPlaybackVolume: updatePlaybackVolume,
    mediaStream,
  } = useAudioStream({
    isHost,
    canSpeak,
    isMuted,
    isConnected,
    sendAudioChunk,
    playbackVolume,
  })

  // ✅ FIXED: Store playAudioChunk in ref after it's available
  useEffect(() => {
    playAudioChunkRef.current = playAudioChunk
  }, [playAudioChunk])

  // Send chat message
  const handleSendMessage = useCallback(
    (content: string) => {
      if (!user || !content.trim()) return

      send("chat", {
        content: content.trim(),
        username: user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
        avatar_url: user.user_metadata?.avatar_url,
        role: myRole,
      })
    },
    [user, myRole, send]
  )

  // Update volume
  const handleVolumeChange = (volume: number) => {
    setPlaybackVolume(volume)
    updatePlaybackVolume(volume)
  }

  // Toggle mic
  function handleToggleMic() {
    if (!canSpeak) return
    const newMutedState = !isMuted
    setIsMuted(newMutedState)
    send(newMutedState ? "mic_off" : "mic_on")
  }

  // Invite speaker
  async function handleInviteSpeaker(userId: string) {
    if (!isHost || !roomId) return

    try {
      await inviteSpeaker(roomId, userId)
      console.log("✅ Invited speaker:", userId)
      const profilesData = await getParticipantsWithProfiles(roomId)
      setParticipants(profilesData.participants)
    } catch (err) {
      console.error("Failed to invite speaker:", err)
      alert("Gagal invite speaker")
    }
  }

  // Invite friend
  async function handleInviteFriend(userId: string) {
    if (!isHost || !roomId) return

    try {
      console.log("📨 Sending invitation to:", userId)
      alert(`Invitation sent!`)
      setShowInviteModal(false)
    } catch (err) {
      console.error("Failed to invite friend:", err)
      throw err
    }
  }

  async function handleMakeSpeaker(userId: string) {
  if (!isHost || !roomId) return

  try {
    await makeSpeaker(roomId, userId)
    console.log("✅ User promoted to speaker:", userId)
    
    // Refresh participants to show updated role
    const profilesData = await getParticipantsWithProfiles(roomId)
    setParticipants(profilesData.participants)
  } catch (err) {
    console.error("Failed to promote user:", err)
    alert(err instanceof Error ? err.message : "Gagal promosi speaker")
  }
}

  // Leave/End room
  async function handleLeaveRoom() {
    router.push("/")
  }

  async function handleEndRoom() {
    if (!isHost || !roomId) return
    if (!confirm("Yakin ingin mengakhiri room?")) return

    try {
      await endRoom(roomId)
      router.push("/")
    } catch (err) {
      console.error("Failed to end room:", err)
    }
  }

  if (!roomId || !user || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!room) return null

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
                  {participantCount} listening
                </Badge>
                <span>•</span>
                <span>{isConnected ? "Connected" : "Connecting..."}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            {isHost && (
              <Button variant="outline" onClick={() => setShowInviteModal(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Invite Friends
              </Button>
            )}
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="h-4 w-4" />
            </Button>
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
                <UserAvatar
                  user={user}
                  size="lg"
                  className="h-32 w-32 border-4 border-primary text-4xl"
                />

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
                      disabled={!isConnected}
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
              </div>

              {canSpeak && isCapturing && (
                <AudioMeter
                  stream={mediaStream}
                  label={`Your Audio (${isMuted ? "Muted" : "Live"})`}
                />
              )}

              {showSettings && (
                <div className="space-y-4">
                  {!canSpeak && (
                    <VolumeControl
                      volume={playbackVolume}
                      onChange={handleVolumeChange}
                    />
                  )}
                  <Card className="border-dashed">
                    <CardHeader>
                      <CardTitle className="text-sm">Audio Settings</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <AudioDeviceSelector showOutput={!canSpeak} />
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Live Chat */}
          <Card className="md:col-span-1 flex flex-col h-150">
            <LiveChat
              roomId={roomId}
              currentUserId={user.id}
              onSendMessage={handleSendMessage}
              messages={chatMessages}
              participantCount={participantCount}
              isHost={isHost}
              onMakeSpeaker={handleMakeSpeaker}
            />
          </Card>
        </div>
      </div>

      {/* Invite Friends Modal */}
      {isHost && room && (
        <InviteFriendsModal
          open={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          roomId={roomId}
          roomTitle={room.title}
          onInvite={handleInviteFriend}
        />
      )}
    </div>
  )
}
