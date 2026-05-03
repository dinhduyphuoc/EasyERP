export function isObjectUrl(value: string) {
  return value.startsWith('blob:')
}

async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(file)

  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('Khong the doc anh de xu ly'))
      image.src = objectUrl
    })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function getCanvasContext(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Khong the khoi tao canvas de xu ly anh')
  }

  return context
}

async function canvasToFile(canvas: HTMLCanvasElement, file: File, quality?: number): Promise<File> {
  const outputBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Khong the tao anh sau khi xu ly'))
          return
        }

        resolve(blob)
      },
      file.type || 'image/png',
      quality,
    )
  })

  return new File([outputBlob], file.name, {
    type: outputBlob.type || file.type || 'image/png',
    lastModified: Date.now(),
  })
}

export async function preloadImageUrl(imageUrl: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('Khong the tai anh da cap nhat'))
    image.src = imageUrl
  })
}

export async function resizeImageFileToMax720p(file: File): Promise<File> {
  const image = await loadImageFromFile(file)
  const maxWidth = 1280
  const maxHeight = 720
  const scale = Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight, 1)

  if (scale >= 1) {
    return file
  }

  const targetWidth = Math.max(Math.round(image.naturalWidth * scale), 1)
  const targetHeight = Math.max(Math.round(image.naturalHeight * scale), 1)
  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight
  const context = getCanvasContext(canvas)

  context.drawImage(image, 0, 0, targetWidth, targetHeight)

  return canvasToFile(canvas, file, file.type === 'image/jpeg' ? 0.82 : undefined)
}

export async function cropImageFileToSize(file: File, width: number, height: number): Promise<File> {
  const safeWidth = Math.max(Math.round(width), 1)
  const safeHeight = Math.max(Math.round(height), 1)
  const image = await loadImageFromFile(file)
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
  const context = getCanvasContext(canvas)

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

  return canvasToFile(canvas, file)
}
