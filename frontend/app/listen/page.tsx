"use client";

import { useEffect, useRef } from "react";

const API = process.env.NEXT_PUBLIC_API_URL!;

export default function ListenPage() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    async function start() {
      console.log("🎧 Listener starting...");

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      pcRef.current = pc;

      // 🔥 WAJIB: deklarasi mau terima audio
      pc.addTransceiver("audio", { direction: "recvonly" });

      pc.ontrack = (event) => {
        console.log("🎧 Audio track received");
        if (audioRef.current) {
          audioRef.current.srcObject = event.streams[0];
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log("ICE:", pc.iceConnectionState);
      };

      // Buat offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Kirim offer ke backend
      const res = await fetch(`${API}/webrtc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: "listener-1",
          role: "listener",
          signal: {
            type: "offer",
            data: offer,
          },
        }),
      });

      const answerMsg = await res.json();

      // Set answer dari backend
      await pc.setRemoteDescription(answerMsg.data);

      console.log("🎧 Listener connected");
    }

    start();

    // Cleanup
    return () => {
      pcRef.current?.close();
      pcRef.current = null;
    };
  }, []);

  return (
    <main className="p-6">
      <h1 className="text-xl font-bold mb-4">Listener</h1>

      <audio
        ref={audioRef}
        autoPlay
        controls
        className="w-full max-w-md"
      />
    </main>
  );
}
