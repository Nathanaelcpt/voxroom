"use client"
export const dynamic = "force-dynamic"

import { useEffect, useRef, useState } from "react"
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
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [username, setUsername] = useState("")
  const [bio, setBio] = useState("")
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  /* =======================
     GUARD
  ======================= */
  if (loading) return null
  if (!user) return <p className="p-6">Harus login</p>

  const userId = user.id
  const userEmail = user.email!

  /* =======================
     LOAD PROFILE
  ======================= */
  useEffect(() => {
  if (!user) return

  const supabase = getSupabase()

  ;(async () => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("username, bio, avatar_url")
        .eq("id", user.id)
        .single<UserProfile>()

      if (error || !data) return

      setUsername(data.username)
      setBio(data.bio ?? "")
      setAvatarUrl(data.avatar_url)
    } catch (err) {
      console.error("Load profile error:", err)
    }
  })()
}, [user.id])

  /* =======================
     UPDATE PROFILE
  ======================= */
  async function updateProfile() {
    setSaving(true)
    const supabase = getSupabase()

    await (supabase as any)
      .from("users")
      .update({ username, bio })
      .eq("id", userId)

    setSaving(false)
  }

  /* =======================
     UPLOAD AVATAR
  ======================= */
  async function handleAvatarChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0]
    e.target.value = "" // 🔑 reset supaya file sama bisa diupload lagi

    if (!file) return

    if (!file.type.startsWith("image/")) {
      alert("File harus berupa gambar")
      return
    }

    let finalFile = file

    // compress jika >5MB
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

    const filePath = `${userId}.jpg`

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

    const publicUrl = `${data.publicUrl}?t=${Date.now()}` // cache busting

    // auth metadata
    await supabase.auth.updateUser({
      data: { avatar_url: publicUrl },
    })

    // table users
    await (supabase as any)
      .from("users")
      .update({ avatar_url: publicUrl })
      .eq("id", userId)

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
    if (!confirm("Yakin hapus akun? Ini permanen.")) return

    const supabase = getSupabase()
    await (supabase as any)
      .from("users")
      .delete()
      .eq("id", userId)

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
            {avatarUrl && <AvatarImage src={avatarUrl} />}
            <AvatarFallback>
              {userEmail[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <Button
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mr-2 h-4 w-4" />
            {uploading ? "Uploading..." : "Ganti Foto"}
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
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
              getSupabase().auth.resetPasswordForEmail(userEmail)
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
