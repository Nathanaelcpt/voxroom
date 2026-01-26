export async function compressImage(
  file: File,
  maxSizeMB = 5
): Promise<File> {
  if (!file.type.startsWith("image/")) {
    throw new Error("File harus gambar")
  }

  const img = new Image()
  img.src = URL.createObjectURL(file)

  await new Promise((resolve, reject) => {
    img.onload = resolve
    img.onerror = reject
  })

  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")!

  canvas.width = img.width
  canvas.height = img.height
  ctx.drawImage(img, 0, 0)

  let quality = 0.8
  let blob: Blob | null = null

  do {
    blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    )
    quality -= 0.1
  } while (blob && blob.size > maxSizeMB * 1024 * 1024 && quality > 0.3)

  if (!blob) throw new Error("Gagal compress")

  URL.revokeObjectURL(img.src)

  return new File([blob], "avatar.jpg", { type: "image/jpeg" })
}
