"use client"

import { useEffect, useState } from "react"
import { useUser } from "@/hooks/use-user"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { UserAvatar } from "@/components/user-avatar"
import { FollowButton } from "@/components/follow-button"
import { Badge } from "@/components/ui/badge"
import { Users, UserCheck, Radio } from "lucide-react"
import { getFollowers, getFollowing, type UserProfile } from "@/lib/api/social"

export default function SocialPage() {
  const { user } = useUser()
  const [followers, setFollowers] = useState<UserProfile[]>([])
  const [following, setFollowing] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"following" | "followers">("following")

  useEffect(() => {
    if (!user) return

    async function loadSocialData() {
      if (!user) return // ✅ Extra null check

      try {
        const [followersData, followingData] = await Promise.all([
          getFollowers(user.id),
          getFollowing(user.id),
        ])

        setFollowers(followersData.followers)
        setFollowing(followingData.following)
      } catch (error) {
        console.error("Failed to load social data:", error)
      } finally {
        setLoading(false)
      }
    }

    loadSocialData()
  }, [user])

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <UserAvatar user={user} size="lg" />
          <div className="flex-1">
            <h1 className="text-3xl font-bold">{user.user_metadata?.full_name || user.email}</h1>
            <p className="text-muted-foreground">
              {user.user_metadata?.username ? `@${user.user_metadata.username}` : user.email}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold">{following.length}</p>
                <p className="text-sm text-muted-foreground">Following</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold">{followers.length}</p>
                <p className="text-sm text-muted-foreground">Followers</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "following" | "followers")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="following" className="gap-2">
              <UserCheck className="h-4 w-4" />
              Following ({following.length})
            </TabsTrigger>
            <TabsTrigger value="followers" className="gap-2">
              <Users className="h-4 w-4" />
              Followers ({followers.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="following" className="space-y-4">
            {following.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>You're not following anyone yet</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>People You Follow</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {following.map((profile) => (
                    <div
                      key={profile.user_id}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
                    >
                      <UserAvatar
                        user={{
                          id: profile.user_id,
                          email: profile.email,
                          user_metadata: {
                            avatar_url: profile.avatar_url,
                            full_name: profile.full_name,
                          },
                        }}
                      />

                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {profile.full_name || profile.username || profile.email?.split("@")[0]}
                        </p>
                        {profile.username && (
                          <p className="text-sm text-muted-foreground">@{profile.username}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {profile.is_online && (
                          <Badge variant="secondary" className="gap-1">
                            <div className="h-2 w-2 rounded-full bg-green-500" />
                            Online
                          </Badge>
                        )}
                        {profile.in_room && (
                          <Badge variant="outline" className="gap-1">
                            <Radio className="h-3 w-3" />
                            In room
                          </Badge>
                        )}
                        <FollowButton
                          userId={profile.user_id}
                          initialIsFollowing={true}
                          variant="outline"
                          size="sm"
                          onFollowChange={(isFollowing) => {
                            if (!isFollowing) {
                              setFollowing(following.filter((p) => p.user_id !== profile.user_id))
                            }
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="followers" className="space-y-4">
            {followers.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No followers yet</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>People Following You</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {followers.map((profile) => {
                    const isFollowingBack = following.some((f) => f.user_id === profile.user_id)

                    return (
                      <div
                        key={profile.user_id}
                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
                      >
                        <UserAvatar
                          user={{
                            id: profile.user_id,
                            email: profile.email,
                            user_metadata: {
                              avatar_url: profile.avatar_url,
                              full_name: profile.full_name,
                            },
                          }}
                        />

                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {profile.full_name || profile.username || profile.email?.split("@")[0]}
                          </p>
                          {profile.username && (
                            <p className="text-sm text-muted-foreground">@{profile.username}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {profile.is_online && (
                            <Badge variant="secondary" className="gap-1">
                              <div className="h-2 w-2 rounded-full bg-green-500" />
                              Online
                            </Badge>
                          )}
                          <FollowButton
                            userId={profile.user_id}
                            initialIsFollowing={isFollowingBack}
                            size="sm"
                            onFollowChange={(isFollowing) => {
                              if (isFollowing) {
                                // Add to following list if not already there
                                if (!following.some((f) => f.user_id === profile.user_id)) {
                                  setFollowing([...following, profile])
                                }
                              } else {
                                // Remove from following list
                                setFollowing(following.filter((f) => f.user_id !== profile.user_id))
                              }
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
