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

/* ================= ROLE UI ================= */

const roleColor: Record<string, string> = {
  host: "text-yellow-500",
  speaker: "text-blue-500",
  listener: "text-muted-foreground",
}

const roleIcon: Record<string, string> = {
  host: "👑",
  speaker: "🎤",
  listener: "👂",
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

  /* ================= AUTOSCROLL ================= */
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
      {/* HEADER */}
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
        {/* ================= MESSAGES ================= */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {messages.map((msg) => {
            /* SYSTEM / EVENT MESSAGE */
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

            // 🔑 DEFENSIVE CHECK (INI PENTING)
            const isListener =
              msg.role !== "host" && msg.role !== "speaker"

            return (
              <div
                key={msg.id}
                className="flex items-start gap-2 group"
              >
                {/* AVATAR */}
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

                {/* MESSAGE BODY */}
                <div className="flex-1 min-w-0">
                  {/* USERNAME + ROLE */}
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
                  </div>

                  {/* MESSAGE CONTENT */}
                  <div className="text-sm wrap-break-word">
                    {msg.content}
                  </div>
                </div>

                {/* ================= HOST MENU (⋮) ================= */}
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
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
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

        {/* ================= INPUT ================= */}
        <div className="border-t p-3">
          <div className="flex gap-2">
            <Input
              placeholder="Ketik pesan..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSend()
              }}
            />
            <Button
              onClick={handleSend}
              disabled={!message.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
