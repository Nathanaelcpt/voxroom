"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type AudioDevice = {
  deviceId: string
  label: string
}

export default function GoLiveSetupPage() {
  const [devices, setDevices] = useState<AudioDevice[]>([])
  const [selectedMic, setSelectedMic] = useState<string>("")
  const [permissionError, setPermissionError] = useState<string | null>(null)

  useEffect(() => {
    async function loadDevices() {
      try {
        // minta permission dulu biar label kebaca
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

  function startLive() {
    console.log("GO LIVE")
    console.log("Selected mic:", selectedMic)

    // NEXT STEP:
    // - create room
    // - connect WS
    // - publish audio
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
            disabled={!selectedMic}
            onClick={startLive}
          >
            Go Live
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
