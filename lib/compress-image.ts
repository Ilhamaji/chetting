const MAX_IMAGE_BYTES = 1024 * 1024

function blobToFile(blob: Blob, originalName: string) {
  const baseName = originalName.replace(/\.[^.]+$/, "")
  return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" })
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", quality)
  })
}

export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size <= MAX_IMAGE_BYTES) return file

  const image = await createImageBitmap(file)
  let width = image.width
  let height = image.height
  let quality = 0.82

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext("2d")
    if (!context) throw new Error("Image compression is not supported")

    context.drawImage(image, 0, 0, width, height)
    const blob = await canvasToBlob(canvas, quality)
    if (blob && blob.size <= MAX_IMAGE_BYTES) {
      image.close()
      return blobToFile(blob, file.name)
    }

    if (quality > 0.45) {
      quality -= 0.1
    } else {
      width = Math.max(640, Math.round(width * 0.8))
      height = Math.max(640, Math.round(height * 0.8))
      quality = 0.7
    }
  }

  image.close()
  throw new Error("Image is still larger than 1 MB after compression")
}

export { MAX_IMAGE_BYTES }
