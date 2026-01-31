// components/volume-control.tsx

"use client"

import { Volume2, VolumeX } from "lucide-react"
import { Slider } from "@/components/ui/slider"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface VolumeControlProps {
  volume: number // 0 to 2
  onChange: (volume: number) => void
}

export function VolumeControl({ volume, onChange }: VolumeControlProps) {
  const percentage = Math.round(volume * 100)
  const isMuted = volume === 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          {isMuted ? (
            <VolumeX className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
          Playback Volume
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Slider
          value={[volume]}
          onValueChange={(values) => onChange(values[0])}
          min={0}
          max={2}
          step={0.1}
          className="w-full"
        />
        
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>0%</span>
          <span className="font-medium text-foreground">{percentage}%</span>
          <span>200%</span>
        </div>

        {volume > 1.5 && (
          <p className="text-xs text-amber-600 dark:text-amber-500">
            ⚠️ High volume may cause distortion
          </p>
        )}

        {volume < 0.5 && volume > 0 && (
          <p className="text-xs text-muted-foreground">
            Volume is low - increase for better audio
          </p>
        )}
      </CardContent>
    </Card>
  )
}
