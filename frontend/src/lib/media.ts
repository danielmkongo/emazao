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
/**
 * A still image of a Cloudinary video, cut from its first second.
 *
 * The upload route used to make one by swapping '.mp4' for '.jpg', which does
 * nothing to a phone recording — iPhones save .mov and the in-app camera
 * saves .webm — so those reels were stored with the video itself as their
 * "thumbnail". Cloudinary will render a frame of any video if asked by
 * transformation, whatever the extension, so ask it that way.
 */
export function videoPoster(url?: string, width = 480): string | undefined {
  if (!url) return undefined
  const m = url.match(/^(https?:\/\/res\.cloudinary\.com\/[^/]+\/video\/upload\/)(.+?)(\.[a-z0-9]+)?(\?.*)?$/i)
  if (!m) return undefined
  return `${m[1]}so_1,w_${width},c_limit,q_auto,f_jpg/${m[2]}.jpg`
}

/**
 * A tiny square version of a picture or video, for previews the size of a
 * fingertip. Cloudinary and Unsplash both resize on request, so a 96px
 * thumbnail costs a couple of kilobytes instead of the full image; anything
 * else is returned as it is.
 */
export function tinyThumb(url?: string, size = 96): string | undefined {
  if (!url) return undefined
  const cld = url.match(/^(https?:\/\/res\.cloudinary\.com\/[^/]+\/)(image|video)(\/upload\/)(.+?)(\.[a-z0-9]+)?(\?.*)?$/i)
  if (cld) {
    const [, base, kind, upload, path] = cld
    const t = `w_${size},h_${size},c_fill,g_auto,q_auto`
    // A video's frame, cut at one second; a picture, cropped to fit.
    return kind === 'video' ? `${base}video${upload}so_1,${t},f_jpg/${path}.jpg` : `${base}image${upload}${t},f_auto/${path}`
  }
  if (/^https?:\/\/images\.unsplash\.com\//.test(url)) {
    const u = new URL(url)
    u.searchParams.set('w', String(size)); u.searchParams.set('h', String(size))
    u.searchParams.set('fit', 'crop'); u.searchParams.set('q', '60')
    return u.toString()
  }
  return url
}

/** True when a URL points at a video file rather than a picture. */
export function looksLikeVideo(url?: string) {
  return !!url && /\.(mp4|mov|webm|m4v|3gp|mkv)(\?|$)/i.test(url)
}

export function isImageFile(file: File) {
  return file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name)
}
export function isVideoFile(file: File) {
  return file.type.startsWith('video/') || /\.(mp4|mov|webm|m4v|3gp)$/i.test(file.name)
}

/** Which step an upload is on, for the progress label. */
export type UploadStage = 'compressing' | 'uploading'
/** Percent of the current stage, 0–100, and which stage that is. */
export type UploadProgress = (pct: number, stage: UploadStage) => void

/**
 * Size ceilings, set under the host's own. Cloudinary refuses videos over
 * 100 MB and images over 10 MB on the plan eMazao is on, so compression aims
 * comfortably below both and a file can never be rejected for size.
 */
const MAX_VIDEO_BYTES = 90 * 1024 * 1024
const MAX_IMAGE_BYTES = 9 * 1024 * 1024
/** Cloudinary takes chunks of 5 MB or more (except the last). */
const CHUNK_BYTES = 6 * 1024 * 1024
/** 720p on the long side: sharp on any phone, a fraction of the 4K a phone records. */
const VIDEO_LONG_SIDE = 1280
const VIDEO_MAX_BITRATE = 2_500_000
const VIDEO_MIN_BITRATE = 500_000
const AUDIO_BITRATE = 96_000

/** A friendly error: its message is safe to show the person as-is. */
export class UploadError extends Error {}

/** A readable reason for a failed upload, including the web server's own refusals. */
export function uploadErrorMessage(err: any): string {
  if (err instanceof UploadError) return err.message
  const status = err?.response?.status
  if (status === 413) return 'That file is too large to upload. Try a shorter video or a smaller photo.'
  if (!err?.response) return err?.message && !/network|fetch/i.test(err.message)
    ? err.message
    : 'Upload interrupted — check your connection and try again.'
  return err?.response?.data?.message ?? 'Upload failed. Please try again.'
}

/**
 * Re-encode a video on the phone so it is small enough to upload anywhere.
 *
 * Phones record in 4K or 1080p at 15–50 Mbps: a minute is 100–400 MB, over
 * every limit between the phone and the video host, and a long wait on mobile
 * data. This uses the phone's own hardware H.264 encoder (WebCodecs, through
 * Mediabunny) — no multi-megabyte ffmpeg download — to bring it to 720p at a
 * bitrate chosen from the clip's length, so the result always fits under the
 * ceiling. It also turns iPhone .mov (HEVC) and in-app .webm into MP4/H.264,
 * which plays on every phone and browser.
 *
 * Where the browser cannot encode (older browsers), the original is returned
 * and the host is left to cope, which is only refused if the original is
 * over the ceiling.
 */
export async function compressVideo(file: File, onProgress?: (pct: number) => void): Promise<File> {
  const isMp4 = file.type === 'video/mp4' || /\.mp4$/i.test(file.name)
  // Small MP4s are already fine; re-encoding would only cost the person time.
  if (isMp4 && file.size <= 15 * 1024 * 1024) return file

  const tooBig = () => new UploadError('This video is too large to upload from this browser. Try a shorter clip, or update your browser.')
  if (typeof (globalThis as any).VideoEncoder === 'undefined') {
    if (file.size > MAX_VIDEO_BYTES) throw tooBig()
    return file
  }

  // Loaded only when a video is actually being compressed, so it costs
  // nothing to people who only ever post photos.
  const mb = await import('mediabunny')
  const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS })
  let video: Awaited<ReturnType<typeof input.getPrimaryVideoTrack>>
  let duration: number
  try {
    video = await input.getPrimaryVideoTrack()
    duration = await input.computeDuration()
  } catch {
    // Not a container the browser can read: send it as it is if it fits.
    if (file.size > MAX_VIDEO_BYTES) throw new UploadError("This video's format can't be read here. Try recording it again, or choose an MP4.")
    return file
  }
  if (!video || !duration) {
    if (file.size > MAX_VIDEO_BYTES) throw tooBig()
    return file
  }

  // Spend the whole size budget across the clip, capped for quality's sake.
  const budgetBits = MAX_VIDEO_BYTES * 8 * 0.9
  const videoBitrate = Math.min(VIDEO_MAX_BITRATE, Math.floor(budgetBits / duration) - AUDIO_BITRATE)
  if (videoBitrate < VIDEO_MIN_BITRATE) {
    const minutes = Math.floor(budgetBits / (VIDEO_MIN_BITRATE + AUDIO_BITRATE) / 60)
    throw new UploadError(`Videos can be up to ${minutes} minutes long. Trim this one and try again.`)
  }

  // Keep the shape, shrink the long side to 720p, and keep both sides even —
  // H.264 will not take an odd dimension.
  const w = video.displayWidth
  const h = video.displayHeight
  const scale = Math.min(1, VIDEO_LONG_SIDE / Math.max(w, h))
  const even = (n: number) => Math.max(2, Math.round(n * scale / 2) * 2)
  const width = even(w)
  const height = even(h)

  const canAvc = await mb.canEncodeVideo('avc', { width, height, bitrate: videoBitrate }).catch(() => false)
  if (!canAvc) {
    if (file.size > MAX_VIDEO_BYTES) throw tooBig()
    return file
  }

  const output = new mb.Output({
    // Moov atom up front, so the video starts playing before it has downloaded.
    format: new mb.Mp4OutputFormat({ fastStart: 'in-memory' }),
    target: new mb.BufferTarget(),
  })
  const conversion = await mb.Conversion.init({
    input,
    output,
    // An explicit bitrate, not a quality level: a bare number passed to Quality
    // means "quality level", which asked the encoder for quantizer mode (not
    // supported everywhere) and put no ceiling on the size — the opposite of
    // what this function is for.
    video: { width, height, fit: 'contain', codec: 'avc', quality: new mb.Quality({ bitrate: videoBitrate, bitrateMode: 'variable' }) },
    audio: { codec: 'aac', quality: new mb.Quality({ bitrate: AUDIO_BITRATE }) },
  })
  // Never trade the sound away for size: if audio cannot be carried over, use
  // the original instead of silently posting a mute video.
  const lostAudio = conversion.discardedTracks.some(d => d.track.type === 'audio')
  if (!conversion.isValid || lostAudio) {
    if (file.size > MAX_VIDEO_BYTES) throw tooBig()
    return file
  }
  conversion.onProgress = p => onProgress?.(Math.round(p * 100))
  await conversion.execute()

  const buffer = (output.target as InstanceType<typeof mb.BufferTarget>).buffer
  if (!buffer) return file
  // Already-efficient files can come out bigger; keep whichever is smaller.
  if (buffer.byteLength >= file.size && file.size <= MAX_VIDEO_BYTES) return file
  const name = (file.name.replace(/\.[^.]+$/, '') || 'video') + '.mp4'
  return new File([buffer], name, { type: 'video/mp4' })
}

/**
 * Keep shrinking a photo until it fits, rather than hoping one pass is enough.
 * One pass almost always is; a panorama or a screenshot of fine print may not.
 */
async function fitImage(file: File): Promise<File> {
  let out = await prepareImage(file)
  for (const [dim, q] of [[1600, 0.8], [1280, 0.75], [1024, 0.7]] as const) {
    if (out.size <= MAX_IMAGE_BYTES) break
    out = await prepareImage(file, dim, q)
  }
  if (out.size > MAX_IMAGE_BYTES) throw new UploadError('This photo is too large to upload. Try a different one.')
  return out
}

interface UploadSignature {
  cloudName: string
  apiKey: string
  resourceType: 'image' | 'video'
  folder: string
  timestamp: number
  signature: string
}

interface CloudinaryResult { secure_url: string; public_id: string; done?: boolean }

/**
 * One chunk to Cloudinary, retried on a dropped connection.
 *
 * XHR rather than fetch because fetch still cannot report upload progress in
 * most browsers, and real progress is the point.
 */
function sendChunk(url: string, form: () => FormData, headers: Record<string, string>, onBytes: (n: number) => void): Promise<CloudinaryResult> {
  const attempt = () => new Promise<CloudinaryResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v)
    xhr.upload.onprogress = e => onBytes(e.loaded)
    xhr.onload = () => {
      let body: any = null
      try { body = JSON.parse(xhr.responseText) } catch { /* not JSON */ }
      if (xhr.status >= 200 && xhr.status < 300) return resolve(body ?? {})
      const err: any = new Error(body?.error?.message || `Upload failed (${xhr.status})`)
      err.status = xhr.status
      reject(err)
    }
    xhr.onerror = () => reject(Object.assign(new Error('network'), { status: 0 }))
    xhr.ontimeout = () => reject(Object.assign(new Error('network'), { status: 0 }))
    xhr.timeout = 3 * 60_000
    xhr.send(form())
  })

  return (async () => {
    // A phone on the move drops connections; one bad moment should not cost the
    // whole upload. Only network failures and server hiccups are retried —
    // a 4xx means the request itself is wrong and will not get better.
    for (let tries = 0; ; tries++) {
      try {
        return await attempt()
      } catch (err: any) {
        const retryable = err.status === 0 || err.status >= 500
        if (!retryable || tries >= 3) throw err
        onBytes(0)
        await new Promise(r => setTimeout(r, [1000, 3000, 6000][tries]))
      }
    }
  })()
}

/** Upload straight to Cloudinary in chunks, reporting bytes actually delivered. */
async function uploadDirect(file: File, sig: UploadSignature, onProgress?: (pct: number) => void): Promise<CloudinaryResult> {
  const url = `https://api.cloudinary.com/v1_1/${sig.cloudName}/${sig.resourceType}/upload`
  const total = file.size
  const chunked = total > CHUNK_BYTES
  const uploadId = (crypto as any).randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
  let sent = 0
  let result: CloudinaryResult | null = null

  for (let start = 0; start < total || (total === 0 && !result); start += CHUNK_BYTES) {
    const end = Math.min(start + CHUNK_BYTES, total)
    const piece = file.slice(start, end)
    const form = () => {
      const f = new FormData()
      f.append('file', piece, file.name)
      f.append('api_key', sig.apiKey)
      f.append('timestamp', String(sig.timestamp))
      f.append('signature', sig.signature)
      f.append('folder', sig.folder)
      return f
    }
    const headers: Record<string, string> = chunked
      ? { 'X-Unique-Upload-Id': uploadId, 'Content-Range': `bytes ${start}-${end - 1}/${total}` }
      : {}
    result = await sendChunk(url, form, headers, n => {
      // Multipart overhead makes e.loaded run slightly past the chunk; clamp it.
      onProgress?.(Math.min(99, Math.round(((sent + Math.min(n, piece.size)) / total) * 100)))
    })
    sent = end
    if (total === 0) break
  }
  if (!result?.secure_url) throw new UploadError('Upload did not finish. Please try again.')
  onProgress?.(100)
  return result
}

/**
 * Upload a photo or video. Photos are shrunk and videos compressed on the
 * phone first, then sent straight to the media host in chunks; `onProgress`
 * reports each stage with a real percentage. Falls back to going through our
 * own server if direct upload is unavailable.
 */
export async function uploadMedia(file: File, report?: UploadProgress): Promise<{ url: string; kind: 'IMAGE' | 'VIDEO'; thumbnailUrl?: string }> {
  const video = isVideoFile(file) && !isImageFile(file)
  // The encoder reports hundreds of times a second; the screen only needs to
  // hear about it when the whole-number percentage actually changes.
  let last = ''
  const onProgress: UploadProgress | undefined = report && ((pct, stage) => {
    const key = `${stage}${pct}`
    if (key !== last) { last = key; report(pct, stage) }
  })

  let ready: File
  if (video) {
    try {
      ready = await compressVideo(file, pct => onProgress?.(pct, 'compressing'))
    } catch (err) {
      if (err instanceof UploadError) throw err
      // The phone's encoder gave up part-way — it happens on some devices.
      // The original still goes up if it is under the limit; only a file that
      // could not have been accepted anyway is refused.
      console.warn('[upload] compression failed, sending the original:', err)
      if (file.size > MAX_VIDEO_BYTES) {
        throw new UploadError("This video couldn't be compressed on this device and is too large to send as it is. Try a shorter clip.")
      }
      ready = file
    }
  } else {
    ready = await fitImage(file)
  }
  onProgress?.(0, 'uploading')

  let sig: UploadSignature | null = null
  try {
    sig = (await api.post<ApiResponse<UploadSignature>>('/upload/sign', { kind: video ? 'video' : 'image' })).data.data
  } catch {
    sig = null // not configured on this server: use the old path below
  }

  if (sig) {
    const result = await uploadDirect(ready, sig, pct => onProgress?.(pct, 'uploading'))
    const url = video ? asMp4(result.secure_url) : result.secure_url
    return { url, kind: video ? 'VIDEO' : 'IMAGE', thumbnailUrl: video ? videoPoster(url) : undefined }
  }

  const form = new FormData()
  form.append('file', ready)
  const res = await api.post<ApiResponse<{ url: string; thumbnailUrl?: string }>>(video ? '/upload/video' : '/upload/image', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: video ? 10 * 60_000 : 2 * 60_000,
    onUploadProgress: e => { if (e.total) onProgress?.(Math.min(99, Math.round((e.loaded / e.total) * 100)), 'uploading') },
  })
  onProgress?.(100, 'uploading')
  return { url: res.data.data.url, kind: video ? 'VIDEO' : 'IMAGE', thumbnailUrl: res.data.data.thumbnailUrl }
}

/**
 * Deliver a Cloudinary video as MP4 whatever it was uploaded as. Cloudinary
 * converts on request when the extension changes, so a .webm or .mov that
 * could not be compressed on the phone still plays everywhere.
 */
function asMp4(url: string): string {
  return /\/video\/upload\//.test(url) ? url.replace(/\.(mov|webm|m4v|3gp|mkv|avi)(\?|$)/i, '.mp4$2') : url
}

/** "Compressing 40%" / "Uploading 72%" — the words every upload screen shows. */
export function uploadLabel(pct: number, stage: UploadStage): string {
  return stage === 'compressing' ? `Compressing ${pct}%` : `Uploading ${pct}%`
}
