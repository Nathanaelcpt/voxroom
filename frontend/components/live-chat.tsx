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
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
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

  const handleSend = () => {
    const text = message.trim()
    if (!text) return
    onSendMessage(text)
    setMessage("")
  }

  return (
    <Card className="flex flex-col h-full">
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
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
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

            const role = msg.role ?? "listener"
            const userId = msg.user_id ?? ""
            const isOwn = userId === currentUserId
            const isListener = role === "listener"

            return (
              <div key={msg.id} className="flex items-start gap-2 group">
                <UserAvatar
                  user={{
                    id: userId || msg.id,
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
                        roleColor[role]
                      )}
                    >
                      {msg.username}
                    </span>
                    <span className="opacity-60">{roleIcon[role]}</span>
                    <span className="ml-1 text-muted-foreground">
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>

                  <div className="text-sm wrap-break-word">{msg.content}</div>
                </div>

                {/* Host menu */}
                {isHost && !isOwn && isListener && onMakeSpeaker && userId && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100"
                      >
                        <MoreVertical className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => onMakeSpeaker(userId)}
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

        {/* Input */}
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
