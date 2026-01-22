"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [isLogin, setIsLogin] = useState(false);

  useEffect(() => {
    setIsLogin(!!localStorage.getItem("token"));
  }, []);

  return (
    <html lang="en">
      <body className="bg-black text-white">
        <header className="flex justify-between px-6 py-4 border-b border-zinc-800">
          <h1 className="font-bold">VoxRoom</h1>

          {isLogin ? (
            <span className="text-green-400">Logged In</span>
          ) : (
            <Link href="/login" className="text-blue-400">
              Login
            </Link>
          )}
        </header>

        {children}
      </body>
    </html>
  );
}
