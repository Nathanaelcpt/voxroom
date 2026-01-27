"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect, useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Mic, MicOff, Users, Radio, LogOut, Volume2 } from "lucide-react"

type Participant = {
  id: string
  name: string
  role: "host" | "speaker" | "listener"
  isMuted: boolean
  isSpeaking: boolean
}

export default function RoomPage() {
  const params = useParams()
  const router = useRouter()
  
  // Fix: Handle null params
  const roomId = params?.roomId as string | undefined

  const [roomTitle, setRoomTitle] = useState("Loading...")
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected">("connecting")
  const [isMuted, setIsMuted] = useState(false)
  const [isHost, setIsHost] = useState(false)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [liveCount, setLiveCount] = useState(0)

  const localStreamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    // Guard: redirect jika roomId tidak ada
    if (!roomId) {
      router.push("/")
      return
    }

    async function init() {
      console.log("🎙️ Initializing room:", roomId)

      // TODO: Fetch room details from API
      setRoomTitle("Podcast Malam Jumat")
      setIsHost(true)
      setStatus("connected")

      // Mock participants for UI demo
      setParticipants([
        {
          id: "1",
          name: "You (Host)",
          role: "host",
          isMuted: false,
          isSpeaking: true,
        },
        {
          id: "2",
          name: "John Doe",
          role: "speaker",
          isMuted: false,
          isSpeaking: false,
        },
        {
          id: "3",
          name: "Jane Smith",
          role: "listener",
          isMuted: true,
          isSpeaking: false,
        },
      ])

      setLiveCount(3)

      // TODO: Get user's audio stream
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        localStreamRef.current = stream
        console.log("✅ Audio stream acquired")
      } catch (err) {
        console.error("❌ Failed to get audio:", err)
      }
    }

    init()

    return () => {
      // Cleanup
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [roomId, router])

  function toggleMute() {
    setIsMuted(!isMuted)
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = isMuted
      })
    }
  }

  function leaveRoom() {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop())
    }
    router.push("/")
  }

  function getStatusColor() {
    switch (status) {
      case "connected": return "bg-green-500"
      case "connecting": return "bg-yellow-500 animate-pulse"
      case "disconnected": return "bg-red-500"
    }
  }

  function getStatusText() {
    switch (status) {
      case "connected": return "Live"
      case "connecting": return "Connecting..."
      case "disconnected": return "Disconnected"
    }
  }

  // Guard: show loading jika belum ada roomId
  if (!roomId) {
    return null
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-background via-background to-muted p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Radio className="h-8 w-8 text-primary" />
              <div className={`absolute -top-1 -right-1 h-3 w-3 rounded-full ${getStatusColor()}`} />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{roomTitle}</h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="secondary" className="gap-1">
                  <Users className="h-3 w-3" />
                  {liveCount} listening
                </Badge>
                <span>•</span>
                <span>{getStatusText()}</span>
              </div>
            </div>
          </div>

          <Button variant="destructive" onClick={leaveRoom}>
            <LogOut className="h-4 w-4 mr-2" />
            Leave Room
          </Button>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Main Stage */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Live Stage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Host Controls */}
              <div className="flex flex-col items-center justify-center py-12 space-y-6">
                <div className="relative">
                  <div className={`absolute inset-0 rounded-full ${!isMuted ? 'bg-primary/20 animate-ping' : ''}`} />
                  <Avatar className="h-32 w-32 border-4 border-primary">
                    <AvatarFallback className="text-4xl">
                      {isHost ? "🎙️" : "👤"}
                    </AvatarFallback>
                  </Avatar>
                </div>

                <div className="text-center">
                  <p className="text-lg font-semibold">
                    {isHost ? "You're Live!" : "Listening"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isHost ? "Your audience is listening" : "Enjoying the conversation"}
                  </p>
                </div>

                {/* Mic Control */}
                <Button
                  size="lg"
                  variant={isMuted ? "destructive" : "default"}
                  className="rounded-full h-16 w-16 p-0"
                  onClick={toggleMute}
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
              </div>

              {/* Audio Visualizer Placeholder */}
              <div className="h-24 bg-muted rounded-lg flex items-center justify-center">
                <div className="flex gap-1 items-end h-16">
                  {[...Array(20)].map((_, i) => (
                    <div
                      key={i}
                      className={`w-2 bg-primary rounded-full transition-all ${
                        !isMuted ? 'animate-pulse' : 'opacity-30'
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
                {participants.map((participant) => (
                  <div
                    key={participant.id}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
                  >
                    <div className="relative">
                      <Avatar>
                        <AvatarFallback>
                          {participant.name[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {participant.isSpeaking && !participant.isMuted && (
                        <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-green-500 rounded-full border-2 border-background animate-pulse" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{participant.name}</p>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={participant.role === "host" ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {participant.role}
                        </Badge>
                      </div>
                    </div>

                    <div>
                      {participant.isMuted ? (
                        <MicOff className="h-4 w-4 text-muted-foreground" />
                      ) : participant.isSpeaking ? (
                        <Volume2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <Mic className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Room Info */}
        <Card>
          <CardHeader>
            <CardTitle>Room Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Room ID:</span>
              <code className="bg-muted px-2 py-1 rounded text-xs">{roomId}</code>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status:</span>
              <Badge variant={status === "connected" ? "default" : "secondary"}>
                {getStatusText()}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Your Role:</span>
              <Badge>{isHost ? "Host" : "Listener"}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}