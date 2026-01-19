"use client";

import { useEffect, useState } from "react";

const WS = process.env.NEXT_PUBLIC_WS_URL!;

export default function RoomPage() {
  const [messages, setMessages] = useState<string[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const socket = new WebSocket(
      `${WS}/ws?room_id=room1&token=${token}`
    );

    socket.onopen = () => {
      console.log("WS CONNECTED");
    };

    socket.onmessage = (e) => {
      setMessages((prev) => [...prev, e.data]);
    };

    socket.onclose = () => console.log("WS CLOSED");

    setWs(socket);
    return () => socket.close();
  }, []);

  function sendTranscript() {
    ws?.send(
      JSON.stringify({
        type: "TRANSCRIPT",
        text: "halo dari frontend production",
      })
    );
  }

  return (
    <main className="p-6">
      <h1 className="text-xl font-bold mb-4">Room</h1>

      <button
        onClick={sendTranscript}
        className="bg-blue-600 text-white px-3 py-2 mb-4"
      >
        Send Transcript
      </button>

      <pre className="bg-gray-100 p-3">
        {messages.join("\n")}
      </pre>
    </main>
  );
}
