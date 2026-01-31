// components/audio-meter.tsx

"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Mic } from "lucide-react"

interface AudioMeterProps {
  stream: MediaStream | null
  label?: string
  showDeviceInfo?: boolean
}

export function AudioMeter({ stream, label = "Microphone Level", showDeviceInfo = false }: AudioMeterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const [deviceLabel, setDeviceLabel] = useState<string>("")
  const [avgLevel, setAvgLevel] = useState<number>(0)

  useEffect(() => {
    if (!stream) {
      // Cleanup if stream removed
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
      return
    }

    // Get device label
    const audioTrack = stream.getAudioTracks()[0]
    if (audioTrack) {
      setDeviceLabel(audioTrack.label || "Unknown Microphone")
    }

    // Create audio context and analyser
    const audioContext = new AudioContext()
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.8

    const source = audioContext.createMediaStreamSource(stream)
    source.connect(analyser)

    audioContextRef.current = audioContext
    analyserRef.current = analyser

    // Start visualization
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dataArray = new Uint8Array(analyser.frequencyBinCount)

    function draw() {
      if (!analyserRef.current || !ctx || !canvas) return

      animationFrameRef.current = requestAnimationFrame(draw)

      // Get frequency data
      analyserRef.current.getByteFrequencyData(dataArray)

      // Calculate average level
      const sum = dataArray.reduce((a, b) => a + b, 0)
      const avg = sum / dataArray.length
      const normalizedLevel = avg / 255 // 0 to 1

      setAvgLevel(normalizedLevel)

      // Clear canvas
      ctx.fillStyle = "rgb(15, 15, 15)" // bg-background
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Draw bars
      const barWidth = canvas.width / dataArray.length
      let x = 0

      for (let i = 0; i < dataArray.length; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height

        // Color based on level (green → yellow → red)
        let hue = 120 // green
        if (normalizedLevel > 0.7) {
          hue = 0 // red
        } else if (normalizedLevel > 0.5) {
          hue = 60 // yellow
        }

        ctx.fillStyle = `hsl(${hue}, 100%, 50%)`
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight)

        x += barWidth
      }

      // Draw peak indicator
      const peakY = canvas.height - (normalizedLevel * canvas.height)
      ctx.strokeStyle = normalizedLevel > 0.8 ? "#ef4444" : "#22c55e"
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(0, peakY)
      ctx.lineTo(canvas.width, peakY)
      ctx.stroke()
    }

    draw()

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [stream])

  if (!stream) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Mic className="h-4 w-4" />
            {label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
            No audio input detected
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Mic className="h-4 w-4" />
          {label}
        </CardTitle>
        {showDeviceInfo && deviceLabel && (
          <p className="text-xs text-muted-foreground truncate">{deviceLabel}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <canvas
          ref={canvasRef}
          width={300}
          height={80}
          className="w-full rounded-md border bg-background"
        />
        
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Level:</span>
          <div className="flex items-center gap-2">
            <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  avgLevel > 0.8
                    ? "bg-red-500"
                    : avgLevel > 0.5
                    ? "bg-yellow-500"
                    : "bg-green-500"
                }`}
                style={{ width: `${avgLevel * 100}%` }}
              />
            </div>
            <span className="font-mono w-12 text-right">
              {Math.round(avgLevel * 100)}%
            </span>
          </div>
        </div>

        {avgLevel < 0.05 && (
          <p className="text-xs text-amber-600 dark:text-amber-500">
            ⚠️ Audio level very low - check microphone
          </p>
        )}
        
        {avgLevel > 0.95 && (
          <p className="text-xs text-red-600 dark:text-red-500">
            ⚠️ Audio level too high - reduce gain
          </p>
        )}
      </CardContent>
    </Card>
  )
}
