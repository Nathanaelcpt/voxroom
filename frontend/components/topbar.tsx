"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@/hooks/use-user"
import { AuthDialog } from "@/components/auth-dialog"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"

export default function Topbar() {
  const { user, loading } = useUser()
  const [open, setOpen] = useState(false)
  const router = useRouter()

  if (loading) return null

  function handleAvatarClick() {
    if (!user) {
      setOpen(true)
    } else {
      router.push("/account")
    }
  }

  return (
    <>
      <header className="fixed top-0 z-50 w-full border-b bg-background">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
          {/* Left */}
          <span className="text-lg font-semibold cursor-pointer"
                onClick={() => router.push("/")}>
            VoxRoom
          </span>

          {/* Middle */}
          <input
            placeholder="Search"
            className="h-9 w-72 rounded-md border px-3 text-sm"
          />

          {/* Right */}
          <Avatar
            className="h-8 w-8 cursor-pointer"
            onClick={handleAvatarClick}
          >
            <AvatarImage
              src={
                user?.user_metadata?.avatar_url ??
                "/guest.png"
              }
            />
            <AvatarFallback>
              {user?.email?.[0]?.toUpperCase() ?? "G"}
            </AvatarFallback>
          </Avatar>
        </div>
      </header>

      {/* Auth Modal */}
      <AuthDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
