/**
 * Camera helpers shared by calls, live and the story camera.
 */

export type Facing = 'user' | 'environment'

/** Open one camera. Asks for the exact lens first so "back" really is the back. */
export async function openCamera(facing: Facing, withAudio = false): Promise<MediaStream> {
  const video = { width: { ideal: 1280 }, height: { ideal: 720 } }
  try {
    return await navigator.mediaDevices.getUserMedia({ video: { ...video, facingMode: { exact: facing } }, audio: withAudio })
  } catch {
    // Laptops with one webcam, or desktops that do not label lenses.
    return navigator.mediaDevices.getUserMedia({ video: { ...video, facingMode: facing }, audio: withAudio })
  }
}

/** Draw a video into a box, cropping to fill it (CSS object-fit: cover). */
export function drawCover(ctx: CanvasRenderingContext2D, v: HTMLVideoElement, x: number, y: number, w: number, h: number, mirror = false) {
  const vw = v.videoWidth, vh = v.videoHeight
  if (!vw || !vh) return
  const scale = Math.max(w / vw, h / vh)
  const sw = w / scale, sh = h / scale
  const sx = (vw - sw) / 2, sy = (vh - sh) / 2
  ctx.save()
  if (mirror) { ctx.translate(x + w, y); ctx.scale(-1, 1); ctx.drawImage(v, sx, sy, sw, sh, 0, 0, w, h) }
  else ctx.drawImage(v, sx, sy, sw, sh, x, y, w, h)
  ctx.restore()
}

function playing(stream: MediaStream) {
  const v = document.createElement('video')
  v.muted = true; v.autoplay = true; v.playsInline = true
  v.srcObject = stream
  void v.play().catch(() => {})
  return v
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export interface DualCamera {
  /** One video track showing both cameras, ready to send or record. */
  track: MediaStreamTrack
  canvas: HTMLCanvasElement
  /** Swap which camera is the big one. */
  swap: () => void
  stop: () => void
}

/**
 * Both cameras in one picture: the back camera fills the frame (usually the
 * produce) and the front camera sits in a rounded inset (the seller talking
 * about it). Painted onto a canvas whose stream is a single ordinary video
 * track, so the other side of a call, a live audience or a recording needs
 * nothing special to see both.
 *
 * Many phones, iPhones especially, cannot run two cameras at once; this then
 * throws with a message worth showing as-is.
 */
export async function startDualCamera(existing?: { stream: MediaStream; facing: Facing }): Promise<DualCamera> {
  let front: MediaStream, back: MediaStream
  const owned: MediaStream[] = []
  try {
    if (existing) {
      const other = await openCamera(existing.facing === 'user' ? 'environment' : 'user')
      owned.push(other)
      front = existing.facing === 'user' ? new MediaStream(existing.stream.getVideoTracks()) : other
      back = existing.facing === 'user' ? other : new MediaStream(existing.stream.getVideoTracks())
    } else {
      back = await openCamera('environment'); owned.push(back)
      front = await openCamera('user'); owned.push(front)
    }
  } catch (err: any) {
    owned.forEach(s => s.getTracks().forEach(t => t.stop()))
    throw new Error(err?.name === 'NotReadableError' || err?.name === 'OverconstrainedError' || err?.name === 'AbortError'
      ? 'This phone can only use one camera at a time.'
      : 'The second camera is not available on this device.')
  }

  const frontEl = playing(front), backEl = playing(back)
  const canvas = document.createElement('canvas')
  canvas.width = 720
  canvas.height = 1280
  const ctx = canvas.getContext('2d')!
  let frontBig = false
  let raf = 0

  const paint = () => {
    const W = canvas.width, H = canvas.height
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, W, H)
    const big = frontBig ? frontEl : backEl
    const small = frontBig ? backEl : frontEl
    drawCover(ctx, big, 0, 0, W, H, frontBig)
    const iw = Math.round(W * 0.34), ih = Math.round(iw * 4 / 3)
    // Top-left: clear of call controls and story buttons at the bottom, and of
    // the other person's own camera tile at the top-right.
    const ix = 28, iy = 150
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 24
    roundedRect(ctx, ix, iy, iw, ih, 28)
    ctx.fillStyle = '#000'; ctx.fill()
    ctx.shadowBlur = 0
    ctx.clip()
    drawCover(ctx, small, ix, iy, iw, ih, !frontBig)
    ctx.restore()
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(255,255,255,0.9)'
    roundedRect(ctx, ix, iy, iw, ih, 28); ctx.stroke()
    raf = requestAnimationFrame(paint)
  }
  paint()

  const track = canvas.captureStream(30).getVideoTracks()[0]
  return {
    track,
    canvas,
    swap: () => { frontBig = !frontBig },
    stop: () => {
      cancelAnimationFrame(raf)
      track.stop()
      owned.forEach(s => s.getTracks().forEach(t => t.stop()))
      frontEl.srcObject = null; backEl.srcObject = null
    },
  }
}
