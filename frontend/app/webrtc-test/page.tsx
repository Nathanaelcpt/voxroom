"use client";

import { useRef, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL!;

export default function WebRTCTestPage() {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [status, setStatus] = useState("idle");

  async function start() {
    setStatus("starting");

    // 1️⃣ ambil mic
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // 2️⃣ buat peer connection
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    pcRef.current = pc;

    // 3️⃣ kirim track audio ke peer
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    // 4️⃣ buat offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // 5️⃣ kirim offer ke backend
    const res = await fetch(`${API}/webrtc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: "test-user",
        signal: {
          type: "offer",
          data: offer,
        },
      }),
    });

    const answerMsg = await res.json();

    // 6️⃣ set answer dari backend
    await pc.setRemoteDescription(answerMsg.data);

    setStatus("connected");
    console.log("🎤 WebRTC connected");
  }

  return (
    <main className="p-6">
      <h1 className="text-xl font-bold mb-4">WebRTC Audio Test</h1>

      <button
        onClick={start}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        Start Mic
      </button>

      <p className="mt-4">Status: {status}</p>
    </main>
  );
}
