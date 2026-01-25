"use client"

import { useState } from "react"
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

  if (loading) return null

  return (
    <>
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
          <Avatar
            className="h-8 w-8 cursor-pointer"
            onClick={() => !user && setOpen(true)}
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

      <AuthDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
