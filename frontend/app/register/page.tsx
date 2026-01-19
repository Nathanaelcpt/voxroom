"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL!;

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  async function register() {
    const res = await fetch(`${API}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      alert("Register gagal (username mungkin sudah ada)");
      return;
    }

    alert("Register berhasil, silakan login");
    router.push("/login");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-black">
      <div className="w-full max-w-sm rounded-xl bg-zinc-900 p-6 shadow-lg">
        <h1 className="mb-6 text-center text-2xl font-bold text-white">
          Register VoxRoom
        </h1>

        <div className="space-y-4">
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
            onClick={register}
            className="w-full rounded-md bg-green-600 py-2 font-semibold text-white hover:bg-green-700"
          >
            Register
          </button>
        </div>

        <p className="mt-4 text-center text-sm text-gray-400">
          Sudah punya akun?{" "}
          <a href="/login" className="text-blue-400 hover:underline">
            Login
          </a>
        </p>
      </div>
    </main>
  );
}
