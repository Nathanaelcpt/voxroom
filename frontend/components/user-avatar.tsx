// components/user-avatar.tsx

"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { User } from "@supabase/supabase-js"

interface UserAvatarProps {
  user?: {
    id: string
    email?: string
    user_metadata?: {
      avatar_url?: string
      full_name?: string
    }
  } | null
  fallbackText?: string
  size?: "sm" | "md" | "lg"
  className?: string
}

export function UserAvatar({ 
  user, 
  fallbackText, 
  size = "md",
  className = "" 
}: UserAvatarProps) {
  const sizeClasses = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-12 w-12 text-base",
  }

  // Get avatar URL from user metadata
  const avatarUrl = user?.user_metadata?.avatar_url

  // Get initials
  const getInitials = () => {
    if (fallbackText) return fallbackText

    if (user?.user_metadata?.full_name) {
      const names = user.user_metadata.full_name.split(" ")
      if (names.length >= 2) {
        return `${names[0][0]}${names[1][0]}`.toUpperCase()
      }
      return user.user_metadata.full_name.slice(0, 2).toUpperCase()
    }

    if (user?.email) {
      return user.email.slice(0, 2).toUpperCase()
    }

    return "?"
  }

  // Get display color based on user ID (consistent color per user)
  const getColor = () => {
    if (!user?.id) return "bg-muted"
    
    const colors = [
      "bg-red-500",
      "bg-blue-500",
      "bg-green-500",
      "bg-yellow-500",
      "bg-purple-500",
      "bg-pink-500",
      "bg-indigo-500",
      "bg-cyan-500",
    ]
    
    const hash = user.id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
    return colors[hash % colors.length]
  }

  return (
    <Avatar className={`${sizeClasses[size]} ${className}`}>
      {avatarUrl && <AvatarImage src={avatarUrl} alt={user?.email || "User"} />}
      <AvatarFallback className={getColor()}>
        {getInitials()}
      </AvatarFallback>
    </Avatar>
  )
}

// ✅ Get display name from user
export function getUserDisplayName(user?: {
  email?: string
  user_metadata?: {
    full_name?: string
  }
} | null): string {
  if (!user) return "Unknown User"
  
  if (user.user_metadata?.full_name) {
    return user.user_metadata.full_name
  }
  
  if (user.email) {
    // Extract name from email (before @)
    return user.email.split("@")[0]
  }
  
  return "User"
}
