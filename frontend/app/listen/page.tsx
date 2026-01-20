"use client";

import { useEffect, useRef } from "react";

const API = process.env.NEXT_PUBLIC_API_URL!;

export default function ListenPage() {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    async function start() {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      pc.ontrack = (e) => {
        if (audioRef.current) {
          audioRef.current.srcObject = e.streams[0];
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const res = await fetch(`${API}/webrtc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: "listener-1",
          signal: { type: "offer", data: offer },
        }),
      });

      const answerMsg = await res.json();
      await pc.setRemoteDescription(answerMsg.data);
    }

    start();
  }, []);

  return (
    <main className="p-6">
      <h1 className="text-xl font-bold mb-4">Listener</h1>
      <audio ref={audioRef} autoPlay controls />
    </main>
  );
}
