"use client"

import Cropper from "react-easy-crop"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

export function AvatarCropDialog({
  file,
  onCancel,
  onSave,
}: {
  file: File
  onCancel: () => void
  onSave: (blob: Blob) => void
}) {
  const [imageUrl, setImageUrl] = useState<string>("")
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedArea, setCroppedArea] = useState<any>(null)

  // ✅ AMAN: buat & bersihkan object URL
  useEffect(() => {
    const url = URL.createObjectURL(file)
    setImageUrl(url)

    return () => {
      URL.revokeObjectURL(url)
    }
  }, [file])

  async function finishCrop() {
    if (!croppedArea) return

    const image = await createImageBitmap(file)
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")!

    canvas.width = croppedArea.width
    canvas.height = croppedArea.height

    ctx.drawImage(
      image,
      croppedArea.x,
      croppedArea.y,
      croppedArea.width,
      croppedArea.height,
      0,
      0,
      croppedArea.width,
      croppedArea.height
    )

    canvas.toBlob((blob) => {
      if (blob) onSave(blob)
    }, "image/jpeg")
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
      <div className="bg-background p-4 rounded-lg w-[320px] space-y-4">
        <div className="relative h-64 w-full bg-black">
          {imageUrl && (
            <Cropper
              image={imageUrl}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, area) => setCroppedArea(area)}
            />
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Batal
          </Button>
          <Button onClick={finishCrop}>
            Simpan
          </Button>
        </div>
      </div>
    </div>
  )
}
