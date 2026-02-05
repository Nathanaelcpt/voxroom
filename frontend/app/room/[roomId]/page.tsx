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
  getParticipantsWithProfiles,
  makeSpeaker,
} from "@/lib/api/rooms"
import { useWebSocket } from "@/hooks/use-websocket"
import { useAudioStream } from "@/hooks/use-audio-stream"
import { usePresence } from "@/hooks/use-presence"

import type { RoomDetail, Participant, Role } from "@/app/types/room"
import type { WSMessage } from "@/app/types/websocket"
import type { ChatMessage } from "@/app/types/chat"

/* ===================================================== */

export default function RoomPage() {
  /* ================= BASIC ================= */
  const params = useParams()
  const router = useRouter()
  const { user } = useUser()

  const roomId = params?.roomId as string | undefined
  usePresence({ roomId })

  /* ================= STATE ================= */
  const [room, setRoom] = useState<RoomDetail | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [participantCount, setParticipantCount] = useState(0)
  const [myRole, setMyRole] = useState<Role>("listener")
  const [isMuted, setIsMuted] = useState(true)
  const [loading, setLoading] = useState(true)
  const [roomLoaded, setRoomLoaded] = useState(false)

  const [showSettings, setShowSettings] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [playbackVolume, setPlaybackVolume] = useState(1)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])

  const canSpeak = myRole === "host" || myRole === "speaker"
  const isHost = myRole === "host"

  const playAudioChunkRef = useRef<
    ((userId: string, audioData: ArrayBuffer) => void) | null
  >(null)

  /* ================= HELPERS ================= */

  const resolveRole = useCallback(
    (userId?: string): Role => {
      if (!userId) return "listener"
      return (
        participants.find((p) => p.user_id === userId)?.role ??
        "listener"
      )
    },
    [participants]
  )

  /* ================= LOAD ROOM ================= */

  useEffect(() => {
    if (!roomId || !user) {
      setLoading(false)
      return
    }

    const safeRoomId = roomId
    const safeUser = user

    async function loadRoom() {
      try {
        const data = await getRoomDetails(safeRoomId)
        setRoom(data)

        const profiles = await getParticipantsWithProfiles(safeRoomId)
        setParticipants(profiles.participants)
        setParticipantCount(profiles.participants.length)

        const me = data.participants.find(
          (p) => p.user_id === safeUser.id
        )
        if (me) setMyRole(me.role)

        setRoomLoaded(true)
      } catch (err) {
        console.error("Failed to load room:", err)
        router.push("/")
      } finally {
        setLoading(false)
      }
    }

    loadRoom()
  }, [roomId, user, router])

  /* ================= WEBSOCKET ================= */

  const handleWSMessage = useCallback(
    (message: WSMessage) => {
      const payload = message.payload
      if (!payload) return

      switch (message.type) {
        case "role_updated": {
          if (!payload.user_id || !payload.role) return
          const role = payload.role as Role

          setParticipants((prev) =>
            prev.map((p) =>
              p.user_id === payload.user_id ? { ...p, role } : p
            )
          )

          if (payload.user_id === user?.id) {
            setMyRole(role)
          }
          break
        }

        case "user_joined":
          setParticipantCount((p) => p + 1)
          break

        case "user_left":
          setParticipantCount((p) => Math.max(0, p - 1))
          break

        case "chat": {
          if (!payload.content) return

          const msg: ChatMessage = {
            id: payload.message_id || crypto.randomUUID(),
            type: "chat",
            username: payload.username || "User",
            content: payload.content,
            timestamp: new Date(payload.timestamp || Date.now()),
            avatar_url: payload.avatar_url,
            role: resolveRole(payload.user_id),
            user_id: payload.user_id,
          }

          setChatMessages((prev) => [...prev, msg])
          break
        }

        case "audio":
          if (message.from && payload.chunk && playAudioChunkRef.current) {
            const binary = atob(payload.chunk)
            const bytes = new Uint8Array(binary.length)
            for (let i = 0; i < binary.length; i++) {
              bytes[i] = binary.charCodeAt(i)
            }
            playAudioChunkRef.current(message.from, bytes.buffer)
          }
          break
      }
    },
    [user, resolveRole]
  )

  const { isConnected, send, sendAudioChunk } = useWebSocket({
    roomId: roomLoaded && roomId ? roomId : "",
    onMessage: handleWSMessage,
  })

  /* ================= AUDIO ================= */

  const {
    isCapturing,
    mediaStream,
    playAudioChunk,
    setPlaybackVolume: updatePlaybackVolume,
  } = useAudioStream({
    isHost,
    canSpeak,
    isMuted,
    isConnected,
    sendAudioChunk,
    playbackVolume,
  })

  useEffect(() => {
    playAudioChunkRef.current = playAudioChunk
  }, [playAudioChunk])

  /* ================= ACTIONS ================= */

  function handleToggleMic() {
    if (!canSpeak) return
    const next = !isMuted
    setIsMuted(next)
    send(next ? "mic_off" : "mic_on")
  }

  async function handleMakeSpeaker(userId: string) {
    if (!isHost || !roomId) return
    await makeSpeaker(roomId, userId)
  }

  async function handleEndRoom() {
    if (!isHost || !roomId) return
    if (!confirm("Yakin ingin mengakhiri room?")) return
    await endRoom(roomId)
    router.push("/")
  }

  /* ================= RENDER GUARD ================= */

  if (!room || !roomId || !user || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  /* ================= UI ================= */

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* HEADER */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Radio className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">{room.title}</h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-3 w-3" />
                {participantCount}
                <span>•</span>
                {isConnected ? "Connected" : "Connecting"}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            {isHost && (
              <Button variant="outline" onClick={() => setShowInviteModal(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Invite
              </Button>
            )}

            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowSettings((v) => !v)}
            >
              <Settings className="h-4 w-4" />
            </Button>

            {isHost && (
              <Button variant="destructive" onClick={handleEndRoom}>
                End Room
              </Button>
            )}

            <Button variant="outline" onClick={() => router.push("/")}>
              <LogOut className="h-4 w-4 mr-2" />
              Leave
            </Button>
          </div>
        </div>

        {/* SETTINGS */}
        {showSettings && (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="text-sm">Audio Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!canSpeak && (
                <VolumeControl
                  volume={playbackVolume}
                  onChange={(v) => {
                    setPlaybackVolume(v)
                    updatePlaybackVolume(v)
                  }}
                />
              )}

              <AudioDeviceSelector showOutput={!canSpeak} />

              {canSpeak && isCapturing && mediaStream && (
                <AudioMeter
                  stream={mediaStream}
                  label={isMuted ? "Mic Muted" : "Mic Live"}
                />
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          {/* LIVE STAGE */}
          <Card className="md:col-span-2 min-h-105">
            <CardHeader>
              <CardTitle>Live Stage</CardTitle>
            </CardHeader>

            <CardContent className="flex flex-col items-center justify-center gap-6 h-full">
              <UserAvatar user={user} size="lg" />
              <Badge className="capitalize">{myRole}</Badge>

              {canSpeak && (
                <Button
                  size="lg"
                  className="rounded-full h-16 w-16"
                  variant={isMuted ? "destructive" : "default"}
                  onClick={handleToggleMic}
                >
                  {isMuted ? <MicOff /> : <Mic />}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* LIVE CHAT */}
          <LiveChat
            roomId={roomId}
            currentUserId={user.id}
            messages={chatMessages}
            participantCount={participantCount}
            isHost={isHost}
            onSendMessage={(content) =>
              send("chat", {
                content,
                username:
                  user.user_metadata?.full_name ||
                  user.email?.split("@")[0] ||
                  "User",
                avatar_url: user.user_metadata?.avatar_url,
                role: myRole,
              })
            }
            onMakeSpeaker={handleMakeSpeaker}
          />
        </div>
      </div>

      {isHost && (
        <InviteFriendsModal
          open={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          roomId={roomId}
          roomTitle={room.title}
          onInvite={async () => {}}
        />
      )}
    </div>
  )
}
