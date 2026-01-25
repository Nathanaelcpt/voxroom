"use client"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"

export default function Topbar() {
  // sementara simulasi login
  const isLoggedIn = false

  return (
    <header className="fixed top-0 z-50 w-full border-b bg-background">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        {/* Left */}
        <span className="text-lg font-semibold">VoxRoom</span>

        {/* Middle */}
        <input
          placeholder="Search"
          className="h-9 w-72 rounded-md border px-3 text-sm"
        />

        {/* Right */}
        <Avatar className="h-8 w-8 cursor-pointer">
          {isLoggedIn ? (
            <AvatarImage src="/profile.jpg" />
          ) : (
            <AvatarImage src="/guest.png" />
          )}

          <AvatarFallback>G</AvatarFallback>
        </Avatar>
      </div>
    </header>
  )
}
