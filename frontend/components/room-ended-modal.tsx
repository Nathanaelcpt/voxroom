"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Radio } from "lucide-react"

interface RoomEndedModalProps {
  open: boolean
  roomTitle: string
  onClose: () => void
}

export function RoomEndedModal({
  open,
  roomTitle,
  onClose,
}: RoomEndedModalProps) {
  const router = useRouter()
  const [countdown, setCountdown] = useState(5)

  useEffect(() => {
    if (!open) {
      setCountdown(5)
      return
    }

    // Auto-redirect setelah 5 detik
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          router.push("/")
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [open, router])

  function handleGoHome() {
    onClose()
    router.push("/")
  }

  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <Radio className="h-8 w-8 text-destructive" />
            </div>
          </div>
          <AlertDialogTitle className="text-center text-xl">
            Room Telah Berakhir
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            <span className="font-medium">&quot;{roomTitle}&quot;</span> telah diakhiri
            oleh host.
            <br />
            <span className="text-xs text-muted-foreground mt-2 block">
              Mengalihkan ke halaman utama dalam {countdown} detik...
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:justify-center">
          <Button onClick={handleGoHome} className="w-full sm:w-auto">
            Kembali ke Halaman Utama
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
