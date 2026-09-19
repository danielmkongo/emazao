import api from '@/lib/api'
import type { ApiResponse } from '@/types'

/**
 * Shrink a photo on the phone before it is uploaded.
 *
 * A modern phone photo is 3–12 MB. Sent as-is it is slow on mobile data, it
 * is refused by the image host above 10 MB, and the web server in front of
 * the API rejects bodies over its limit (1 MB by default in nginx). Nobody
 * sees a 4000-pixel photo on a phone screen anyway: re-encoded to fit
 * `maxDim` it is a few hundred kilobytes and looks the same.
 */
export async function prepareImage(file: File, maxDim = 1920, quality = 0.84): Promise<File> {
  // Already small: leave it alone (keeps PNG transparency, GIFs, etc.).
  if (file.size < 450_000 && /^image\/(jpeg|png|webp|gif)$/.test(file.type)) return file

  let bitmap: ImageBitmap | HTMLImageElement
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions)
  } catch {
    // Older browsers without createImageBitmap for this type: try an <img>.
    try { bitmap = await loadImage(file) } catch {
      throw new Error("This photo's format isn't supported here. Choose a JPG or PNG, or set your camera to \"Most compatible\".")
    }
  }

  const w = 'width' in bitmap ? bitmap.width : 0
  const h = 'height' in bitmap ? bitmap.height : 0
  const scale = Math.min(1, maxDim / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * scale)
  canvas.height = Math.round(h * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0, canvas.width, canvas.height)
  if ('close' in bitmap) bitmap.close()

  const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', quality))
  if (!blob) return file
  const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
  return new File([blob], name || 'photo.jpg', { type: 'image/jpeg' })
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode failed')) }
    img.src = url
  })
}

/** Is this a photo, going by type or, when the browser leaves type blank (HEIC), by name? */
export function isImageFile(file: File) {
  return file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name)
}
export function isVideoFile(file: File) {
  return file.type.startsWith('video/') || /\.(mp4|mov|webm|m4v|3gp)$/i.test(file.name)
}

/** A readable reason for a failed upload, including the web server's own refusals. */
export function uploadErrorMessage(err: any): string {
  const status = err?.response?.status
  if (status === 413) return 'That file is too large to upload. Try a shorter video or a smaller photo.'
  if (!err?.response) return 'Upload interrupted — check your connection and try again.'
  return err?.response?.data?.message ?? 'Upload failed. Please try again.'
}

/**
 * Upload a photo or video, shrinking photos first. Returns the hosted URL.
 * `onProgress` gets 0–100 while the file is sent.
 */
export async function uploadMedia(file: File, onProgress?: (pct: number) => void): Promise<{ url: string; kind: 'IMAGE' | 'VIDEO' }> {
  const video = isVideoFile(file) && !isImageFile(file)
  const toSend = video ? file : await prepareImage(file)
  const form = new FormData()
  form.append('file', toSend)
  const res = await api.post<ApiResponse<{ url: string }>>(video ? '/upload/video' : '/upload/image', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: video ? 10 * 60_000 : 2 * 60_000,
    onUploadProgress: e => { if (e.total && onProgress) onProgress(Math.round((e.loaded / e.total) * 100)) },
  })
  return { url: res.data.data.url, kind: video ? 'VIDEO' : 'IMAGE' }
}
