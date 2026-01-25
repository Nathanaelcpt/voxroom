"use client"
export const dynamic = "force-dynamic"

import { useEffect, useState } from "react"
import { useUser } from "@/hooks/use-user"
import { getSupabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type UserProfile = {
  username: string
}

export default function AccountPage() {
  const { user, loading } = useUser()
  const supabase = getSupabase()

  const [username, setUsername] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) return

    supabase
      .from("users")
      .select("username")
      .eq("id", user.id)
      .single<UserProfile>()
      .then(({ data }) => {
        if (data) setUsername(data.username)
      })
  }, [user, supabase])

  if (loading) return null
  if (!user) return <p className="p-6">Harus login</p>

  async function updateUsername() {
    if (!user) return

    setSaving(true)
    await (supabase as any)
      .from("users")
      .update({ username })
      .eq("id", user.id)

    setSaving(false)
  }

  async function logout() {
    await supabase.auth.signOut()
    window.location.href = "/"
  }

  async function deleteAccount() {
    if (!user) return

    const ok = confirm("Yakin hapus akun? Ini permanen.")
    if (!ok) return

    await supabase.from("users").delete().eq("id", user.id)

    alert("Akun dihapus (auth delete sebaiknya via backend)")
    await logout()
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Kelola Akun</h1>

      {/* Username */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Username</label>
        <Input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <Button onClick={updateUsername} disabled={saving}>
          Simpan Username
        </Button>
      </div>

      {/* Password */}
      <div className="space-y-2">
        <label className="text-sm font-medium">
          Ganti Password
        </label>
        <Button
          variant="outline"
          onClick={() =>
            supabase.auth.resetPasswordForEmail(
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
