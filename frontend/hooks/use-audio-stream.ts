import { useEffect, useRef, useState, useCallback } from "react"

interface UseAudioStreamProps {
  isHost: boolean
  canSpeak: boolean
  isMuted: boolean
  isConnected: boolean
  sendAudioChunk: (chunk: ArrayBuffer) => void
  playbackVolume: number
}

interface AudioPlayer {
  audioContext: AudioContext
  gainNode: GainNode
  bufferQueue: ArrayBuffer[]
  isPlaying: boolean
  nextStartTime: number
  scheduledSourcesCount: number
}

const SAMPLE_RATE = 48000
const BUFFER_SIZE = 2048

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

  // ✅ Map untuk menyimpan audio player per user
  const audioPlayersRef = useRef<Map<string, AudioPlayer>>(new Map())

  /* ================= CAPTURE AUDIO (MIC) ================= */
  useEffect(() => {
    if (!canSpeak || !isConnected) return

    let stream: MediaStream | null = null
    let mounted = true

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: SAMPLE_RATE,
            channelCount: 1,
          },
        })

        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }

        setMediaStream(stream)
        setIsCapturing(true)

        // Close existing context if any
        if (audioContextRef.current) {
          await audioContextRef.current.close().catch(() => {})
        }

        const ctx = new AudioContext({ sampleRate: SAMPLE_RATE })
        audioContextRef.current = ctx

        const source = ctx.createMediaStreamSource(stream)
        sourceRef.current = source

        const processor = ctx.createScriptProcessor(BUFFER_SIZE, 1, 1)
        processorRef.current = processor

        processor.onaudioprocess = (e) => {
          if (!isMuted && isConnected) {
            const input = e.inputBuffer.getChannelData(0)
            
            // Convert Float32 to Int16 for better compression
            const int16 = new Int16Array(input.length)
            for (let i = 0; i < input.length; i++) {
              const s = Math.max(-1, Math.min(1, input[i]))
              int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
            }
            
            sendAudioChunk(int16.buffer)
          }
        }

        source.connect(processor)
        processor.connect(ctx.destination)
      } catch (err) {
        console.error("Failed to start audio capture:", err)
      }
    }

    start()

    return () => {
      mounted = false
      stream?.getTracks().forEach((t) => t.stop())
      processorRef.current?.disconnect()
      sourceRef.current?.disconnect()
      audioContextRef.current?.close().catch(() => {})
      audioContextRef.current = null
      setIsCapturing(false)
      setMediaStream(null)
    }
  }, [canSpeak, isMuted, isConnected, sendAudioChunk])

  /* ================= SCHEDULE BUFFER PLAYBACK ================= */
  const scheduleNextBuffer = useCallback((userId: string) => {
    const player = audioPlayersRef.current.get(userId)
    if (!player || !player.audioContext) return

    // Jika queue kosong, stop playing
    if (player.bufferQueue.length === 0) {
      player.isPlaying = false
      player.scheduledSourcesCount = 0
      return
    }

    // Ambil buffer dari queue
    const audioData = player.bufferQueue.shift()!
    player.isPlaying = true

    try {
      // Convert Int16 back to Float32
      const int16Array = new Int16Array(audioData)
      const float32Array = new Float32Array(int16Array.length)
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / (int16Array[i] < 0 ? 0x8000 : 0x7fff)
      }

      // Create audio buffer
      const audioBuffer = player.audioContext.createBuffer(
        1,
        float32Array.length,
        player.audioContext.sampleRate
      )
      audioBuffer.copyToChannel(float32Array, 0)

      // Create source
      const source = player.audioContext.createBufferSource()
      source.buffer = audioBuffer
      source.connect(player.gainNode)

      // ✅ KUNCI: Schedule dengan timing yang konsisten
      const currentTime = player.audioContext.currentTime
      const startTime = Math.max(currentTime, player.nextStartTime)

      source.start(startTime)
      player.scheduledSourcesCount++

      // Update next start time untuk kontinuitas
      player.nextStartTime = startTime + audioBuffer.duration

      // Schedule next buffer
      source.onended = () => {
        player.scheduledSourcesCount--
        if (player.bufferQueue.length > 0) {
          scheduleNextBuffer(userId)
        } else {
          player.isPlaying = false
        }
      }

      // ✅ Fallback: jika onended tidak dipanggil
      setTimeout(() => {
        if (player.isPlaying && player.bufferQueue.length > 0 && player.scheduledSourcesCount === 0) {
          scheduleNextBuffer(userId)
        }
      }, audioBuffer.duration * 1000 + 100)

    } catch (err) {
      console.error("Error scheduling audio buffer:", err)
      player.isPlaying = false
      
      // Retry dengan buffer berikutnya
      if (player.bufferQueue.length > 0) {
        setTimeout(() => scheduleNextBuffer(userId), 50)
      }
    }
  }, [])

  /* ================= PLAY AUDIO CHUNK ================= */
  const playAudioChunk = useCallback(
    (userId: string, audioData: ArrayBuffer) => {
      // ✅ Buat player baru jika belum ada untuk user ini
      if (!audioPlayersRef.current.has(userId)) {
        try {
          const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE })
          const gainNode = audioContext.createGain()
          gainNode.gain.value = playbackVolume
          gainNode.connect(audioContext.destination)

          audioPlayersRef.current.set(userId, {
            audioContext,
            gainNode,
            bufferQueue: [],
            isPlaying: false,
            nextStartTime: audioContext.currentTime,
            scheduledSourcesCount: 0,
          })
        } catch (err) {
          console.error("Failed to create audio player:", err)
          return
        }
      }

      const player = audioPlayersRef.current.get(userId)!

      // ✅ Tambahkan ke queue
      player.bufferQueue.push(audioData)

      // Limit queue size untuk mencegah lag
      if (player.bufferQueue.length > 10) {
        player.bufferQueue.shift() // Remove oldest
      }

      // ✅ Mulai playback jika belum
      if (!player.isPlaying) {
        scheduleNextBuffer(userId)
      }
    },
    [playbackVolume, scheduleNextBuffer]
  )

  /* ================= UPDATE PLAYBACK VOLUME ================= */
  const setPlaybackVolume = useCallback((volume: number) => {
    audioPlayersRef.current.forEach((player) => {
      if (player.gainNode) {
        player.gainNode.gain.value = volume
      }
    })
  }, [])

  /* ================= CLEANUP ON UNMOUNT ================= */
  useEffect(() => {
    return () => {
      // Cleanup semua audio players
      audioPlayersRef.current.forEach((player) => {
        if (player.audioContext) {
          player.audioContext.close().catch(() => {})
        }
      })
      audioPlayersRef.current.clear()
    }
  }, [])

  return {
    isCapturing,
    mediaStream,
    playAudioChunk,
    setPlaybackVolume,
  }
}
