// components/join-room-modal.tsx
"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Mic, MicOff, Users, AlertCircle } from "lucide-react"

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
  const [loading, setLoading] = useState(false)
  const [selectedRole, setSelectedRole] = useState<"speaker" | "listener" | null>(null)

  async function handleJoin() {
    if (!selectedRole) return

    setLoading(true)
    try {
      await onJoin(room.id, selectedRole === "speaker")
      onClose()
    } catch (error) {
      console.error("Failed to join room:", error)
      alert(error instanceof Error ? error.message : "Failed to join room")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Join Room</DialogTitle>
          <DialogDescription>{room.title}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Room Info */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                {room.listeners} {room.listeners === 1 ? "listener" : "listeners"}
              </span>
            </div>
            {room.hostName && (
              <div className="text-sm text-muted-foreground">Host: {room.hostName}</div>
            )}
          </div>

          {/* Friend is Host Notice */}
          {isFriendHost && (
            <div className="flex items-start gap-2 p-3 bg-primary/10 rounded-lg border border-primary/20">
              <AlertCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-primary">Your friend is hosting!</p>
                <p className="text-muted-foreground mt-1">
                  You can join as a speaker to participate.
                </p>
              </div>
            </div>
          )}

          {/* Role Selection */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Choose how to join:</p>

            <div className="grid gap-2">
              {/* Speaker Option */}
              {isFriendHost && (
                <button
                  onClick={() => setSelectedRole("speaker")}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    selectedRole === "speaker"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2 rounded-lg ${
                        selectedRole === "speaker" ? "bg-primary" : "bg-muted"
                      }`}
                    >
                      <Mic
                        className={`h-5 w-5 ${
                          selectedRole === "speaker"
                            ? "text-primary-foreground"
                            : "text-muted-foreground"
                        }`}
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">Join as Speaker</p>
                        <Badge variant="secondary" className="text-xs">
                          Friend's room
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Speak and participate. Mic will be muted initially.
                      </p>
                    </div>
                  </div>
                </button>
              )}

              {/* Listener Option */}
              <button
                onClick={() => setSelectedRole("listener")}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  selectedRole === "listener"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`p-2 rounded-lg ${
                      selectedRole === "listener" ? "bg-primary" : "bg-muted"
                    }`}
                  >
                    <MicOff
                      className={`h-5 w-5 ${
                        selectedRole === "listener"
                          ? "text-primary-foreground"
                          : "text-muted-foreground"
                      }`}
                    />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">Join as Listener</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Listen only. Host can invite you to speak later.
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleJoin} disabled={!selectedRole || loading} className="flex-1">
            {loading ? "Joining..." : "Join Room"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
