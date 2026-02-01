"use client"

import { useState, useEffect } from "react"
import { useTheme } from "next-themes"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { useUser } from "@/hooks/use-user"
import { AuthDialog } from "@/components/auth-dialog"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Sun, Moon, Radio, Users, Home } from "lucide-react"

export default function Topbar() {
  const { user, loading } = useUser()
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

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
          {/* Left - Logo */}
          <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
            <Radio className="h-5 w-5 text-primary" />
            <span>VoxRoom</span>
          </Link>

          {/* Middle - Navigation + Search */}
          <div className="flex items-center gap-4">
            {/* Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              <Link href="/">
                <Button
                  variant={pathname === "/" ? "secondary" : "ghost"}
                  size="sm"
                  className="gap-2"
                >
                  <Home className="h-4 w-4" />
                  Home
                </Button>
              </Link>

              {user && (
                <Link href="/social">
                  <Button
                    variant={pathname === "/social" ? "secondary" : "ghost"}
                    size="sm"
                    className="gap-2"
                  >
                    <Users className="h-4 w-4" />
                    Friends
                  </Button>
                </Link>
              )}
            </nav>

            {/* Search */}
            <input
              placeholder="Search rooms..."
              className="hidden lg:block h-9 w-64 rounded-md border bg-background text-foreground px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Right - Theme + Avatar */}
          <div className="flex items-center gap-2">
            {/* Dark Mode Toggle */}
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
