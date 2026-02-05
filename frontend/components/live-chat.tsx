// components/live-chat.tsx
"use client"

import { useEffect, useRef, useState } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { UserAvatar } from "@/components/user-avatar"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Send, Users, MessageCircle, Volume2, Mic } from "lucide-react"
import { cn } from "@/lib/utils"

interface ChatMessage {
  id: string
  type: "system" | "chat" | "event"
  username: string
  content: string
  timestamp: Date
  avatar_url?: string
  role?: "host" | "speaker" | "listener"
  event_type?: "join" | "leave" | "speaker_invited" | "mic_on" | "mic_off"
}

interface LiveChatProps {
  roomId: string
  currentUserId: string
  onSendMessage: (message: string) => void
  messages: ChatMessage[]
  participantCount: number
  canSpeak: boolean
}

export function LiveChat({
  roomId,
  currentUserId,
  onSendMessage,
  messages,
  participantCount,
  canSpeak,
}: LiveChatProps) {
  const [input, setInput] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (isAtBottom && scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, isAtBottom])

  // Check if user is at bottom
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement
    const threshold = 50
    const isBottom =
      target.scrollHeight - target.scrollTop - target.clientHeight < threshold
    setIsAtBottom(isBottom)
  }

  const handleSend = () => {
    if (!input.trim()) return
    onSendMessage(input.trim())
    setInput("")
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Live Chat</h3>
        </div>
        <Badge variant="secondary" className="gap-1">
          <Users className="h-3 w-3" />
          {participantCount}
        </Badge>
      </div>

      {/* Messages */}
      <ScrollArea
        className="flex-1 p-4"
        onScrollCapture={handleScroll}
      >
        <div className="space-y-3">
          {messages.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-8">
              <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No messages yet</p>
              <p className="text-xs mt-1">Say hello! 👋</p>
            </div>
          )}

          {messages.map((message) => (
            <ChatMessageItem key={message.id} message={message} />
          ))}

          {/* Auto-scroll anchor */}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={canSpeak ? "Send a message..." : "Listening only..."}
            disabled={!canSpeak && input === ""}
            maxLength={200}
            className="flex-1"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!input.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {input.length}/200 characters
        </p>
      </div>

      {/* Scroll to bottom indicator */}
      {!isAtBottom && (
        <button
          onClick={() => {
            setIsAtBottom(true)
            scrollRef.current?.scrollIntoView({ behavior: "smooth" })
          }}
          className="absolute bottom-24 right-8 bg-primary text-primary-foreground rounded-full p-2 shadow-lg hover:bg-primary/90 transition-all"
        >
          <MessageCircle className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

// Individual chat message component
function ChatMessageItem({ message }: { message: ChatMessage }) {
  const roleColors = {
    host: "text-yellow-500",
    speaker: "text-blue-500",
    listener: "text-muted-foreground",
  }

  const roleIcons = {
    host: "👑",
    speaker: "🎤",
    listener: "👂",
  }

  // System messages (user joined, left, etc.)
  if (message.type === "system" || message.type === "event") {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-1">
        {message.event_type === "join" && (
          <>
            <Users className="h-3 w-3" />
            <span>
              <span className="font-medium text-foreground">{message.username}</span>
              {" "}joined the room
            </span>
          </>
        )}

        {message.event_type === "leave" && (
          <>
            <Users className="h-3 w-3" />
            <span>
              <span className="font-medium text-foreground">{message.username}</span>
              {" "}left the room
            </span>
          </>
        )}

        {message.event_type === "speaker_invited" && (
          <>
            <Mic className="h-3 w-3 text-blue-500" />
            <span>
              <span className="font-medium text-foreground">{message.username}</span>
              {" "}is now a speaker
            </span>
          </>
        )}

        {message.event_type === "mic_on" && (
          <>
            <Volume2 className="h-3 w-3 text-green-500" />
            <span>
              <span className="font-medium text-foreground">{message.username}</span>
              {" "}started speaking
            </span>
          </>
        )}

        {message.event_type === "mic_off" && (
          <>
            <Volume2 className="h-3 w-3 text-muted-foreground" />
            <span>
              <span className="font-medium text-foreground">{message.username}</span>
              {" "}stopped speaking
            </span>
          </>
        )}
      </div>
    )
  }

  // Regular chat messages
  return (
    <div className="flex gap-2 items-start group hover:bg-muted/50 -mx-2 px-2 py-1 rounded-md transition-colors">
      <UserAvatar
        user={{
          id: message.id,
          email: "",
          user_metadata: {
            avatar_url: message.avatar_url,
            full_name: message.username,
          },
        }}
        size="sm"
        className="mt-0.5"
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 mb-0.5">
          <span
            className={cn(
              "text-sm font-semibold",
              message.role ? roleColors[message.role] : "text-foreground"
            )}
          >
            {message.username}
          </span>

          {message.role && (
            <span className="text-xs opacity-60">
              {roleIcons[message.role]}
            </span>
          )}

          <span className="text-xs text-muted-foreground ml-1">
            {formatMessageTime(message.timestamp)}
          </span>
        </div>

        <p className="text-sm text-foreground wrap-break-word">
          {message.content}
        </p>
      </div>
    </div>
  )
}

// Helper to format message timestamp
function formatMessageTime(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  if (diff < 60000) {
    return "just now"
  } else if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000)
    return `${minutes}m ago`
  } else {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    })
  }
}
