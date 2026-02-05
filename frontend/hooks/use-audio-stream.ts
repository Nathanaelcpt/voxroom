import { useEffect, useRef, useState, useCallback } from "react"

interface UseAudioStreamProps {
  isHost: boolean
  canSpeak: boolean
  isMuted: boolean
  isConnected: boolean
  sendAudioChunk: (chunk: ArrayBuffer) => void
  playbackVolume: number
}

export function useAudioStream({
  canSpeak,
  isMuted,
  isConnected,
  sendAudioChunk,
  playbackVolume,
}: UseAudioStreamProps) {
  const [isCapturing, setIsCapturing] = useState(false)
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null)

  const audioContextRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)

  useEffect(() => {
    if (!canSpeak || !isConnected) return

    let stream: MediaStream | null = null

    async function start() {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      setMediaStream(stream)
      setIsCapturing(true)

      // 🔥 HARD RESET CONTEXT
      if (audioContextRef.current) {
        await audioContextRef.current.close().catch(() => {})
      }

      const ctx = new AudioContext()
      audioContextRef.current = ctx

      const source = ctx.createMediaStreamSource(stream)
      sourceRef.current = source

      const processor = ctx.createScriptProcessor(2048, 1, 1)
      processorRef.current = processor

      processor.onaudioprocess = (e) => {
        if (!isMuted && isConnected) {
          const input = e.inputBuffer.getChannelData(0)
          sendAudioChunk(new Float32Array(input).buffer)
        }
      }

      source.connect(processor)
      processor.connect(ctx.destination)
    }

    start()

    return () => {
      stream?.getTracks().forEach(t => t.stop())
      processorRef.current?.disconnect()
      sourceRef.current?.disconnect()
      audioContextRef.current?.close().catch(() => {})
      audioContextRef.current = null
      setIsCapturing(false)
      setMediaStream(null)
    }
  }, [canSpeak, isMuted, isConnected, sendAudioChunk])

  // 🔊 playback
  const playAudioChunk = useCallback(
    (userId: string, data: ArrayBuffer) => {
      const ctx = new AudioContext()
      const gain = ctx.createGain()
      gain.gain.value = playbackVolume
      gain.connect(ctx.destination)

      const buffer = ctx.createBuffer(1, data.byteLength / 4, ctx.sampleRate)
      buffer.copyToChannel(new Float32Array(data), 0)

      const src = ctx.createBufferSource()
      src.buffer = buffer
      src.connect(gain)
      src.start()

      src.onended = () => ctx.close()
    },
    [playbackVolume]
  )

  return {
    isCapturing,
    mediaStream,
    playAudioChunk,
    setPlaybackVolume: (v: number) => {},
  }
}
