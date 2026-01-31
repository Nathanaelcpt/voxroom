// hooks/use-audio-stream.ts

import { useEffect, useRef, useState, useCallback } from "react"

interface UseAudioStreamOptions {
  isHost: boolean
  canSpeak: boolean
  isMuted: boolean
  isConnected: boolean
  sendAudioChunk: (chunk: ArrayBuffer) => void
  onAudioReceived?: (userId: string, audioData: ArrayBuffer) => void
}

export function useAudioStream({
  isHost,
  canSpeak,
  isMuted,
  isConnected,
  sendAudioChunk,
  onAudioReceived,
}: UseAudioStreamOptions) {
  const [micPermission, setMicPermission] = useState<"granted" | "denied" | "prompt">("prompt")
  const [isCapturing, setIsCapturing] = useState(false)

  // Refs for audio processing
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)

  // Audio playback refs (for listeners)
  const playbackContextRef = useRef<AudioContext | null>(null)
  const audioBuffersRef = useRef<Map<string, AudioBuffer[]>>(new Map())

  // Start capturing audio (for host/speaker)
  const startCapture = useCallback(async () => {
    if (!canSpeak || isCapturing) return

    try {
      console.log("🎤 Requesting microphone access...")
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
        },
      })

      mediaStreamRef.current = stream
      setMicPermission("granted")
      setIsCapturing(true)

      // Create audio context for processing
      const audioContext = new AudioContext({ sampleRate: 48000 })
      audioContextRef.current = audioContext

      const source = audioContext.createMediaStreamSource(stream)
      sourceRef.current = source

      // Use ScriptProcessorNode for audio capture
      // Note: ScriptProcessorNode is deprecated but still widely supported.
      // For production, consider migrating to AudioWorklet in the future.
      const processor = audioContext.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor

      processor.onaudioprocess = (e) => {
        if (isMuted || !isConnected) return

        const inputData = e.inputBuffer.getChannelData(0)
        
        // Convert Float32Array to Int16Array (PCM)
        const pcmData = new Int16Array(inputData.length)
        for (let i = 0; i < inputData.length; i++) {
          // Convert float (-1 to 1) to int16 (-32768 to 32767)
          const s = Math.max(-1, Math.min(1, inputData[i]))
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
        }

        // Send PCM audio chunk via WebSocket
        sendAudioChunk(pcmData.buffer)
      }

      source.connect(processor)
      processor.connect(audioContext.destination)

      console.log("✅ Audio capture started")
    } catch (err) {
      console.error("❌ Failed to start audio capture:", err)
      setMicPermission("denied")
      alert("Microphone access denied. Please allow microphone access in your browser settings.")
    }
  }, [canSpeak, isCapturing, isMuted, isConnected, sendAudioChunk])

  // Stop capturing audio
  const stopCapture = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop())
      mediaStreamRef.current = null
    }

    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect()
      sourceRef.current = null
    }

    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    setIsCapturing(false)
    console.log("🔇 Audio capture stopped")
  }, [])

  // Play received audio (for listeners)
  const playAudioChunk = useCallback(async (userId: string, audioData: ArrayBuffer) => {
    if (!playbackContextRef.current) {
      playbackContextRef.current = new AudioContext({ sampleRate: 48000 })
    }

    const context = playbackContextRef.current

    try {
      // Convert Int16Array back to Float32Array
      const pcmData = new Int16Array(audioData)
      const floatData = new Float32Array(pcmData.length)
      
      for (let i = 0; i < pcmData.length; i++) {
        floatData[i] = pcmData[i] / (pcmData[i] < 0 ? 0x8000 : 0x7FFF)
      }

      // Create audio buffer
      const audioBuffer = context.createBuffer(1, floatData.length, 48000)
      audioBuffer.getChannelData(0).set(floatData)

      // Create buffer source and play
      const source = context.createBufferSource()
      source.buffer = audioBuffer
      source.connect(context.destination)
      source.start()

      // Auto-cleanup after playback
      source.onended = () => {
        source.disconnect()
      }
    } catch (err) {
      console.error("❌ Failed to play audio chunk:", err)
    }
  }, [])

  // Auto-start/stop capture based on mute state
  useEffect(() => {
    if (!canSpeak) {
      stopCapture()
      return
    }

    if (!isMuted && isConnected) {
      startCapture()
    } else if (isMuted) {
      // Keep mic active but don't send chunks (handled in onaudioprocess)
      // This prevents audio glitches when toggling mute
      if (!isCapturing) {
        startCapture()
      }
    }
  }, [canSpeak, isMuted, isConnected, isCapturing, startCapture, stopCapture])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCapture()
      if (playbackContextRef.current) {
        playbackContextRef.current.close()
      }
    }
  }, [stopCapture])

  return {
    micPermission,
    isCapturing,
    playAudioChunk,
  }
}
