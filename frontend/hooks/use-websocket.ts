// hooks/use-websocket.ts

import { useEffect, useRef, useState, useCallback } from "react"
import { getAccessToken } from "@/lib/auth"
import type { WSMessage, WSMessageType } from "@/app/types/websocket"

interface UseWebSocketOptions {
  roomId: string
  onMessage?: (message: WSMessage) => void
  onOpen?: () => void
  onClose?: () => void
  onError?: (error: Event) => void
}

export function useWebSocket({
  roomId,
  onMessage,
  onOpen,
  onClose,
  onError,
}: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  // Connect to WebSocket
  useEffect(() => {
    if (!roomId) {
    console.log("⏳ Waiting for roomId...")
    return
    }

    let mounted = true

    const connect = async () => {
      try {
        const token = await getAccessToken()
        if (!token) {
          console.error("❌ No token available for WebSocket")
          return
        }

        // ✅ Send token as query parameter instead of header
        const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL}/ws?roomId=${roomId}&token=${token}`
        
        console.log("🔌 Connecting to WebSocket:", wsUrl.replace(token, "***"))
        
        const ws = new WebSocket(wsUrl)

        ws.addEventListener("open", () => {
          if (!mounted) return

          console.log("✅ WebSocket connected")
          setIsConnected(true)
          onOpen?.()
        })

        ws.addEventListener("message", (event) => {
          if (!mounted) return

          try {
            const message: WSMessage = JSON.parse(event.data)
            console.log("📨 WS message:", message)
            onMessage?.(message)
          } catch (err) {
            console.error("Failed to parse WS message:", err)
          }
        })

        ws.addEventListener("close", () => {
          if (!mounted) return

          console.log("🔌 WebSocket disconnected")
          setIsConnected(false)
          onClose?.()
        })

        ws.addEventListener("error", (error) => {
          if (!mounted) return

          console.error("❌ WebSocket error:", error)
          onError?.(error)
        })

        wsRef.current = ws
      } catch (err) {
        console.error("Failed to connect WebSocket:", err)
      }
    }

    connect()

    return () => {
      mounted = false
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [roomId, onMessage, onOpen, onClose, onError])

  // Send message
  const send = useCallback((type: WSMessageType, payload?: any) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn("⚠️ WebSocket not connected, cannot send message")
      return
    }

    const message: WSMessage = { type, payload }
    wsRef.current.send(JSON.stringify(message))
    console.log("📤 Sent message:", message)
  }, [])

  return {
    isConnected,
    send,
  }
}