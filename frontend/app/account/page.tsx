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

  if (loading) return null
  if (!user) return <p className="p-6">Harus login</p>

  /* =======================
     UPDATE PROFILE
  ======================= */
  async function updateProfile() {
    if (!user) return
    setSaving(true)

    const supabase = getSupabase()

    await (supabase as any)
      .from("users")
      .update({ username, bio })
      .eq("id", user.id)

    setSaving(false)
  }

  /* =======================
     UPLOAD AVATAR
  ======================= */
  async function uploadAvatar(file: File) {
    if (!user) return

    if (!file.type.startsWith("image/")) {
      alert("File harus berupa gambar")
      return
    }

    let finalFile = file

    // compress jika > 5MB
    if (file.size > 5 * 1024 * 1024) {
      try {
        finalFile = await compressImage(file)
      } catch {
        alert("Gagal memproses gambar")
        return
      }
    }

    if (finalFile.size > 5 * 1024 * 1024) {
      alert("Ukuran gambar maksimal 5MB")
      return
    }

    setUploading(true)
    const supabase = getSupabase()

    const filePath = `${user.id}.jpg`

    const { error } = await supabase.storage
      .from("avatars")
      .upload(filePath, finalFile, {
        upsert: true,
        contentType: "image/jpeg",
      })

    if (error) {
      alert("Upload avatar gagal")
      setUploading(false)
      return
    }

    const { data } = supabase.storage
      .from("avatars")
      .getPublicUrl(filePath)

    const publicUrl = data.publicUrl

    // simpan ke auth
    await supabase.auth.updateUser({
      data: { avatar_url: publicUrl },
    })

    // simpan ke table users
    await (supabase as any)
      .from("users")
      .update({ avatar_url: publicUrl })
      .eq("id", user.id)

    setAvatarUrl(publicUrl)
    setUploading(false)
  }

  /* =======================
     LOGOUT & DELETE
  ======================= */
  async function logout() {
    await getSupabase().auth.signOut()
    window.location.href = "/"
  }

  async function deleteAccount() {
    if (!user) return
    if (!confirm("Yakin hapus akun? Ini permanen.")) return

    const supabase = getSupabase()

    await (supabase as any)
      .from("users")
      .delete()
      .eq("id", user.id)

    await logout()
  }

  /* =======================
     UI
  ======================= */
  return (
    <div className="mx-auto max-w-xl p-6">
      <div className="space-y-6 rounded-xl border bg-card p-6">
        {/* Back */}
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali
        </Link>

        <h1 className="text-2xl font-semibold">Kelola Akun</h1>

        {/* Avatar */}
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={avatarUrl ?? undefined} />
            <AvatarFallback>
              {user.email?.[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <label
            className={`inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm
            ${uploading ? "opacity-50 pointer-events-none" : "hover:bg-muted"}`}
          >
            <Upload className="h-4 w-4" />
            {uploading ? "Uploading..." : "Ganti Foto"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) =>
                e.target.files && uploadAvatar(e.target.files[0])
              }
            />
          </label>
        </div>

        {/* Username */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Username</label>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>

        {/* Bio */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Bio</label>
          <textarea
            className="w-full rounded-md border bg-background p-2 text-sm"
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </div>

        <Button onClick={updateProfile} disabled={saving}>
          Simpan Profil
        </Button>

        {/* Password */}
        <div className="border-t pt-4">
          <Button
            variant="outline"
            onClick={() =>
              getSupabase().auth.resetPasswordForEmail(user.email!)
            }
          >
            Kirim Email Reset Password
          </Button>
        </div>

        {/* Actions */}
        <div className="flex gap-2 border-t pt-4">
          <Button variant="secondary" onClick={logout}>
            Logout
          </Button>
          <Button variant="destructive" onClick={deleteAccount}>
            Hapus Akun
          </Button>
        </div>
      </div>
    </div>
  )
}
