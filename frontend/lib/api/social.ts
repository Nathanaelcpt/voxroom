// lib/api/social.ts - Social features API

import { getSupabase } from "@/lib/supabase"

const API_URL = process.env.NEXT_PUBLIC_API_URL

export interface UserProfile {
  user_id: string
  username?: string
  full_name?: string
  avatar_url?: string
  email?: string
  is_online: boolean
  in_room?: string
}

export interface FollowStats {
  followers: number
  following: number
}

// Helper to get auth token
async function getAccessToken(): Promise<string> {
  const supabase = getSupabase()
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session?.access_token) {
    throw new Error("Not authenticated")
  }
  
  return session.access_token
}

// Follow a user
export async function followUser(userId: string) {
  const token = await getAccessToken()
  const response = await fetch(`${API_URL}/social/follow`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ user_id: userId }),
  })

  if (!response.ok) {
    throw new Error("Failed to follow user")
  }

  return response.json()
}

// Unfollow a user
export async function unfollowUser(userId: string) {
  const token = await getAccessToken()
  const response = await fetch(`${API_URL}/social/unfollow`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ user_id: userId }),
  })

  if (!response.ok) {
    throw new Error("Failed to unfollow user")
  }

  return response.json()
}

// Get user's followers
export async function getFollowers(userId: string): Promise<{ followers: UserProfile[]; count: number }> {
  const token = await getAccessToken()
  const response = await fetch(`${API_URL}/social/${userId}/followers`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    throw new Error("Failed to get followers")
  }

  return response.json()
}

// Get users that a user follows
export async function getFollowing(userId: string): Promise<{ following: UserProfile[]; count: number }> {
  const token = await getAccessToken()
  const response = await fetch(`${API_URL}/social/${userId}/following`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    throw new Error("Failed to get following")
  }

  return response.json()
}

// Get online friends (people you follow who are online)
export async function getOnlineFriends(): Promise<{ online_friends: UserProfile[]; count: number }> {
  const token = await getAccessToken()
  const response = await fetch(`${API_URL}/social/online-friends`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    throw new Error("Failed to get online friends")
  }

  return response.json()
}
