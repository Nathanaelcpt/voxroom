"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AudioMeter } from "@/components/audio-meter"
import { AudioDeviceSelector } from "@/components/audio-device-selector"
import { VolumeControl } from "@/components/volume-control"
import { UserAvatar } from "@/components/user-avatar"
import { InviteFriendsModal } from "@/components/invite-friends-modal"
import { Mic, MicOff, Users, Radio, LogOut, Volume2, UserPlus, Settings } from "lucide-react"
import { useUser } from "@/hooks/use-user"
import { getRoomDetails, endRoom, inviteSpeaker, getParticipantsWithProfiles } from "@/lib/api/rooms"
import { useWebSocket } from "@/hooks/use-websocket"
import { useAudioStream } from "@/hooks/use-audio-stream"
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
  const [roomLoaded, setRoomLoaded] = useState(false)
  const [speakingUsers, setSpeakingUsers] = useState<Set<string>>(new Set())
  const [showSettings, setShowSettings] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [playbackVolume, setPlaybackVolume] = useState(1.5) // 150% default

  const canSpeak = myRole === "host" || myRole === "speaker"
  const isHost = myRole === "host"

  // STEP 1: Load room details
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

        // ✅ Get participants with profiles from backend
        try {
          const profilesData = await getParticipantsWithProfiles(roomId!)
          setParticipants(profilesData.participants)
        } catch (err) {
          console.warn("⚠️ Failed to load participant profiles, using basic data:", err)
          setParticipants(data.participants)
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

  // WebSocket message handler
  const handleWSMessage = useCallback(
    (message: WSMessage) => {
      switch (message.type) {
        case "role_assigned":
          if (message.payload?.role) {
            setMyRole(message.payload.role)
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

        case "audio":
          if (message.from && message.payload?.chunk) {
            const binary = atob(message.payload.chunk)
            const bytes = new Uint8Array(binary.length)
            for (let i = 0; i < binary.length; i++) {
              bytes[i] = binary.charCodeAt(i)
            }
            playAudioChunk(message.from, bytes.buffer)
          }
          break

        case "speaking":
          if (message.payload?.user_id !== undefined) {
            setSpeakingUsers((prev) => {
              const next = new Set(prev)
              if (message.payload.is_speaking) {
                next.add(message.payload.user_id)
              } else {
                next.delete(message.payload.user_id)
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
    [user, router]
  )

  // STEP 2: Connect WebSocket
  const { isConnected, send, sendAudioChunk } = useWebSocket({
    roomId: roomLoaded && roomId ? roomId : "",
    onMessage: handleWSMessage,
  })

  // STEP 3: Audio streaming with volume control
  const { micPermission, isCapturing, playAudioChunk, setPlaybackVolume: updatePlaybackVolume, mediaStream } = useAudioStream({
    isHost,
    canSpeak,
    isMuted,
    isConnected,
    sendAudioChunk,
    playbackVolume,
  })

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
      // Refresh participants with profiles
      const profilesData = await getParticipantsWithProfiles(roomId)
      setParticipants(profilesData.participants)
    } catch (err) {
      console.error("Failed to invite speaker:", err)
      alert("Gagal invite speaker")
    }
  }

  // Invite friend to room (placeholder - will implement WebSocket invitation later)
  async function handleInviteFriend(userId: string) {
    if (!isHost || !roomId) return

    try {
      // TODO: Send WebSocket invitation instead of direct invite
      console.log("📨 Sending invitation to:", userId)
      
      // For now, just show success message
      alert(`Invitation sent! (WebSocket invitation coming soon)`)
      
      setShowInviteModal(false)
    } catch (err) {
      console.error("Failed to invite friend:", err)
      throw err
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
      await endRoom(roomId!)
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
                  {room.listeners} listening
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
            <Button variant="outline" size="icon" onClick={() => setShowSettings(!showSettings)}>
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
                <UserAvatar user={user} size="lg" className="h-32 w-32 border-4 border-primary text-4xl" />

                <div className="text-center">
                  <p className="text-lg font-semibold">
                    {isHost ? "You're Live!" : canSpeak ? "You're a Speaker" : "Listening"}
                  </p>
                  <Badge variant={isHost ? "default" : "secondary"}>{myRole}</Badge>
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
                      {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                    </Button>
                    <p className="text-sm text-muted-foreground">
                      {isMuted ? "Tap to unmute" : "Tap to mute"}
                    </p>
                  </>
                )}
              </div>

              {/* Audio Meter */}
              {canSpeak && isCapturing && (
                <AudioMeter stream={mediaStream} label={`Your Audio (${isMuted ? "Muted" : "Live"})`} />
              )}

              {/* Settings Panel */}
              {showSettings && (
                <div className="space-y-4">
                  {!canSpeak && <VolumeControl volume={playbackVolume} onChange={handleVolumeChange} />}
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
                  const isSpeaking = speakingUsers.has(participant.user_id)
                  const displayName = isMe ? "You" : (participant.full_name || participant.username || participant.email?.split("@")[0] || `User ${participant.user_id.slice(0, 6)}`)

                  return (
                    <div
                      key={participant.user_id}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
                    >
                      <UserAvatar 
                        user={{
                          id: participant.user_id,
                          email: participant.email,
                          user_metadata: {
                            avatar_url: participant.avatar_url,
                            full_name: participant.full_name,
                          }
                        }} 
                      />

                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{displayName}</p>
                        <Badge variant={participant.role === "host" ? "default" : "secondary"} className="text-xs">
                          {participant.role}
                        </Badge>
                      </div>

                      <div>
                        {participant.role !== "listener" ? (
                          <Volume2 className={`h-4 w-4 ${isSpeaking ? "text-green-500 animate-pulse" : "text-muted-foreground"}`} />
                        ) : (
                          <Mic className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>

                      {isHost && !isMe && participant.role === "listener" && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleInviteSpeaker(participant.user_id)}
                        >
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

      {/* Invite Friends Modal */}
      {isHost && room && (
        <InviteFriendsModal
          open={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          roomId={roomId!}
          roomTitle={room.title}
          onInvite={handleInviteFriend}
        />
      )}
    </div>
  )
}
