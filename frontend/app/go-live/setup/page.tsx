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

  // Auto-start mic test when device selected
  useEffect(() => {
    if (!selectedMicId) return

    async function startTest() {
      try {
        // Stop previous stream if exists
        if (testStream) {
          testStream.getTracks().forEach(track => track.stop())
        }

        // Start new stream with selected device
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: selectedMicId ? { exact: selectedMicId } : undefined,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 48000,
          },
        })

        setTestStream(stream)
        setIsTesting(true)
        setPermissionError(null)

        console.log("🎤 Testing mic:", selectedMicId)
      } catch (err) {
        console.error("Failed to start mic test:", err)
        setPermissionError("Gagal mengakses microphone. Periksa izin browser.")
        setTestStream(null)
        setIsTesting(false)
      }
    }

    startTest()

    // Cleanup on unmount or device change
    return () => {
      if (testStream) {
        testStream.getTracks().forEach(track => track.stop())
      }
    }
  }, [selectedMicId])

  async function handleGoLive() {
    // Validation
    if (!title.trim()) {
      alert("Judul room wajib diisi")
      return
    }

    if (!selectedMicId) {
      alert("Microphone belum dipilih")
      return
    }

    setLoading(true)

    try {
      // Stop test stream before going live
      if (testStream) {
        testStream.getTracks().forEach(track => track.stop())
        setTestStream(null)
      }

      const data: CreateRoomRequest = { title: title.trim() }
      const response = await createRoom(data)

      console.log("✅ Room created:", response.room_id)
      console.log("🎤 Selected mic:", selectedMicId)

      // Store selected mic in localStorage for room page
      localStorage.setItem("selectedMicId", selectedMicId)

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

          {/* Audio Device Selector */}
          <AudioDeviceSelector
            onInputDeviceChange={(deviceId) => {
              setSelectedMicId(deviceId)
              console.log("🎤 Mic selected:", deviceId)
            }}
            showOutput={false}
          />

          {/* Audio Meter (Live Test) */}
          {isTesting && (
            <AudioMeter
              stream={testStream}
              label="Microphone Test"
              showDeviceInfo={true}
            />
          )}

          {/* Go Live Button */}
          <Button
            className="w-full"
            size="lg"
            disabled={loading || !title.trim() || !selectedMicId}
            onClick={handleGoLive}
          >
            {loading ? "Creating Room..." : "Go Live 🎙️"}
          </Button>

          {/* Info */}
          <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            <p className="font-medium mb-1">ℹ️ Tips:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Test mic kamu dulu sebelum go live</li>
              <li>Level audio ideal: 50-80%</li>
              <li>Hindari background noise yang berlebihan</li>
              <li>Gunakan headset untuk audio lebih baik</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
