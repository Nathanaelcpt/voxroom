"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { AudioMeter } from "@/components/audio-meter"
import { AudioDeviceSelector } from "@/components/audio-device-selector"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AlertCircle, Mic } from "lucide-react"
import { createRoom } from "@/lib/api/rooms"
import type { CreateRoomRequest } from "@/app/types/room"


interface AudioDevice {
  deviceId: string
  label: string
}

export default function GoLiveSetupPage() {
  const router = useRouter()

  const [title, setTitle] = useState("")
  const [devices, setDevices] = useState<AudioDevice[]>([])
  const [selectedMic, setSelectedMic] = useState("")
  const [permissionError, setPermissionError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [testStream, setTestStream] = useState<MediaStream | null>(null)

  // Load audio devices
  useEffect(() => {
    async function loadDevices() {
      try {
        // Request microphone permission
        await navigator.mediaDevices.getUserMedia({ audio: true })

        // Get all audio input devices
        const allDevices = await navigator.mediaDevices.enumerateDevices()
        const audioInputs = allDevices
          .filter((d) => d.kind === "audioinput")
          .map((d) => ({
            deviceId: d.deviceId,
            label: d.label || `Microphone ${d.deviceId.slice(0, 5)}`,
          }))

        setDevices(audioInputs)

        // Auto-select first device
        if (audioInputs.length > 0) {
          setSelectedMic(audioInputs[0].deviceId)
        }

        setPermissionError(null)
      } catch (err) {
        console.error("Failed to get audio devices:", err)
        setPermissionError(
          "Akses microphone ditolak. Silakan izinkan akses microphone di browser."
        )
      }
    }

    loadDevices()
    }, [])

      async function handleTestAudio() {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      setTestStream(stream)
    }

    return (
      <>
        <AudioDeviceSelector 
          showOutput={false}
          onInputDeviceChange={(deviceId) => console.log("Selected:", deviceId)}
        />
        
        <Button onClick={handleTestAudio}>Test Microphone</Button>
        
        <AudioMeter stream={testStream} label="Mic Test" showDeviceInfo />
      </>
    )

  async function handleGoLive() {
    // Validation
    if (!title.trim()) {
      alert("Judul room wajib diisi")
      return
    }

    if (!selectedMic) {
      alert("Microphone belum dipilih")
      return
    }

    setLoading(true)

    try {
      const data: CreateRoomRequest = { title: title.trim() }
      const response = await createRoom(data)

      console.log("✅ Room created:", response.room_id)
      console.log("🎤 Selected mic:", selectedMic)

      // Navigate to room
      router.push(`/room/${response.room_id}`)
    } catch (err) {
      console.error("Failed to create room:", err)
      alert(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat membuat room"
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5" />
            Setup Audio Streaming
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Permission Error */}
          {permissionError && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <p>{permissionError}</p>
            </div>
          )}

          {/* Room Title */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Judul Room</label>
            <Input
              placeholder="Contoh: Podcast Malam Jumat"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={loading}
              maxLength={100}
            />
            <p className="text-xs text-muted-foreground">
              {title.length}/100 karakter
            </p>
          </div>

          {/* Microphone Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Microphone</label>
            <Select
              value={selectedMic}
              onValueChange={setSelectedMic}
              disabled={devices.length === 0 || loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih microphone" />
              </SelectTrigger>
              <SelectContent>
                {devices.map((mic) => (
                  <SelectItem key={mic.deviceId} value={mic.deviceId}>
                    {mic.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {devices.length === 0 && !permissionError && (
              <p className="text-xs text-muted-foreground">
                Tidak ada microphone terdeteksi
              </p>
            )}
          </div>

          {/* Go Live Button */}
          <Button
            className="w-full"
            size="lg"
            disabled={loading || !title.trim() || !selectedMic}
            onClick={handleGoLive}
          >
            {loading ? "Creating Room..." : "Go Live 🎙️"}
          </Button>

          {/* Info */}
          <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            <p className="font-medium mb-1">ℹ️ Info:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Room akan otomatis live setelah dibuat</li>
              <li>Hanya kamu (host) yang bisa mengakhiri room</li>
              <li>Kamu bisa invite listener untuk jadi speaker</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}