"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL!;

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  async function login(e: React.FormEvent) {
    e.preventDefault();

    const res = await fetch(`${API}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      alert("Login gagal");
      return;
    }

    const data = await res.json();
    localStorage.setItem("token", data.token);
    router.push("/room");
  }

  return (
    <main className="flex justify-center items-center min-h-screen">
      <form onSubmit={login} className="bg-zinc-900 p-6 rounded w-80">
        <h2 className="text-xl font-bold mb-4">Login</h2>

        <input
          className="w-full mb-3 p-2 bg-zinc-800"
          placeholder="Username"
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          type="password"
          className="w-full mb-3 p-2 bg-zinc-800"
          placeholder="Password"
          onChange={(e) => setPassword(e.target.value)}
        />

        <button className="w-full bg-blue-600 py-2">Login</button>

        <p className="text-sm mt-3">
          Belum punya akun?{" "}
          <a href="/register" className="text-blue-400">
            Daftar
          </a>
        </p>
      </form>
    </main>
  );
}
