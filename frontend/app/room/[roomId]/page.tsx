"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Mic, MicOff, Users, Radio, LogOut } from "lucide-react"
import { getAccessToken } from "@/lib/auth"
import { useUser } from "@/hooks/use-user"

type ApiParticipant = {
  user_id: string
  username: string
  role: "host" | "speaker" | "listener"
}

type Participant = {
  id: string
  name: string
  role: "host" | "speaker" | "listener"
}

export default function RoomPage() {
  const { roomId } = useParams() as { roomId: string }
  const router = useRouter()
  const { user } = useUser()

  const wsRef = useRef<WebSocket | null>(null)

  const [roomTitle, setRoomTitle] = useState("")
  const [participants, setParticipants] = useState<Participant[]>([])
  const [isHost, setIsHost] = useState(false)
  const [status, setStatus] = useState<"connecting" | "connected">("connecting")
  const [isMuted, setIsMuted] = useState(false)

  async function fetchRoom() {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/rooms/${roomId}`
    )
    return res.json()
  }

  useEffect(() => {
    if (!roomId) {
      router.push("/")
      return
    }

    async function init() {
      const data = await fetchRoom()

      setRoomTitle(data.title)
      setParticipants(
        data.participants.map((p: ApiParticipant) => ({
          id: p.user_id,
          name: p.username,
          role: p.role,
        }))
      )
      setIsHost(data.host_id === user?.id)
      setStatus("connected")

      const token = await getAccessToken()

      wsRef.current = new WebSocket(
        `${process.env.NEXT_PUBLIC_WS_URL}/ws?roomId=${roomId}`,
        ["authorization", token!]
      )

      wsRef.current.onmessage = async (e) => {
        const msg = JSON.parse(e.data)

        if (msg.type === "join" || msg.type === "leave") {
          const data = await fetchRoom()
          setParticipants(
            data.participants.map((p: ApiParticipant) => ({
              id: p.user_id,
              name: p.username,
              role: p.role,
            }))
          )
        }

        if (msg.type === "room-ended") {
          alert("Room ended")
          router.push("/")
        }
      }
    }

    init()

    return () => {
      wsRef.current?.close()
    }
  }, [roomId])

  async function leaveRoom() {
    const token = await getAccessToken()

    await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/rooms/${roomId}/leave`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }
    )

    wsRef.current?.close()
    router.push("/")
  }

  function toggleMute() {
    setIsMuted(v => !v)

    wsRef.current?.send(
      JSON.stringify({
        type: isMuted ? "mic-on" : "mic-off",
        room_id: roomId,
      })
    )
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex gap-3 items-center">
            <Radio className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl font-bold">{roomTitle}</h1>
              <Badge>{status === "connected" ? "Live" : "Connecting…"}</Badge>
            </div>
          </div>

          <Button variant="destructive" onClick={leaveRoom}>
            <LogOut className="h-4 w-4 mr-2" />
            Leave
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Main Stage</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <Avatar className="h-24 w-24">
              <AvatarFallback>
                {isHost ? "🎙️" : "👤"}
              </AvatarFallback>
            </Avatar>

            <Button
              size="lg"
              variant={isMuted ? "destructive" : "default"}
              onClick={toggleMute}
            >
              {isMuted ? <MicOff /> : <Mic />}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Participants ({participants.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {participants.map(p => (
              <div
                key={p.id}
                className="flex justify-between items-center"
              >
                <span>{p.name}</span>
                <Badge>{p.role}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
