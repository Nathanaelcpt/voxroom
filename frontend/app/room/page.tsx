"use client";

import { useRouter } from "next/navigation";

export default function RoomPage() {
  const router = useRouter();

  function joinRoom() {
    const token = localStorage.getItem("token");
    if (!token) {
      alert("Silakan login terlebih dahulu");
      return;
    }

    alert("Nanti masuk room live (belum aktif)");
  }

  return (
    <main className="p-6">
      <h2 className="text-xl font-bold mb-4">Live Rooms</h2>

      {/* Dummy Room */}
      <div className="border border-zinc-700 p-4 rounded mb-4">
        <p className="font-semibold">🎙️ Podcast Malam Jumat</p>
        <button
          onClick={joinRoom}
          className="mt-2 bg-blue-600 px-3 py-1 rounded"
        >
          Join Room
        </button>
      </div>
    </main>
  );
}
