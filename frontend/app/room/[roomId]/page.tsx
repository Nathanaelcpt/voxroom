"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect, useState, useCallback, useRef } from "react"
import {
  Mic,
  MicOff,
  Users,
  Radio,
  LogOut,
  UserPlus,
  Settings,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AudioMeter } from "@/components/audio-meter"
import { AudioDeviceSelector } from "@/components/audio-device-selector"
import { VolumeControl } from "@/components/volume-control"
import { UserAvatar } from "@/components/user-avatar"
import { InviteFriendsModal } from "@/components/invite-friends-modal"
import { LiveChat } from "@/components/live-chat"

import { useUser } from "@/hooks/use-user"
import { usePresence } from "@/hooks/use-presence"
import { useWebSocket } from "@/hooks/use-websocket"
import { useAudioStream } from "@/hooks/use-audio-stream"

import {
  getRoomDetails,
  getParticipantsWithProfiles,
  makeSpeaker,
  endRoom,
} from "@/lib/api/rooms"

import type { RoomDetail, Participant, Role } from "@/app/types/room"
import type { WSMessage } from "@/app/types/websocket"
import type { ChatMessage } from "@/app/types/chat"

/* ======================================================= */

export default function RoomPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useUser()

  /* ================= SAFE PARAM ================= */
  const roomIdParam = params?.roomId
  const roomId =
    typeof roomIdParam === "string" ? roomIdParam : undefined

  usePresence({ roomId: roomId || undefined })

  /* ================= RENDER GUARD ================= */
  if (!user || !roomId) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return <RoomPageContent user={user} roomId={roomId} />
}

/* ======================================================= */
/*                    MAIN COMPONENT                      */
/* ======================================================= */

function RoomPageContent({
  user,
  roomId,
}: {
  user: NonNullable<ReturnType<typeof useUser>["user"]>
  roomId: string
}) {
  const router = useRouter()

  /* ================= STATE ================= */
  const [room, setRoom] = useState<RoomDetail | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [participantCount, setParticipantCount] = useState(0)
  const [myRole, setMyRole] = useState<Role>("listener")
  const [isMuted, setIsMuted] = useState(true)
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

  /* ================= LOAD ROOM ================= */
  useEffect(() => {
    async function loadRoom() {
      try {
        const data = await getRoomDetails(roomId)
        setRoom(data)

        const profiles = await getParticipantsWithProfiles(roomId)
        setParticipants(profiles.participants)
        setParticipantCount(profiles.participants.length)

        const me = data.participants.find(
          (p) => p.user_id === user.id
        )
        if (me) setMyRole(me.role)

        setRoomLoaded(true)
      } catch (err) {
        console.error("Failed to load room:", err)
        router.push("/")
      }
    }

    loadRoom()
  }, [roomId, user.id, router])

  /* ================= WEBSOCKET ================= */
  const handleWSMessage = useCallback(
    (message: WSMessage) => {
      /* ===== CHAT ===== */
      if (message.type === "chat") {
        const data = message.data
        if (!data) return
        
        // ✅ FIX: HAPUS BARIS INI!
        // ❌ if (data.user_id === user.id) return
        
        if (typeof data.content !== "string") return

        const chat: ChatMessage = {
          id: crypto.randomUUID(),
          type: "chat",
          username: data.username ?? "User",
          content: data.content,
          timestamp: new Date(),
          role: (data.role as Role) ?? "listener",
          user_id: data.user_id,
        }

        // ✅ Cegah duplikasi dengan pengecekan waktu
        setChatMessages((prev) => {
          const isDuplicate = prev.some(
            (msg) =>
              msg.user_id === chat.user_id &&
              msg.content === chat.content &&
              Math.abs(msg.timestamp.getTime() - chat.timestamp.getTime()) < 2000
          )
          
          if (isDuplicate) return prev
          return [...prev, chat]
        })
        return
      }

      /* ===== ROLE UPDATED ===== */
      if (message.type === "role_updated") {
        const data = message.data
        if (!data?.user_id || !data?.role) return

        setParticipants((prev) =>
          prev.map((p) =>
            p.user_id === data.user_id
              ? { ...p, role: data.role as Role }
              : p
          )
        )

        if (data.user_id === user.id) {
          setMyRole(data.role as Role)
        }
        return
      }

      /* ===== USER JOIN / LEAVE ===== */
      if (message.type === "user_joined") {
        setParticipantCount((p) => p + 1)
        return
      }

      if (message.type === "user_left") {
        setParticipantCount((p) => Math.max(0, p - 1))
        return
      }

      /* ===== AUDIO ===== */
      if (message.type === "audio") {
        if (!message.payload?.chunk) return
        if (!playAudioChunkRef.current) return
        if (!message.from) return

        try {
          const binary = atob(message.payload.chunk)
          const bytes = new Uint8Array(binary.length)
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i)
          }

          playAudioChunkRef.current(message.from, bytes.buffer)
        } catch (err) {
          console.error("Error processing audio chunk:", err)
        }
      }
    },
    [user.id]
  )

  const { isConnected, send, sendAudioChunk } = useWebSocket({
    roomId: roomLoaded ? roomId : "",
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
    if (!isHost) return
    await makeSpeaker(roomId, userId)
  }

  async function handleEndRoom() {
    if (!isHost) return
    if (!confirm("Yakin ingin mengakhiri room?")) return
    await endRoom(roomId)
    router.push("/")
  }

  if (!room) return null

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
          {/* STAGE */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Live Stage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 text-center">
              <UserAvatar user={user} size="lg" />
              <Badge>{myRole}</Badge>

              {canSpeak && (
                <Button
                  size="lg"
                  variant={isMuted ? "destructive" : "default"}
                  onClick={handleToggleMic}
                >
                  {isMuted ? <MicOff /> : <Mic />}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* CHAT */}
          <LiveChat
            roomId={roomId}
            currentUserId={user.id}
            messages={chatMessages}
            participantCount={participantCount}
            isHost={isHost}
            onMakeSpeaker={handleMakeSpeaker}
            onSendMessage={(content) => {
              const text = content.trim()
              if (!text) return

              const chat: ChatMessage = {
                id: crypto.randomUUID(),
                type: "chat",
                username:
                  user.user_metadata?.full_name ||
                  user.email?.split("@")[0] ||
                  "User",
                content: text,
                timestamp: new Date(),
                role: myRole,
                user_id: user.id,
              }

              // ✅ Tambahkan chat ke state lokal (optimistic update)
              setChatMessages((prev) => [...prev, chat])
              
              // ✅ Kirim ke server untuk broadcast ke user lain
              send("chat", { content: text })
            }}
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
