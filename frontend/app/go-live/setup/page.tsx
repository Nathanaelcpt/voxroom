"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { AudioMeter } from "@/components/audio-meter"
import { AudioDeviceSelector } from "@/components/audio-device-selector"
import { AlertCircle, Mic } from "lucide-react"
import { createRoom } from "@/lib/api/rooms"
import type { CreateRoomRequest } from "@/app/types/room"

export default function GoLiveSetupPage() {
  const router = useRouter()

  const [title, setTitle] = useState("")
  const [selectedMicId, setSelectedMicId] = useState("")
  const [testStream, setTestStream] = useState<MediaStream | null>(null)
  const [permissionError, setPermissionError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [isTesting, setIsTesting] = useState(false)

  useEffect(() => {
    if (!selectedMicId) return

    let activeStream: MediaStream | null = null

    async function startTest() {
      try {
        if (testStream) {
          testStream.getTracks().forEach(t => t.stop())
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: { exact: selectedMicId },
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        })

        activeStream = stream
        setTestStream(stream)
        setIsTesting(true)
        setPermissionError(null)
      } catch (err) {
        console.error(err)
        setPermissionError("Gagal mengakses microphone.")
        setIsTesting(false)
      }
    }

    startTest()

    return () => {
      activeStream?.getTracks().forEach(t => t.stop())
    }
  }, [selectedMicId])

  async function handleGoLive() {
    if (!title.trim() || !selectedMicId) return
    setLoading(true)

    try {
      // 🔥 HARD RELEASE MIC (REALTEK FIX)
      if (testStream) {
        testStream.getTracks().forEach(t => t.stop())
        setTestStream(null)
      }

      // Force browser to release audio device
      await navigator.mediaDevices
        .getUserMedia({ audio: false })
        .catch(() => {})

      const data: CreateRoomRequest = { title: title.trim() }
      const res = await createRoom(data)

      localStorage.setItem("selectedMicId", selectedMicId)
      router.push(`/room/${res.room_id}`)
    } catch (err) {
      alert("Gagal membuat room")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5" />
            Setup Audio
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          {permissionError && (
            <div className="flex gap-2 text-sm text-red-600">
              <AlertCircle className="h-4 w-4" />
              {permissionError}
            </div>
          )}

          <Input
            placeholder="Judul Room"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <AudioDeviceSelector
            showOutput={false}
            onInputDeviceChange={setSelectedMicId}
          />

          {isTesting && testStream && (
            <AudioMeter stream={testStream} label="Mic Test" />
          )}

          <Button
            className="w-full"
            disabled={!title || !selectedMicId || loading}
            onClick={handleGoLive}
          >
            {loading ? "Creating..." : "Go Live 🎙️"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
