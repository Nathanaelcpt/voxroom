"use client";

import { useEffect } from "react";

const API = process.env.NEXT_PUBLIC_API_URL!;

export default function SpeakPage() {
  useEffect(() => {
    async function start() {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      // 🎤 Ambil mic
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const res = await fetch(`${API}/webrtc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: "speaker-1",
          role: "speaker",
          signal: {
            type: "offer",
            data: offer,
          },
        }),
      });

      const answer = await res.json();
      await pc.setRemoteDescription(answer.data);

      console.log("🎙️ Speaker connected");
    }

    start();
  }, []);

  return <div className="p-6">🎙️ Speaking...</div>;
}
