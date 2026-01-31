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

  // ✅ Store all callbacks in refs — prevents useEffect from re-running
  const onMessageRef = useRef(onMessage)
  const onOpenRef = useRef(onOpen)
  const onCloseRef = useRef(onClose)
  const onErrorRef = useRef(onError)

  // ✅ Keep refs in sync on every render, WITHOUT triggering useEffect
  useEffect(() => {
    onMessageRef.current = onMessage
    onOpenRef.current = onOpen
    onCloseRef.current = onClose
    onErrorRef.current = onError
  })

  // ✅ useEffect only depends on roomId now
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

        const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL}/ws?roomId=${roomId}&token=${token}`
        console.log("🔌 Connecting to WebSocket:", wsUrl.replace(token, "***"))

        const ws = new WebSocket(wsUrl)

        ws.addEventListener("open", () => {
          if (!mounted) return
          console.log("✅ WebSocket connected")
          setIsConnected(true)
          onOpenRef.current?.()   // ✅ call via ref
        })

        ws.addEventListener("message", (event) => {
          if (!mounted) return
          try {
            const message: WSMessage = JSON.parse(event.data)
            console.log("📨 WS message:", message)
            onMessageRef.current?.(message)  // ✅ call via ref
          } catch (err) {
            console.error("Failed to parse WS message:", err)
          }
        })

        ws.addEventListener("close", () => {
          if (!mounted) return
          console.log("🔌 WebSocket disconnected")
          setIsConnected(false)
          onCloseRef.current?.()  // ✅ call via ref
        })

        ws.addEventListener("error", (error) => {
          if (!mounted) return
          console.error("❌ WebSocket error:", error)
          onErrorRef.current?.(error)  // ✅ call via ref
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
  }, [roomId])  // ✅ ONLY roomId — no more callback deps

  const send = useCallback((type: WSMessageType, payload?: any) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn("⚠️ WebSocket not connected, cannot send message")
      return
    }
    const message: WSMessage = { type, payload }
    wsRef.current.send(JSON.stringify(message))
    console.log("📤 Sent message:", message)
  }, [])

  return { isConnected, send }
}