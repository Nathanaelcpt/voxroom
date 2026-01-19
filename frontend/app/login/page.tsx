"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL!;

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  async function login() {
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
    <main className="flex min-h-screen items-center justify-center bg-black">
      <div className="w-full max-w-sm rounded-xl bg-zinc-900 p-6 shadow-lg">
        <h1 className="mb-6 text-center text-2xl font-bold text-white">
          Login VoxRoom
        </h1>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            login();
          }}
          className="space-y-4"
        >
          <input
            className="w-full rounded-md border border-zinc-700 bg-zinc-800 p-2 text-white"
            placeholder="Username"
            onChange={(e) => setUsername(e.target.value)}
          />

          <input
            type="password"
            className="w-full rounded-md border border-zinc-700 bg-zinc-800 p-2 text-white"
            placeholder="Password"
            onChange={(e) => setPassword(e.target.value)}
          />

          <button
            type="submit"
            className="w-full rounded-md bg-blue-600 py-2 font-semibold text-white hover:bg-blue-700"
          >
            Login
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-400">
          Belum punya akun?{" "}
          <a href="/register" className="text-blue-400 hover:underline">
            Daftar
          </a>
        </p>
      </div>
    </main>
  );
}
