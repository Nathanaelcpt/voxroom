export async function compressImage(
  file: File,
  maxSizeMB = 5
): Promise<File> {
  if (!file.type.startsWith("image/")) {
    throw new Error("File harus gambar")
  }

  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")!

  canvas.width = bitmap.width
  canvas.height = bitmap.height
  ctx.drawImage(bitmap, 0, 0)

  let quality = 0.8
  let blob: Blob | null = null

  do {
    blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    )
    quality -= 0.1
  } while (blob && blob.size > maxSizeMB * 1024 * 1024 && quality > 0.3)

  if (!blob) throw new Error("Gagal compress")

  return new File([blob], "avatar.jpg", { type: "image/jpeg" })
}
