"use client"
export const dynamic = "force-dynamic"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Upload } from "lucide-react"

import { useUser } from "@/hooks/use-user"
import { getSupabase } from "@/lib/supabase"
import { compressImage } from "@/lib/image"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"

type UserProfile = {
  username: string
  bio: string | null
  avatar_url: string | null
}

export default function AccountPage() {
  const { user, loading } = useUser()

  const [username, setUsername] = useState("")
  const [bio, setBio] = useState("")
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  /* =======================
     LOAD PROFILE
  ======================= */
  useEffect(() => {
    if (!user) return

    const supabase = getSupabase()

    supabase
      .from("users")
      .select("username, bio, avatar_url")
      .eq("id", user.id)
      .single<UserProfile>()
      .then(({ data }) => {
        if (!data) return
        setUsername(data.username)
        setBio(data.bio ?? "")
        setAvatarUrl(data.avatar_url)
      })
  }, [user?.id])

  /* =======================
     ACTIONS
  ======================= */
  async function updateProfile() {
    if (!user) return
    setSaving(true)

    await (getSupabase() as any)
      .from("users")
      .update({ username, bio })
      .eq("id", user.id)

    setSaving(false)
  }

  async function uploadAvatar(file: File) {
    if (!user) return

    if (!file.type.startsWith("image/")) {
      alert("File harus gambar")
      return
    }

    let finalFile = file

    if (file.size > 5 * 1024 * 1024) {
      finalFile = await compressImage(file)
    }

    setUploading(true)

    const supabase = getSupabase()
    const path = `${user.id}.jpg`

    const { error } = await supabase.storage
      .from("avatars")
      .upload(path, finalFile, {
        upsert: true,
        contentType: "image/jpeg",
      })

    if (error) {
      alert("Upload gagal")
      setUploading(false)
      return
    }

    const { data } = supabase.storage
      .from("avatars")
      .getPublicUrl(path)

    await supabase.auth.updateUser({
      data: { avatar_url: data.publicUrl },
    })

    await (supabase as any)
      .from("users")
      .update({ avatar_url: data.publicUrl })
      .eq("id", user.id)

    setAvatarUrl(data.publicUrl)
    setUploading(false)
  }

  async function logout() {
    await getSupabase().auth.signOut()
    window.location.href = "/"
  }

  /* =======================
     RENDER
  ======================= */
  if (loading) {
    return <div className="p-6">Loading...</div>
  }

  if (!user) {
    return <div className="p-6">Harus login</div>
  }

  return (
    <div className="mx-auto max-w-xl p-6">
      <div className="space-y-6 rounded-xl border bg-card p-6">
        <Link href="/" className="flex items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Link>

        <h1 className="text-2xl font-semibold">Kelola Akun</h1>

        {/* Avatar */}
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={avatarUrl ?? undefined} />
            <AvatarFallback>
              {user.email?.[0]?.toUpperCase() ?? "U"}
            </AvatarFallback>
          </Avatar>

          <label className={`cursor-pointer rounded-md border px-3 py-2 text-sm inline-flex items-center gap-2 ${uploading && "opacity-50 pointer-events-none"}`}>
            <Upload className="h-4 w-4" />
            {uploading ? "Uploading..." : "Ganti Foto"}
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) =>
                e.target.files && uploadAvatar(e.target.files[0])
              }
            />
          </label>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Username</label>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Bio</label>
          <textarea
            className="w-full rounded-md border p-2 text-sm"
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </div>

        <Button onClick={updateProfile} disabled={saving}>
          Simpan Profil
        </Button>

        <div className="border-t pt-4 flex gap-2">
          <Button variant="secondary" onClick={logout}>Logout</Button>
        </div>
      </div>
    </div>
  )
}
