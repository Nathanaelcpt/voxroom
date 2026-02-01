"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { UserAvatar } from "@/components/user-avatar"
import { Badge } from "@/components/ui/badge"
import { Users, Radio, RefreshCw } from "lucide-react"
import { getOnlineFriends, type UserProfile } from "@/lib/api/social"
import Link from "next/link"

export function OnlineFriendsSidebar() {
  const [friends, setFriends] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    loadFriends()

    // Auto-refresh every 30 seconds
    const interval = setInterval(loadFriends, 30000)
    return () => clearInterval(interval)
  }, [])

  async function loadFriends() {
    try {
      const data = await getOnlineFriends()
      setFriends(data.online_friends)
    } catch (error) {
      console.error("Failed to load online friends:", error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  async function handleRefresh() {
    setRefreshing(true)
    await loadFriends()
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Online Friends
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Online Friends
            {friends.length > 0 && (
              <Badge variant="secondary">{friends.length}</Badge>
            )}
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {friends.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm">No friends online</p>
            <Link href="/social">
              <Button variant="link" size="sm" className="mt-2">
                Find people to follow
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {friends.map((friend) => {
              const displayName = friend.full_name || friend.username || friend.email?.split("@")[0]

              return (
                <div
                  key={friend.user_id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors"
                >
                  <div className="relative">
                    <UserAvatar
                      user={{
                        id: friend.user_id,
                        email: friend.email,
                        user_metadata: {
                          avatar_url: friend.avatar_url,
                          full_name: friend.full_name,
                        },
                      }}
                      size="sm"
                    />
                    <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 border-2 border-background" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {displayName}
                    </p>
                    {friend.in_room ? (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Radio className="h-3 w-3" />
                        <span>In a room</span>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Online</p>
                    )}
                  </div>

                  {friend.in_room && (
                    <Link href={`/room/${friend.in_room}`}>
                      <Button variant="ghost" size="sm" className="h-8">
                        <Radio className="h-3 w-3 mr-1" />
                        Join
                      </Button>
                    </Link>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
