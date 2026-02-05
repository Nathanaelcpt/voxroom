// hooks/use-audio-stream.ts - FIXED AudioContext Management
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
  isHost,
  canSpeak,
  isMuted,
  isConnected,
  sendAudioChunk,
  playbackVolume,
}: UseAudioStreamProps) {
  const [micPermission, setMicPermission] = useState<PermissionState | null>(null)
  const [isCapturing, setIsCapturing] = useState(false)
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null)

  // Audio refs
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const playbackAudioContextsRef = useRef<Map<string, AudioContext>>(new Map())
  const playbackGainNodesRef = useRef<Map<string, GainNode>>(new Map())

  // ✅ FIXED: Track if AudioContext is active
  const isAudioContextActiveRef = useRef(false)

  // Request microphone permission and start capturing
  useEffect(() => {
    if (!canSpeak || !isConnected) {
      return
    }

    let stream: MediaStream | null = null

    async function startCapture() {
      try {
        console.log("🎤 Requesting microphone access...")
        
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 48000,
          },
        })

        console.log("✅ Microphone access granted")
        setMicPermission("granted")
        setMediaStream(stream)
        setIsCapturing(true)

        // ✅ FIXED: Create AudioContext only if not already active
        if (!isAudioContextActiveRef.current) {
          // Create AudioContext
          const audioContext = new AudioContext({ sampleRate: 48000 })
          audioContextRef.current = audioContext
          isAudioContextActiveRef.current = true

          // Create analyser for visualization
          const analyser = audioContext.createAnalyser()
          analyser.fftSize = 2048
          analyserRef.current = analyser

          // Create media stream source
          const source = audioContext.createMediaStreamSource(stream)
          mediaStreamSourceRef.current = source

          // Connect for visualization
          source.connect(analyser)

          // Create audio processor for sending chunks
          const processor = audioContext.createScriptProcessor(4096, 1, 1)
          processorRef.current = processor

          processor.onaudioprocess = (e) => {
            // Only send if not muted and connected
            if (!isMuted && isConnected) {
              const inputData = e.inputBuffer.getChannelData(0)
              const outputData = new Float32Array(inputData.length)
              outputData.set(inputData)

              // Convert to ArrayBuffer and send
              const buffer = outputData.buffer
              sendAudioChunk(buffer)
            }
          }

          // Connect processor
          source.connect(processor)
          processor.connect(audioContext.destination)

          console.log("✅ Audio processing started")
        }
      } catch (err) {
        console.error("❌ Microphone access denied:", err)
        setMicPermission("denied")
        setIsCapturing(false)
      }
    }

    startCapture()

    // Cleanup
    return () => {
      console.log("🧹 Cleaning up audio capture...")

      // Stop media stream
      if (stream) {
        stream.getTracks().forEach((track) => {
          track.stop()
          console.log("🛑 Stopped track:", track.kind)
        })
      }

      // Disconnect nodes
      if (processorRef.current) {
        processorRef.current.disconnect()
        processorRef.current.onaudioprocess = null
        processorRef.current = null
      }

      if (mediaStreamSourceRef.current) {
        mediaStreamSourceRef.current.disconnect()
        mediaStreamSourceRef.current = null
      }

      if (analyserRef.current) {
        analyserRef.current.disconnect()
        analyserRef.current = null
      }

      // ✅ FIXED: Close AudioContext safely
      if (audioContextRef.current && isAudioContextActiveRef.current) {
        const context = audioContextRef.current
        
        // Check if context is not already closed
        if (context.state !== "closed") {
          context.close().then(() => {
            console.log("✅ AudioContext closed")
            isAudioContextActiveRef.current = false
          }).catch((err) => {
            console.warn("⚠️ Error closing AudioContext:", err)
            isAudioContextActiveRef.current = false
          })
        } else {
          isAudioContextActiveRef.current = false
        }
        
        audioContextRef.current = null
      }

      setIsCapturing(false)
      setMediaStream(null)
    }
  }, [canSpeak, isConnected, isMuted, sendAudioChunk])

  // Play audio chunk from other users
  const playAudioChunk = useCallback(
    (userId: string, audioData: ArrayBuffer) => {
      try {
        // Get or create AudioContext for this user
        let context = playbackAudioContextsRef.current.get(userId)
        let gainNode = playbackGainNodesRef.current.get(userId)

        if (!context || context.state === "closed") {
          context = new AudioContext({ sampleRate: 48000 })
          playbackAudioContextsRef.current.set(userId, context)

          // Create gain node for volume control
          gainNode = context.createGain()
          gainNode.gain.value = playbackVolume
          gainNode.connect(context.destination)
          playbackGainNodesRef.current.set(userId, gainNode)
        }

        // Update volume
        if (gainNode) {
          gainNode.gain.value = playbackVolume
        }

        // Convert ArrayBuffer to AudioBuffer
        const float32Array = new Float32Array(audioData)
        const audioBuffer = context.createBuffer(1, float32Array.length, 48000)
        audioBuffer.copyToChannel(float32Array, 0)

        // Create buffer source and play
        const source = context.createBufferSource()
        source.buffer = audioBuffer
        
        if (gainNode) {
          source.connect(gainNode)
        } else {
          source.connect(context.destination)
        }
        
        source.start()
      } catch (err) {
        console.error("❌ Error playing audio chunk:", err)
      }
    },
    [playbackVolume]
  )

  // Update playback volume
  const setPlaybackVolume = useCallback((volume: number) => {
    playbackGainNodesRef.current.forEach((gainNode) => {
      gainNode.gain.value = volume
    })
  }, [])

  // Cleanup playback contexts on unmount
  useEffect(() => {
    return () => {
      console.log("🧹 Cleaning up playback contexts...")
      
      playbackAudioContextsRef.current.forEach((context, userId) => {
        if (context.state !== "closed") {
          context.close().catch((err) => {
            console.warn(`⚠️ Error closing playback context for ${userId}:`, err)
          })
        }
      })
      
      playbackAudioContextsRef.current.clear()
      playbackGainNodesRef.current.clear()
    }
  }, [])

  return {
    micPermission,
    isCapturing,
    mediaStream,
    playAudioChunk,
    setPlaybackVolume,
  }
}
