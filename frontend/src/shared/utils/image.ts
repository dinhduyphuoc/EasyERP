export function isObjectUrl(value: string) {
  return value.startsWith('blob:')
}

export async function preloadImageUrl(imageUrl: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('Không thể tải ảnh đã cập nhật'))
    image.src = imageUrl
  })
}

export async function cropImageFileToSize(file: File, width: number, height: number): Promise<File> {
  const safeWidth = Math.max(Math.round(width), 1)
  const safeHeight = Math.max(Math.round(height), 1)
  const objectUrl = URL.createObjectURL(file)

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Không thể đọc ảnh để xử lý'))
      img.src = objectUrl
    })

    const targetRatio = safeWidth / safeHeight
    const sourceRatio = image.naturalWidth / image.naturalHeight

    let cropWidth = image.naturalWidth
    let cropHeight = image.naturalHeight

    if (sourceRatio > targetRatio) {
      cropWidth = Math.round(image.naturalHeight * targetRatio)
    } else {
      cropHeight = Math.round(image.naturalWidth / targetRatio)
    }

    const offsetX = Math.max(Math.round((image.naturalWidth - cropWidth) / 2), 0)
    const offsetY = Math.max(Math.round((image.naturalHeight - cropHeight) / 2), 0)

    const canvas = document.createElement('canvas')
    canvas.width = safeWidth
    canvas.height = safeHeight
    const context = canvas.getContext('2d')

    if (!context) {
      throw new Error('Không thể khởi tạo canvas để xử lý ảnh')
    }

    context.drawImage(
      image,
      offsetX,
      offsetY,
      cropWidth,
      cropHeight,
      0,
      0,
      safeWidth,
      safeHeight,
    )

    const outputBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Không thể tạo ảnh sau khi crop'))
          return
        }

        resolve(blob)
      }, file.type || 'image/png')
    })

    return new File([outputBlob], file.name, {
      type: outputBlob.type || file.type || 'image/png',
      lastModified: Date.now(),
    })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}
