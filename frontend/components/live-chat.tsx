"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { UserAvatar } from "@/components/user-avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Send,
  Users,
  MessageSquare,
  MoreVertical,
  Mic,
} from "lucide-react"
import type { ChatMessage } from "@/app/types/chat"
import { cn } from "@/lib/utils"

interface LiveChatProps {
  roomId: string
  currentUserId: string
  messages: ChatMessage[]
  participantCount: number
  isHost?: boolean
  onSendMessage: (message: string) => void
  onMakeSpeaker?: (userId: string) => void
}

const roleColor = {
  host: "text-yellow-500",
  speaker: "text-blue-500",
  listener: "text-muted-foreground",
}

const roleIcon = {
  host: "👑",
  speaker: "🎤",
  listener: "👂",
}

function formatTime(date: Date) {
  const diff = Date.now() - date.getTime()
  if (diff < 60_000) return "just now"
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function LiveChat({
  messages,
  participantCount,
  currentUserId,
  isHost = false,
  onSendMessage,
  onMakeSpeaker,
}: LiveChatProps) {
  const [message, setMessage] = useState("")
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  function handleSend() {
    if (!message.trim()) return
    onSendMessage(message.trim())
    setMessage("")
  }

  return (
    <Card className="flex flex-col h-full min-h-105">
      <CardHeader className="border-b py-3">
        <CardTitle className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Live Chat
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="h-3 w-3" />
            {participantCount}
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0">
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {messages.map((msg) => {
            if (msg.type !== "chat") {
              return (
                <div
                  key={msg.id}
                  className="text-center text-xs text-muted-foreground"
                >
                  {msg.content || msg.event_type}
                </div>
              )
            }

            const isOwn = msg.user_id === currentUserId
            const isListener =
              msg.role !== "host" && msg.role !== "speaker"

            return (
              <div key={msg.id} className="flex items-start gap-2 group">
                <UserAvatar
                  user={{
                    id: msg.user_id || msg.id,
                    email: "",
                    user_metadata: {
                      avatar_url: msg.avatar_url,
                      full_name: msg.username,
                    },
                  }}
                  size="sm"
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 text-xs">
                    <span
                      className={cn(
                        "font-semibold truncate",
                        msg.role && roleColor[msg.role]
                      )}
                    >
                      {msg.username}
                    </span>
                    {msg.role && (
                      <span className="opacity-70">
                        {roleIcon[msg.role]}
                      </span>
                    )}
                    <span className="ml-1 text-[10px] text-muted-foreground">
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>

                  <div className="text-sm wrap-break-word">
                    {msg.content}
                  </div>
                </div>

                {isHost &&
                  !isOwn &&
                  isListener &&
                  onMakeSpeaker &&
                  msg.user_id && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => onMakeSpeaker(msg.user_id!)}
                          className="gap-2 text-xs"
                        >
                          <Mic className="h-3 w-3" />
                          Jadikan Speaker
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
              </div>
            )
          })}
          <div ref={endRef} />
        </div>

        <div className="border-t p-3">
          <div className="flex gap-2">
            <Input
              placeholder="Ketik pesan..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
            />
            <Button onClick={handleSend} disabled={!message.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
