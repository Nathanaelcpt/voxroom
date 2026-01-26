export async function compressImage(
  file: Blob,
  maxSizeMB = 5
): Promise<File> {
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")!

  const size = Math.min(bitmap.width, bitmap.height)
  canvas.width = size
  canvas.height = size

  // crop tengah
  ctx.drawImage(
    bitmap,
    (bitmap.width - size) / 2,
    (bitmap.height - size) / 2,
    size,
    size,
    0,
    0,
    size,
    size
  )

  let quality = 0.9
  let blob: Blob | null = null

  do {
    blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, "image/jpeg", quality)
    )
    quality -= 0.1
  } while (blob && blob.size > maxSizeMB * 1024 * 1024)

  if (!blob) throw new Error("Gagal compress")

  return new File([blob], "avatar.jpg", { type: "image/jpeg" })
}
