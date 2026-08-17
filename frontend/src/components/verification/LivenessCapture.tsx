import { useState, useRef, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Camera, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import api from '@/lib/api'
import type { ApiResponse } from '@/types'

type Action = 'BLINK' | 'LOOK_LEFT' | 'LOOK_RIGHT' | 'SMILE' | 'OPEN_MOUTH'

const ACTION_PROMPTS: Record<Action, string> = {
  BLINK: 'Blink slowly, twice',
  LOOK_LEFT: 'Turn your head to the left',
  LOOK_RIGHT: 'Turn your head to the right',
  SMILE: 'Smile',
  OPEN_MOUTH: 'Open your mouth',
}

interface Challenge { nonce: string; actions: Action[]; expiresInMs: number }

/** Seconds spent capturing each action before moving to the next prompt. */
const SECONDS_PER_ACTION = 3
const FRAMES_PER_ACTION = 6

/**
 * Camera-based liveness check.
 *
 * The action sequence comes from the server and is different every time, so a
 * pre-recorded video of someone performing the actions won't match. Frames are
 * sent to the server for scoring — this component never decides the outcome
 * itself, because anything the browser asserts can simply be forged.
 */
export function LivenessCapture({ onComplete }: { onComplete: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const framesRef = useRef<string[]>([])

  const [phase, setPhase] = useState<'idle' | 'starting' | 'running' | 'submitting' | 'done' | 'error'>('idle')
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [actionIndex, setActionIndex] = useState(0)
  const [countdown, setCountdown] = useState(SECONDS_PER_ACTION)
  const [error, setError] = useState<string | null>(null)

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  // Release the camera if the user navigates away mid-check — otherwise the
  // indicator light stays on and the device stays locked to this tab.
  useEffect(() => stopCamera, [stopCamera])

  const captureFrame = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !video.videoWidth) return
    // Downscale: full-resolution frames make the payload enormous and the vision
    // service doesn't need them for landmark detection.
    const w = 480
    const h = (video.videoHeight / video.videoWidth) * w
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d')?.drawImage(video, 0, 0, w, h)
    framesRef.current.push(canvas.toDataURL('image/jpeg', 0.7).split(',')[1])
  }, [])

  const start = async () => {
    setPhase('starting')
    setError(null)
    framesRef.current = []

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      const res = await api.post<ApiResponse<Challenge>>('/verification/liveness/challenge')
      const data = res.data.data
      if (!data) throw new Error('Could not start the check')

      setChallenge(data)
      setActionIndex(0)
      setCountdown(SECONDS_PER_ACTION)
      setPhase('running')
    } catch (err: any) {
      stopCamera()
      setPhase('error')
      setError(
        err?.name === 'NotAllowedError'
          ? 'Camera access was blocked. Allow camera access in your browser, then try again.'
          : err?.response?.data?.message ?? 'Could not start the camera.',
      )
    }
  }

  // Drives the prompt sequence: capture frames throughout each action, then
  // advance. Submits once the last action completes.
  useEffect(() => {
    if (phase !== 'running' || !challenge) return

    const frameTimer = setInterval(captureFrame, (SECONDS_PER_ACTION * 1000) / FRAMES_PER_ACTION)
    const tick = setInterval(() => setCountdown(c => c - 1), 1000)

    const advance = setTimeout(() => {
      if (actionIndex + 1 < challenge.actions.length) {
        setActionIndex(i => i + 1)
        setCountdown(SECONDS_PER_ACTION)
      } else {
        setPhase('submitting')
      }
    }, SECONDS_PER_ACTION * 1000)

    return () => {
      clearInterval(frameTimer)
      clearInterval(tick)
      clearTimeout(advance)
    }
  }, [phase, challenge, actionIndex, captureFrame])

  useEffect(() => {
    if (phase !== 'submitting' || !challenge) return
    let cancelled = false

    ;(async () => {
      try {
        await api.post('/verification/liveness/verify', {
          nonce: challenge.nonce,
          frames: framesRef.current,
        })
        if (cancelled) return
        stopCamera()
        setPhase('done')
        onComplete()
      } catch (err: any) {
        if (cancelled) return
        stopCamera()
        setPhase('error')
        setError(err?.response?.data?.message ?? 'The check did not pass. Please try again.')
      }
    })()

    return () => { cancelled = true }
  }, [phase, challenge, stopCamera, onComplete])

  return (
    <div className="space-y-4">
      <div className="relative aspect-[3/4] max-h-[420px] mx-auto w-full rounded-2xl overflow-hidden bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          // Mirrored so turning left moves the on-screen face left — an unmirrored
          // preview makes people turn the wrong way.
          className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
        />
        <canvas ref={canvasRef} className="hidden" />

        {phase === 'running' && challenge && (
          <>
            <div className="absolute inset-0 border-[3px] border-brand-green/70 rounded-2xl pointer-events-none" />
            <motion.div
              key={actionIndex}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-5 text-center"
            >
              <p className="text-white text-lg font-semibold">
                {ACTION_PROMPTS[challenge.actions[actionIndex]]}
              </p>
              <p className="text-white/60 text-sm mt-1">
                Step {actionIndex + 1} of {challenge.actions.length} · {Math.max(0, countdown)}s
              </p>
            </motion.div>
          </>
        )}

        {(phase === 'idle' || phase === 'error') && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Camera className="h-12 w-12 text-white/20" />
          </div>
        )}

        {phase === 'submitting' && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 text-white animate-spin" />
            <p className="text-white text-sm">Checking…</p>
          </div>
        )}

        {phase === 'done' && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-3">
            <CheckCircle2 className="h-12 w-12 text-brand-green" />
            <p className="text-white font-medium">Liveness confirmed</p>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {(phase === 'idle' || phase === 'error') && (
        <>
          <p className="text-sm text-[var(--c-text-3)] text-center">
            We'll ask you to perform a few short actions on camera. This confirms a real person is
            present — it takes about 10 seconds.
          </p>
          <Button className="w-full" onClick={start}>
            {phase === 'error' ? 'Try again' : 'Start camera check'}
          </Button>
        </>
      )}

      {phase === 'starting' && (
        <Button className="w-full" disabled loading>
          Starting camera…
        </Button>
      )}
    </div>
  )
}
