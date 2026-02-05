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
import type { RoomDetail, Participant, Role } from "@/app/types/room"
import type { WSMessage } from "@/app/types/websocket"
import type { ChatMessage } from "@/app/types/chat"
import { usePresence } from "@/hooks/use-presence"

export default function RoomPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useUser()

  const roomId = params?.roomId as string | undefined
  usePresence({ roomId })

  if (!roomId || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  const safeRoomId = roomId
  const safeUser = user

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

  /* LOAD ROOM */
  useEffect(() => {
    async function loadRoom() {
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
    }

    loadRoom().catch(() => router.push("/"))
  }, [safeRoomId, safeUser.id, router])

  /* WEBSOCKET */
  const handleWSMessage = useCallback(
    (message: WSMessage) => {
      const payload = message.payload
      if (!payload) return

      switch (message.type) {
        case "chat": {
        if (payload.user_id === safeUser.id) return

        const content =
          typeof payload.content === "string"
            ? payload.content
            : ""

        if (!content) return

        const chat: ChatMessage = {
          id: payload.message_id ?? crypto.randomUUID(),
          type: "chat",
          username: payload.username ?? "User",
          content, // ✅ SEKARANG STRING PASTI
          timestamp: new Date(payload.timestamp ?? Date.now()),
          avatar_url: payload.avatar_url,
          role: (payload.role as Role) ?? "listener",
          user_id: payload.user_id ?? "unknown",
        }

        setChatMessages((prev) => [...prev, chat])
        break
      }

      }
    },
    [safeUser.id]
  )

  const { isConnected, send, sendAudioChunk } = useWebSocket({
    roomId: roomLoaded ? safeRoomId : "",
    onMessage: handleWSMessage,
  })

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

  function handleToggleMic() {
    if (!canSpeak) return
    const next = !isMuted
    setIsMuted(next)
    send(next ? "mic_off" : "mic_on")
  }

  async function handleMakeSpeaker(userId: string) {
    if (!isHost) return
    await makeSpeaker(safeRoomId, userId)
  }

  async function handleEndRoom() {
    if (!isHost) return
    if (!confirm("Yakin ingin mengakhiri room?")) return
    await endRoom(safeRoomId)
    router.push("/")
  }

  if (!room) return null

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
              <UserAvatar user={safeUser} size="lg" />
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
            roomId={safeRoomId}
            currentUserId={safeUser.id}
            messages={chatMessages}
            participantCount={participantCount}
            isHost={isHost}
            onMakeSpeaker={handleMakeSpeaker}
            onSendMessage={(content) => {
              const text = content.trim()
              if (!text) return

              setChatMessages((prev) => [
                ...prev,
                {
                  id: crypto.randomUUID(),
                  type: "chat",
                  username:
                    safeUser.user_metadata?.full_name ||
                    safeUser.email?.split("@")[0] ||
                    "User",
                  content: text,
                  timestamp: new Date(),
                  avatar_url: safeUser.user_metadata?.avatar_url,
                  role: myRole,
                  user_id: safeUser.id,
                },
              ])

              send("chat", {
                content: text,
                username:
                  safeUser.user_metadata?.full_name ||
                  safeUser.email?.split("@")[0] ||
                  "User",
                avatar_url: safeUser.user_metadata?.avatar_url,
                role: myRole,
              })
            }}
          />
        </div>
      </div>

      {isHost && (
        <InviteFriendsModal
          open={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          roomId={safeRoomId}
          roomTitle={room.title}
          onInvite={async () => {}}
        />
      )}
    </div>
  )
}
