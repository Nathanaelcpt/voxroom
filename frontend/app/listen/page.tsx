"use client";

import { useEffect, useRef } from "react";

const WS = process.env.NEXT_PUBLIC_WS_URL!;

export default function ListenPage() {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    async function start() {
      const ws = new WebSocket(`${WS}/ws?room=room1&user=listener`);

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      pc.addTransceiver("audio", { direction: "recvonly" });

      pc.ontrack = (e) => {
        audioRef.current!.srcObject = e.streams[0];
      };

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

        if (msg.type === "offer") {
          await pc.setRemoteDescription(msg.payload);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          ws.send(
            JSON.stringify({
              type: "answer",
              payload: answer,
            })
          );
        }

        if (msg.type === "candidate") {
          await pc.addIceCandidate(msg.payload);
        }
      };
    }

    start();
  }, []);

  return (
    <main className="p-6">
      <h1 className="text-xl mb-4">Listener</h1>
      <audio ref={audioRef} autoPlay controls />
    </main>
  );
}
