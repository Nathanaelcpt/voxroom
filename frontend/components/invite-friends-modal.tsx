"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { UserAvatar } from "@/components/user-avatar"
import { Badge } from "@/components/ui/badge"
import { Loader2, Radio, Send } from "lucide-react"
import { getOnlineFriends, type UserProfile } from "@/lib/api/social"

interface InviteFriendsModalProps {
  open: boolean
  onClose: () => void
  roomId: string
  roomTitle: string
  onInvite: (userId: string) => Promise<void>
}

export function InviteFriendsModal({
  open,
  onClose,
  roomId,
  roomTitle,
  onInvite,
}: InviteFriendsModalProps) {
  const [friends, setFriends] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [inviting, setInviting] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (open) {
      loadOnlineFriends()
    }
  }, [open])

  async function loadOnlineFriends() {
    setLoading(true)
    try {
      const data = await getOnlineFriends()
      // Filter out friends already in this room
      const availableFriends = data.online_friends.filter(
        (friend) => friend.in_room !== roomId
      )
      setFriends(availableFriends)
    } catch (error) {
      console.error("Failed to load online friends:", error)
    } finally {
      setLoading(false)
    }
  }

  async function handleInvite(userId: string) {
    setInviting((prev) => new Set(prev).add(userId))
    try {
      await onInvite(userId)
      // Remove friend from list after successful invite
      setFriends(friends.filter((f) => f.user_id !== userId))
    } catch (error) {
      console.error("Failed to invite friend:", error)
      alert("Failed to send invitation")
    } finally {
      setInviting((prev) => {
        const next = new Set(prev)
        next.delete(userId)
        return next
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Friends to {roomTitle}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 max-h-100 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : friends.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No online friends available to invite</p>
              <p className="text-sm mt-2">Friends in other rooms can't be invited</p>
            </div>
          ) : (
            friends.map((friend) => {
              const isInviting = inviting.has(friend.user_id)
              const displayName = friend.full_name || friend.username || friend.email?.split("@")[0]

              return (
                <div
                  key={friend.user_id}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
                >
                  <UserAvatar
                    user={{
                      id: friend.user_id,
                      email: friend.email,
                      user_metadata: {
                        avatar_url: friend.avatar_url,
                        full_name: friend.full_name,
                      },
                    }}
                  />

                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {displayName}
                    </p>
                    {friend.username && (
                      <p className="text-sm text-muted-foreground">@{friend.username}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="gap-1">
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                      Online
                    </Badge>

                    {friend.in_room && friend.in_room !== roomId && (
                      <Badge variant="outline" className="gap-1">
                        <Radio className="h-3 w-3" />
                        In room
                      </Badge>
                    )}

                    <Button
                      size="sm"
                      onClick={() => handleInvite(friend.user_id)}
                      disabled={isInviting || !!friend.in_room}
                    >
                      {isInviting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Invite
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
