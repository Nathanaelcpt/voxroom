// components/audio-device-selector.tsx

"use client"

import { useEffect, useState } from "react"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Mic, Volume2 } from "lucide-react"

interface AudioDeviceSelectorProps {
  onInputDeviceChange?: (deviceId: string) => void
  onOutputDeviceChange?: (deviceId: string) => void
  showOutput?: boolean
}

interface MediaDeviceInfo {
  deviceId: string
  label: string
  kind: "audioinput" | "audiooutput"
}

export function AudioDeviceSelector({
  onInputDeviceChange,
  onOutputDeviceChange,
  showOutput = false,
}: AudioDeviceSelectorProps) {
  const [inputDevices, setInputDevices] = useState<MediaDeviceInfo[]>([])
  const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedInput, setSelectedInput] = useState<string>("")
  const [selectedOutput, setSelectedOutput] = useState<string>("")
  const [permission, setPermission] = useState<"granted" | "denied" | "prompt">("prompt")

  useEffect(() => {
    async function loadDevices() {
      try {
        // Request permission first
        await navigator.mediaDevices.getUserMedia({ audio: true })
        setPermission("granted")

        // Get all devices
        const devices = await navigator.mediaDevices.enumerateDevices()

        const inputs = devices
          .filter((d) => d.kind === "audioinput")
          .map((d) => ({
            deviceId: d.deviceId,
            label: d.label || `Microphone ${d.deviceId.slice(0, 5)}`,
            kind: "audioinput" as const,
          }))

        const outputs = devices
          .filter((d) => d.kind === "audiooutput")
          .map((d) => ({
            deviceId: d.deviceId,
            label: d.label || `Speaker ${d.deviceId.slice(0, 5)}`,
            kind: "audiooutput" as const,
          }))

        setInputDevices(inputs)
        setOutputDevices(outputs)

        // Set default selections
        if (inputs.length > 0 && !selectedInput) {
          setSelectedInput(inputs[0].deviceId)
        }
        if (outputs.length > 0 && !selectedOutput) {
          setSelectedOutput(outputs[0].deviceId)
        }
      } catch (err) {
        console.error("Failed to enumerate devices:", err)
        setPermission("denied")
      }
    }

    loadDevices()

    // Listen for device changes (e.g., plugging in headphones)
    navigator.mediaDevices.addEventListener("devicechange", loadDevices)

    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", loadDevices)
    }
  }, [selectedInput, selectedOutput])

  function handleInputChange(deviceId: string) {
    setSelectedInput(deviceId)
    onInputDeviceChange?.(deviceId)
  }

  function handleOutputChange(deviceId: string) {
    setSelectedOutput(deviceId)
    onOutputDeviceChange?.(deviceId)
  }

  if (permission === "denied") {
    return (
      <div className="text-sm text-destructive">
        ❌ Microphone permission denied. Please enable in browser settings.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Input Device */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Mic className="h-4 w-4" />
          Microphone Input
        </Label>
        <Select value={selectedInput} onValueChange={handleInputChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select microphone" />
          </SelectTrigger>
          <SelectContent>
            {inputDevices.map((device) => (
              <SelectItem key={device.deviceId} value={device.deviceId}>
                {device.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Output Device (optional) */}
      {showOutput && (
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Volume2 className="h-4 w-4" />
            Speaker Output
          </Label>
          <Select value={selectedOutput} onValueChange={handleOutputChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select speaker" />
            </SelectTrigger>
            <SelectContent>
              {outputDevices.map((device) => (
                <SelectItem key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  )
}
