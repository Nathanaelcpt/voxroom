"use client";

import { useRouter } from "next/navigation";

const rooms = [
  {
    id: "1",
    title: "Podcast Malam Jumat",
    host: "andi",
    viewers: 12,
  },
  {
    id: "2",
    title: "Ngobrol Santai",
    host: "budi",
    viewers: 5,
  },
  {
    id: "3",
    title: "Tech Talk",
    host: "charlie",
    viewers: 2,
  },
];

export default function RoomPage() {
  const router = useRouter();

  function joinRoom(roomId: string) {
    const token = localStorage.getItem("token");
    if (!token) {
      alert("Silakan login terlebih dahulu");
      return;
    }

    alert(`Masuk room ${roomId} (live belum aktif)`);
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">Live Rooms</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {rooms.map((room) => (
          <div
            key={room.id}
            className="bg-[#18181b] rounded-lg overflow-hidden hover:ring-2 hover:ring-purple-600 transition"
          >
            {/* Thumbnail */}
            <div className="h-36 bg-linear-to-br from-purple-700 to-purple-900 flex items-center justify-center">
              <span className="text-sm text-white/80">LIVE</span>
            </div>

            {/* Info */}
            <div className="p-4">
              <h3 className="font-semibold">{room.title}</h3>
              <p className="text-sm text-zinc-400">
                Host: {room.host}
              </p>

              <div className="flex justify-between items-center mt-3">
                <span className="text-sm text-red-400">
                  ● {room.viewers} viewers
                </span>
                <button
                  onClick={() => joinRoom(room.id)}
                  className="bg-purple-600 px-3 py-1 rounded text-sm"
                >
                  Join
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
