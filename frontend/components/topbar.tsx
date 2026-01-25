"use client"

import { useState, useEffect } from "react"
import { useTheme } from "next-themes"
import { useUser } from "@/hooks/use-user"
import { AuthDialog } from "@/components/auth-dialog"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Sun, Moon } from "lucide-react"

export default function Topbar() {
  const { user, loading } = useUser()
  const [open, setOpen] = useState(false)

  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || loading) return null

  return (
    <>
      <header className="fixed top-0 z-50 w-full border-b bg-background text-foreground">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
          {/* Left */}
          <span className="text-lg font-semibold">
            VoxRoom
          </span>

          {/* Middle */}
          <input
            placeholder="Search"
            className="h-9 w-72 rounded-md border bg-background text-foreground px-3 text-sm"
          />

          {/* Right */}
          <div className="flex items-center gap-2">
            {/* 🌙☀️ Dark Mode Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                setTheme(theme === "dark" ? "light" : "dark")
              }
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>

            {/* Avatar */}
            <Avatar
              className="h-8 w-8 cursor-pointer"
              onClick={() =>
                !user
                  ? setOpen(true)
                  : (window.location.href = "/account")
              }
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
        </div>
      </header>

      <AuthDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
