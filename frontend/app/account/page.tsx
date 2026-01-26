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
import { AvatarCropDialog } from "@/components/avatar-crop-dialog"

type UserProfile = {
  username: string
  bio: string | null
  avatar_url: string | null
}

export default function AccountPage() {
  const { user, loading } = useUser()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [username, setUsername] = useState("")
  const [bio, setBio] = useState("")
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [cropFile, setCropFile] = useState<File | null>(null)

  /* =======================
     GUARD
  ======================= */
  if (loading) return <div className="p-6">Loading...</div>
  if (!user) return <div className="p-6">Harus login</div>

  // 🔐 TYPE AMAN SETELAH GUARD
  const currentUser = user

  /* =======================
     LOAD PROFILE
  ======================= */
  useEffect(() => {
    getSupabase()
      .from("users")
      .select("username, bio, avatar_url")
      .eq("id", currentUser.id)
      .single<UserProfile>()
      .then(({ data }) => {
        if (!data) return
        setUsername(data.username)
        setBio(data.bio ?? "")
        setAvatarUrl(data.avatar_url)
      })
  }, [currentUser.id])

  /* =======================
     UPDATE PROFILE
  ======================= */
  async function updateProfile() {
    setSaving(true)

    await (getSupabase() as any)
      .from("users")
      .update({
        username,
        bio,
      })
      .eq("id", currentUser.id)

    setSaving(false)
  }

  /* =======================
     SAVE CROPPED AVATAR
  ======================= */
  async function saveCroppedAvatar(blob: Blob) {
    setUploading(true)

    let file = new File([blob], "avatar.jpg", { type: "image/jpeg" })

    if (file.size > 5 * 1024 * 1024) {
      file = await compressImage(file)
    }

    const supabase = getSupabase()
    const path = `${currentUser.id}.jpg`

    await supabase.storage
      .from("avatars")
      .upload(path, file, {
        upsert: true,
        contentType: "image/jpeg",
      })

    const { data } = supabase.storage
      .from("avatars")
      .getPublicUrl(path)

    await supabase.auth.updateUser({
      data: { avatar_url: data.publicUrl },
    })

    await (supabase as any)
      .from("users")
      .update({ avatar_url: data.publicUrl })
      .eq("id", currentUser.id)

    setAvatarUrl(data.publicUrl)
    setUploading(false)
    setCropFile(null)

    // reset input biar bisa upload file yg sama lagi
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  /* =======================
     AUTH ACTIONS
  ======================= */
  async function logout() {
    await getSupabase().auth.signOut()
    window.location.href = "/"
  }

  async function deleteAccount() {
    if (!confirm("Yakin hapus akun? Ini permanen.")) return

    await (getSupabase() as any)
      .from("users")
      .delete()
      .eq("id", currentUser.id)

    await logout()
  }

  /* =======================
     UI
  ======================= */
  return (
    <div className="mx-auto max-w-xl p-6">
      <div className="space-y-6 rounded-xl border bg-card p-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground"
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
              {currentUser.email?.[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <label
            className={`inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm
            ${uploading ? "opacity-50 pointer-events-none" : "hover:bg-muted"}`}
          >
            <Upload className="h-4 w-4" />
            {uploading ? "Uploading..." : "Ganti Foto"}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) setCropFile(file)
              }}
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
              getSupabase().auth.resetPasswordForEmail(
                currentUser.email!
              )
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

      {/* Crop Dialog */}
      {cropFile && (
        <AvatarCropDialog
          file={cropFile}
          onCancel={() => setCropFile(null)}
          onSave={saveCroppedAvatar}
        />
      )}
    </div>
  )
}
