"use client";

import { useEffect } from "react";

export default function Home() {
  useEffect(() => {
    console.log("API URL:", process.env.NEXT_PUBLIC_API_URL);
    console.log("WS URL:", process.env.NEXT_PUBLIC_WS_URL);
  }, []);

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold">VoxRoom</h1>

      <p className="mt-2 text-gray-600">
        API: {process.env.NEXT_PUBLIC_API_URL}
      </p>

      <p className="mt-1 text-gray-600">
        WS: {process.env.NEXT_PUBLIC_WS_URL}
      </p>
    </main>
  );
}
