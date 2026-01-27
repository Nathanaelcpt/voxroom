"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getAccessToken } from "@/lib/auth"

type AudioDevice = {
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

  useEffect(() => {
    async function loadDevices() {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true })

        const allDevices = await navigator.mediaDevices.enumerateDevices()
        const mics = allDevices
          .filter((d) => d.kind === "audioinput")
          .map((d) => ({
            deviceId: d.deviceId,
            label: d.label || "Unknown Microphone",
          }))

        setDevices(mics)
        if (mics.length > 0) {
          setSelectedMic(mics[0].deviceId)
        }
      } catch (err) {
        console.error(err)
        setPermissionError("Akses microphone ditolak")
      }
    }

    loadDevices()
  }, [])

  // 🆕 Helper function dengan retry logic
  async function fetchWithRetry(
    url: string,
    options: RequestInit,
    retries = 3,
    delay = 2000
  ): Promise<Response> {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, options)
        
        // Jika sukses, return
        if (response.ok) {
          return response
        }
        
        // Jika 503 (Service Unavailable) dan masih ada retry, tunggu dan coba lagi
        if (response.status === 503 && i < retries - 1) {
          console.log(`Server unavailable, retrying in ${delay}ms... (${i + 1}/${retries})`)
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
        
        // Jika error lain atau retry habis, return response
        return response
      } catch (error) {
        // Network error
        if (i < retries - 1) {
          console.log(`Network error, retrying in ${delay}ms... (${i + 1}/${retries})`)
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
        throw error
      }
    }
    
    throw new Error("Max retries reached")
  }

  async function startLive() {
    if (!title.trim()) {
      alert("Judul room wajib diisi")
      return
    }

    if (!selectedMic) {
      alert("Microphone belum dipilih")
      return
    }

    setLoading(true)

    const token = await getAccessToken()
    if (!token) {
      alert("Harus login")
      setLoading(false)
      return
    }

    try {
      // 🆕 Gunakan fetchWithRetry
      const res = await fetchWithRetry(
        process.env.NEXT_PUBLIC_API_URL + "/rooms",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title,
          }),
        },
        3, // max 3 retries
        2000 // delay 2 detik
      )

      if (!res.ok) {
        throw new Error("Gagal membuat room")
      }

      const data = await res.json()

      console.log("ROOM CREATED:", data.room_id)
      console.log("Selected mic:", selectedMic)

      router.push(`/room/${data.room_id}`)
    } catch (err) {
      console.error(err)
      // 🆕 Pesan error yang lebih informatif
      if (err instanceof Error && err.message.includes("503")) {
        alert("Server sedang maintenance. Silakan coba lagi dalam beberapa saat.")
      } else {
        alert("Terjadi kesalahan saat Go Live. Silakan coba lagi.")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Setup Audio</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {permissionError && (
            <p className="text-sm text-red-500">{permissionError}</p>
          )}

          {/* Judul Room */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Judul Room
            </label>
            <Input
              placeholder="Contoh: Podcast Malam Jumat"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Microphone */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Microphone
            </label>

            <Select
              value={selectedMic}
              onValueChange={setSelectedMic}
              disabled={devices.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih microphone" />
              </SelectTrigger>

              <SelectContent>
                {devices.map((mic) => (
                  <SelectItem
                    key={mic.deviceId}
                    value={mic.deviceId}
                  >
                    {mic.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            className="w-full"
            disabled={loading}
            onClick={startLive}
          >
            {loading ? "Going Live..." : "Go Live"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}