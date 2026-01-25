"use client"
export const dynamic = "force-dynamic"

import { useEffect, useState } from "react"
import { useUser } from "@/hooks/use-user"
import { getSupabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type UserProfile = {
  username: string
  bio: string | null
}

export default function AccountPage() {
  const { user, loading } = useUser()
  const [username, setUsername] = useState("")
  const [initialUsername, setInitialUsername] = useState("")
  const [bio, setBio] = useState("")
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (!user) return

    const supabase = getSupabase()

    supabase
      .from("users")
      .select("username, bio")
      .eq("id", user.id)
      .single<UserProfile>()
      .then(({ data }) => {
        if (!data) return
        setUsername(data.username)
        setInitialUsername(data.username)
        setBio(data.bio ?? "")
      })
  }, [user?.id])

  if (loading) return null
  if (!user) return <p className="p-6">Harus login</p>

  async function updateProfile() {
    if (!user) return
    setSaving(true)

    const supabase = getSupabase()

    // NOTE: Supabase client belum pakai generated types
    await (supabase as any)
      .from("users")
      .update({
        username,
        bio,
      })
      .eq("id", user.id)

    setInitialUsername(username)
    setSaving(false)
  }

  async function uploadAvatar(file: File) {
    if (!user) return
    setUploading(true)

    const supabase = getSupabase()
    const filePath = `${user.id}.png`

    await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true })

    const { data } = supabase.storage
      .from("avatars")
      .getPublicUrl(filePath)

    await supabase.auth.updateUser({
      data: {
        avatar_url: data.publicUrl,
      },
    })

    setUploading(false)

    // biar topbar langsung update
    window.location.reload()
  }

  async function logout() {
    const supabase = getSupabase()
    await supabase.auth.signOut()
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

  return (
    <div className="mx-auto max-w-xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Kelola Akun</h1>

      {/* Avatar */}
      <div className="space-y-2">
        <label className="text-sm font-medium">
          Foto Profil
        </label>

        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) uploadAvatar(file)
          }}
        />

        {uploading && (
          <p className="text-xs text-muted-foreground">
            Uploading avatar...
          </p>
        )}
      </div>

      {/* Username */}
      <div className="space-y-2">
        <label className="text-sm font-medium">
          Username
        </label>
        <Input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>

      {/* Bio */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Bio</label>
        <textarea
          className="w-full rounded-md border p-2 text-sm"
          rows={3}
          placeholder="Tentang kamu..."
          value={bio}
          onChange={(e) => setBio(e.target.value)}
        />
      </div>

      <Button
        onClick={updateProfile}
        disabled={saving}
      >
        Simpan Profil
      </Button>

      {/* Password */}
      <div className="space-y-2 pt-4 border-t">
        <label className="text-sm font-medium">
          Ganti Password
        </label>
        <Button
          variant="outline"
          onClick={() =>
            getSupabase().auth.resetPasswordForEmail(
              user.email!
            )
          }
        >
          Kirim Email Reset Password
        </Button>
      </div>

      {/* Actions */}
      <div className="space-y-2 pt-4 border-t">
        <Button variant="secondary" onClick={logout}>
          Logout
        </Button>

        <Button
          variant="destructive"
          onClick={deleteAccount}
        >
          Hapus Akun
        </Button>
      </div>
    </div>
  )
}
