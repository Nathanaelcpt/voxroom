"use client";

import { useEffect } from "react";

const WS = process.env.NEXT_PUBLIC_WS_URL!;

export default function SpeakPage() {
  useEffect(() => {
    async function start() {
      const ws = new WebSocket(`${WS}/ws?room=room1&user=speaker`);

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          ws.send(
            JSON.stringify({
              type: "candidate",
              payload: e.candidate,
            })
          );
        }
      };

      ws.onmessage = async (e) => {
        const msg = JSON.parse(e.data);

        if (msg.type === "answer") {
          await pc.setRemoteDescription(msg.payload);
        }

        if (msg.type === "candidate") {
          await pc.addIceCandidate(msg.payload);
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: "offer",
            payload: offer,
          })
        );
      };
    }

    start();
  }, []);

  return <div className="p-6">🎙️ Speaking…</div>;
}
