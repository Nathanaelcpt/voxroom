"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isLogin, setIsLogin] = useState(false);

  useEffect(() => {
    setIsLogin(!!localStorage.getItem("token"));
  }, []);

  return (
    <html lang="en">
      <body className="bg-[#0e0e10] text-white">
        {/* NAVBAR */}
        <header className="fixed top-0 left-0 right-0 h-14 bg-[#18181b] flex items-center justify-between px-6 border-b border-zinc-800 z-50">
          <div className="flex items-center gap-6">
            <span className="font-bold text-purple-400 text-lg">
              VoxRoom
            </span>
            <input
              placeholder="Search"
              className="hidden md:block bg-zinc-800 px-3 py-1 rounded text-sm outline-none"
            />
          </div>

          <div>
            {isLogin ? (
              <span className="text-sm text-green-400">Logged in</span>
            ) : (
              <Link
                href="/login"
                className="bg-purple-600 px-3 py-1 rounded text-sm"
              >
                Login
              </Link>
            )}
          </div>
        </header>

        {/* LAYOUT */}
        <div className="flex pt-14">
          {/* SIDEBAR */}
          <aside className="hidden md:block w-60 bg-[#18181b] h-[calc(100vh-56px)] border-r border-zinc-800 p-4">
            <h3 className="text-sm font-semibold mb-3 text-zinc-300">
              Live Channels
            </h3>

            <ul className="space-y-3 text-sm">
              <li className="flex justify-between">
                <span>🎙️ andi</span>
                <span className="text-red-400">12</span>
              </li>
              <li className="flex justify-between">
                <span>🎙️ budi</span>
                <span className="text-red-400">5</span>
              </li>
              <li className="flex justify-between">
                <span>🎙️ charlie</span>
                <span className="text-red-400">2</span>
              </li>
            </ul>
          </aside>

          {/* MAIN CONTENT */}
          <main className="flex-1 p-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
