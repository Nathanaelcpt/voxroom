"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Mic,
  Users,
  Radio,
  Loader2,
  UserPlus,
} from "lucide-react"

interface JoinRoomModalProps {
  open: boolean
  onClose: () => void
  room: {
    id: string
    title: string
    hostName?: string
    listeners: number
  }
  isFriendHost: boolean
  onJoin: (roomId: string, asSpeaker: boolean) => Promise<void>
}

export function JoinRoomModal({
  open,
  onClose,
  room,
  isFriendHost,
  onJoin,
}: JoinRoomModalProps) {
  const [joining, setJoining] = useState(false)

  async function handleJoin(asSpeaker: boolean) {
    setJoining(true)
    try {
      await onJoin(room.id, asSpeaker)
      onClose()
    } catch (err) {
      console.error(err)
      alert("Gagal bergabung ke room")
    } finally {
      setJoining(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-primary" />
            Join Room
          </DialogTitle>
          <DialogDescription>
            Pilih cara bergabung ke room
          </DialogDescription>
        </DialogHeader>

        {/* Room Info */}
        <div className="p-4 bg-muted rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold truncate">{room.title}</h3>
            {isFriendHost && (
              <Badge variant="secondary" className="gap-1 text-xs">
                <UserPlus className="h-3 w-3" />
                Teman
              </Badge>
            )}
          </div>

          {room.hostName && (
            <p className="text-sm text-muted-foreground">
              Host: {room.hostName}
            </p>
          )}

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="h-3 w-3" />
            {room.listeners} mendengarkan
          </div>
        </div>

        {/* Join Buttons */}
        <div className="space-y-3 py-4">
          {/* Listener */}
          <Button
            variant="outline"
            className="w-full h-auto p-4 flex items-center gap-3 justify-start"
            onClick={() => handleJoin(false)}
            disabled={joining}
          >
            <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center">
              <Users className="h-5 w-5" />
            </div>
            <div className="flex-1 text-left">
              <div className="font-semibold text-sm">
                Bergabung sebagai Listener
              </div>
              <div className="text-xs text-muted-foreground">
                Hanya mendengarkan
              </div>
            </div>
            {joining && <Loader2 className="h-4 w-4 animate-spin" />}
          </Button>

          {/* Speaker */}
          <Button
            variant="outline"
            className="w-full h-auto p-4 flex items-center gap-3 justify-start border-primary/50"
            onClick={() => handleJoin(true)}
            disabled={joining}
          >
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Mic className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 text-left">
              <div className="font-semibold text-sm">
                Bergabung sebagai Speaker
              </div>
              <div className="text-xs text-muted-foreground">
                {isFriendHost
                  ? "Langsung bisa bicara"
                  : "Perlu izin host"}
              </div>
            </div>
            {joining && <Loader2 className="h-4 w-4 animate-spin" />}
          </Button>
        </div>

        <Button
          variant="ghost"
          onClick={onClose}
          disabled={joining}
        >
          Batal
        </Button>
      </DialogContent>
    </Dialog>
  )
}
