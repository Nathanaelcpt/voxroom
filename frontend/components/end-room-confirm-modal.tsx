"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { AlertTriangle } from "lucide-react"

interface EndRoomConfirmModalProps {
  open: boolean
  roomTitle: string
  participantCount: number
  onConfirm: () => void
  onCancel: () => void
}

export function EndRoomConfirmModal({
  open,
  roomTitle,
  participantCount,
  onConfirm,
  onCancel,
}: EndRoomConfirmModalProps) {
  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
          </div>
          <AlertDialogTitle className="text-center text-xl">
            Akhiri Room?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center space-y-2">
            <p>
              Anda yakin ingin mengakhiri room{" "}
              <span className="font-medium">&quot;{roomTitle}&quot;</span>?
            </p>
            {participantCount > 1 && (
              <p className="text-sm text-muted-foreground">
                <span className="font-medium">{participantCount - 1}</span>{" "}
                {participantCount - 1 === 1 ? "peserta" : "peserta"} lainnya akan
                dikeluarkan dari room.
              </p>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Batal</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Ya, Akhiri Room
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
