"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { UserPlus, UserMinus, Loader2 } from "lucide-react"
import { followUser, unfollowUser } from "@/lib/api/social"

interface FollowButtonProps {
  userId: string
  initialIsFollowing?: boolean
  variant?: "default" | "outline" | "ghost"
  size?: "default" | "sm" | "lg" | "icon"
  onFollowChange?: (isFollowing: boolean) => void
}

export function FollowButton({
  userId,
  initialIsFollowing = false,
  variant = "default",
  size = "default",
  onFollowChange,
}: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing)
  const [loading, setLoading] = useState(false)

  async function handleToggleFollow() {
    setLoading(true)
    try {
      if (isFollowing) {
        await unfollowUser(userId)
        setIsFollowing(false)
        onFollowChange?.(false)
      } else {
        await followUser(userId)
        setIsFollowing(true)
        onFollowChange?.(true)
      }
    } catch (error) {
      console.error("Failed to toggle follow:", error)
      alert("Failed to update follow status")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant={isFollowing ? "outline" : variant}
      size={size}
      onClick={handleToggleFollow}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isFollowing ? (
        <>
          <UserMinus className="h-4 w-4 mr-2" />
          Unfollow
        </>
      ) : (
        <>
          <UserPlus className="h-4 w-4 mr-2" />
          Follow
        </>
      )}
    </Button>
  )
}
