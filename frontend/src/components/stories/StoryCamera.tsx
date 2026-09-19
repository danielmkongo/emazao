import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { X, RefreshCw, Images, Layers, Loader2 } from 'lucide-react'
import { openCamera, startDualCamera, type DualCamera, type Facing } from '@/lib/camera'

const MAX_VIDEO_MS = 30_000
const HOLD_MS = 280

function recorderType() {
  const types = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
  return types.find(t => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) ?? ''
}

/**
 * The story camera: a live viewfinder inside the app, the way Instagram does
 * it, instead of handing off to the browser (which on many phones and every
 * computer opens a file picker). Tap the shutter for a photo, hold it to
 * record up to 30 seconds. Front, back, or both cameras at once — the product
 * full screen with your face in the corner.
 */
export function StoryCamera({ onCapture, onGallery, onClose }: {
  onCapture: (file: File) => void
  onGallery: () => void
  onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const micRef = useRef<MediaStream | null>(null)
  const dualRef = useRef<DualCamera | null>(null)
  const [facing, setFacing] = useState<Facing>('environment')
  const [dual, setDual] = useState(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const holdTimer = useRef<number>()
  const pressedAt = useRef(0)

  const stopAll = useCallback(() => {
    dualRef.current?.stop(); dualRef.current = null
    streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null
    micRef.current?.getTracks().forEach(t => t.stop()); micRef.current = null
  }, [])

  const show = (stream: MediaStream) => {
    if (videoRef.current) { videoRef.current.srcObject = stream; void videoRef.current.play().catch(() => {}) }
  }

  // Open (or re-open) the chosen camera setup.
  useEffect(() => {
    let cancelled = false
    setReady(false)
    ;(async () => {
      stopAll()
      try {
        if (dual) {
          const d = await startDualCamera()
          if (cancelled) { d.stop(); return }
          dualRef.current = d
          show(new MediaStream([d.track]))
        } else {
          const s = await openCamera(facing)
          if (cancelled) { s.getTracks().forEach(t => t.stop()); return }
          streamRef.current = s
          show(s)
        }
        setReady(true)
      } catch (e: any) {
        if (cancelled) return
        if (dual) { setNotice(e.message); setDual(false); return }
        setError(e?.name === 'NotAllowedError'
          ? 'Camera access is blocked. Allow it in your browser settings, or choose from your gallery.'
          : 'No camera is available here. You can choose from your gallery instead.')
      }
    })()
    return () => { cancelled = true }
  }, [facing, dual, stopAll])

  useEffect(() => () => stopAll(), [stopAll])
  useEffect(() => { if (!notice) return; const t = window.setTimeout(() => setNotice(null), 3500); return () => clearTimeout(t) }, [notice])

  const mirrored = !dual && facing === 'user'

  const takePhoto = async () => {
    const v = videoRef.current
    const src: CanvasImageSource | null = dualRef.current?.canvas ?? v
    if (!src || !v) return
    const w = dualRef.current ? dualRef.current.canvas.width : v.videoWidth
    const h = dualRef.current ? dualRef.current.canvas.height : v.videoHeight
    if (!w || !h) return
    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d')!
    if (mirrored) { ctx.translate(w, 0); ctx.scale(-1, 1) }
    ctx.drawImage(src, 0, 0, w, h)
    const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.88))
    if (blob) { stopAll(); onCapture(new File([blob], `story-${Date.now()}.jpg`, { type: 'image/jpeg' })) }
  }

  const startRecording = async () => {
    const videoTrack = dualRef.current?.track ?? streamRef.current?.getVideoTracks()[0]
    if (!videoTrack) return
    try { micRef.current = await navigator.mediaDevices.getUserMedia({ audio: true }) } catch { micRef.current = null }
    const stream = new MediaStream([videoTrack, ...(micRef.current?.getAudioTracks() ?? [])])
    const type = recorderType()
    let rec: MediaRecorder
    try { rec = new MediaRecorder(stream, type ? { mimeType: type, videoBitsPerSecond: 2_500_000 } : undefined) }
    catch { setNotice('Recording video is not supported in this browser — tap for a photo instead.'); return }
    chunks.current = []
    rec.ondataavailable = e => { if (e.data.size) chunks.current.push(e.data) }
    rec.onstop = () => {
      const mime = rec.mimeType || type || 'video/webm'
      const blob = new Blob(chunks.current, { type: mime })
      stopAll()
      if (blob.size) onCapture(new File([blob], `story-${Date.now()}.${mime.includes('mp4') ? 'mp4' : 'webm'}`, { type: mime.split(';')[0] }))
    }
    rec.start(250)
    recorderRef.current = rec
    setRecording(true)
    const started = Date.now()
    const tick = window.setInterval(() => {
      const ms = Date.now() - started
      setElapsed(ms)
      if (ms >= MAX_VIDEO_MS) { window.clearInterval(tick); stopRecording() }
    }, 100)
    ;(rec as any)._tick = tick
  }

  const stopRecording = () => {
    const rec = recorderRef.current
    if (!rec) return
    window.clearInterval((rec as any)._tick)
    recorderRef.current = null
    setRecording(false)
    setElapsed(0)
    if (rec.state !== 'inactive') rec.stop()
  }

  // Shutter: a quick tap is a photo, holding records.
  const onDown = () => {
    if (!ready) return
    pressedAt.current = Date.now()
    holdTimer.current = window.setTimeout(() => { void startRecording() }, HOLD_MS)
  }
  const onUp = () => {
    window.clearTimeout(holdTimer.current)
    if (recorderRef.current) { stopRecording(); return }
    if (Date.now() - pressedAt.current < HOLD_MS) void takePhoto()
  }

  const progress = elapsed / MAX_VIDEO_MS

  return (
    <div className="absolute inset-0 z-20 bg-black flex flex-col">
      <video ref={videoRef} playsInline muted autoPlay
        className="absolute inset-0 w-full h-full object-cover"
        style={{ transform: mirrored ? 'scaleX(-1)' : undefined }} />

      {!ready && !error && (
        <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="h-8 w-8 text-white/70 animate-spin" /></div>
      )}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-10 text-center">
          <p className="text-white/85 text-[15px]">{error}</p>
          <button onClick={onGallery} className="h-11 px-5 rounded-full bg-white text-black font-semibold press">Choose from gallery</button>
        </div>
      )}

      {/* Top */}
      <div className="relative z-10 flex items-center justify-between px-2 pt-[calc(env(safe-area-inset-top,0px)+8px)]">
        <button onClick={() => { stopAll(); onClose() }} aria-label="Close camera" className="w-11 h-11 rounded-full flex items-center justify-center text-white bg-black/30 backdrop-blur press">
          <X className="h-6 w-6" />
        </button>
        {recording ? (
          <span className="flex items-center gap-2 px-3 h-8 rounded-full bg-red-600 text-white text-[13px] font-bold tabular">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" /> {Math.floor(elapsed / 1000)}s
          </span>
        ) : (
          <button onClick={() => setDual(d => !d)} aria-pressed={dual}
            className={`h-10 px-3.5 rounded-full flex items-center gap-2 text-[13px] font-semibold backdrop-blur press ${dual ? 'bg-white text-black' : 'bg-black/35 text-white'}`}>
            <Layers className="h-4 w-4" /> Both cameras
          </button>
        )}
      </div>

      {notice && (
        <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="relative z-10 mx-auto mt-3 px-4 py-2 rounded-xl bg-black/70 text-white text-[13px] text-center max-w-[85%]">
          {notice}
        </motion.p>
      )}

      {/* Bottom */}
      <div className="relative z-10 mt-auto pb-[calc(env(safe-area-inset-bottom,0px)+26px)] pt-6 bg-gradient-to-t from-black/60 to-transparent">
        <p className="text-center text-white/80 text-[12.5px] mb-4">{recording ? 'Release to stop' : 'Tap for photo, hold for video'}</p>
        <div className="flex items-center justify-around">
          <button onClick={() => { stopAll(); onGallery() }} aria-label="Choose from gallery" className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center text-white press">
            <Images className="h-6 w-6" />
          </button>

          <button
            aria-label="Shutter: tap for a photo, hold to record"
            onPointerDown={onDown} onPointerUp={onUp} onPointerLeave={() => { if (recorderRef.current) onUp() }}
            onContextMenu={e => e.preventDefault()}
            disabled={!ready}
            className="relative w-[84px] h-[84px] rounded-full flex items-center justify-center select-none touch-none disabled:opacity-40"
          >
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 84 84">
              <circle cx="42" cy="42" r="38" fill="none" stroke="white" strokeWidth="5" opacity={recording ? 0.35 : 1} />
              {recording && <circle cx="42" cy="42" r="38" fill="none" stroke="#ef4444" strokeWidth="5" strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 38} strokeDashoffset={2 * Math.PI * 38 * (1 - progress)} />}
            </svg>
            <motion.span animate={{ scale: recording ? 0.55 : 1, borderRadius: recording ? 10 : 999 }}
              className={`w-[64px] h-[64px] ${recording ? 'bg-red-500' : 'bg-white'}`} />
          </button>

          <button onClick={() => { if (dual) { dualRef.current?.swap() } else setFacing(f => (f === 'user' ? 'environment' : 'user')) }}
            aria-label={dual ? 'Swap cameras' : 'Flip camera'} disabled={recording}
            className="w-12 h-12 rounded-full bg-white/15 backdrop-blur flex items-center justify-center text-white press disabled:opacity-40">
            <RefreshCw className="h-6 w-6" />
          </button>
        </div>
      </div>
    </div>
  )
}
