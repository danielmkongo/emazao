import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, CameraOff, Mic, MicOff, Radio, X, Send, Users, AlertCircle, RefreshCw, SwitchCamera, MessageCircle, LayoutGrid } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/authStore'
import { getSocket } from '@/lib/socket'
import { ICE_SERVERS as ICE } from '@/lib/webrtc'
import { formatNumber } from '@/lib/utils'

interface LiveComment { username: string; text: string; id: string }

type PermState = 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable' | 'insecure' | 'in_use'

/**
 * Draw `v` into the destination box using object-cover semantics: fill the box
 * completely and crop the overflow, rather than letterboxing. Each camera has
 * its own aspect ratio (and the back camera is often wider than the front), so
 * scaling to fit would leave uneven black bars between the two panes.
 */
function drawCover(ctx: CanvasRenderingContext2D, v: HTMLVideoElement, dx: number, dy: number, dw: number, dh: number) {
  const vw = v.videoWidth, vh = v.videoHeight
  if (!vw || !vh) return
  const scale = Math.max(dw / vw, dh / vh)
  const sw = dw / scale, sh = dh / scale
  ctx.drawImage(v, (vw - sw) / 2, (vh - sh) / 2, sw, sh, dx, dy, dw, dh)
}

export default function LiveBroadcast() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [isLive, setIsLive] = useState(false)
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(true)
  const [title, setTitle] = useState('')
  const [commentText, setCommentText] = useState('')
  const [comments, setComments] = useState<LiveComment[]>([])
  const [viewerCount, setViewerCount] = useState(0)
  const [duration, setDuration] = useState(0)
  const [permState, setPermState] = useState<PermState>('idle')
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')
  const [dualCam, setDualCam] = useState(false)
  const [dualError, setDualError] = useState<string | null>(null)
  const [dualBusy, setDualBusy] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const peers = useRef<Map<string, RTCPeerConnection>>(new Map())
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Dual-camera compositing. Viewers receive one video track, so both cameras are
  // painted onto a canvas and that canvas's captureStream replaces the outgoing
  // track — no second peer connection and no change required on the viewer side.
  const dualRafRef = useRef<number | null>(null)
  const secondStreamRef = useRef<MediaStream | null>(null)
  const primaryTrackRef = useRef<MediaStreamTrack | null>(null)
  const canvasTrackRef = useRef<MediaStreamTrack | null>(null)

  const socket = user ? getSocket() : null

  // Request camera access immediately on mount so the browser prompts right away
  const requestCamera = useCallback(async () => {
    // getUserMedia requires HTTPS (or localhost) — browsers block it on plain HTTP
    if (!window.isSecureContext) {
      setPermState('insecure')
      return
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setPermState('unavailable')
      return
    }
    setPermState('requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      setPermState('granted')
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermState('denied')
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setPermState('unavailable')
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setPermState('in_use')
      } else {
        // Fallback: show the raw error name so user can report it
        console.error('getUserMedia error:', err.name, err.message)
        setPermState('denied')
      }
    }
  }, [])

  useEffect(() => {
    requestCamera()
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [requestCamera])

  const goLive = () => {
    if (!socket || !user || !streamRef.current) return
    socket.emit('live:start', { title: title || `${user.name} is live!` })
    setIsLive(true)
    timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
    // Keep the LiveSession's TTL alive server-side — if this stops (crash, tab
    // close without a clean 'live:end'), the session expires on its own instead
    // of showing as permanently "LIVE".
    heartbeatRef.current = setInterval(() => socket.emit('live:heartbeat'), 15_000)
  }

  const stopStream = () => {
    if (!socket || !user) return
    socket.emit('live:end', { broadcasterId: user._id })
    if (dualRafRef.current !== null) { cancelAnimationFrame(dualRafRef.current); dualRafRef.current = null }
    secondStreamRef.current?.getTracks().forEach(t => t.stop())
    primaryTrackRef.current?.stop()
    streamRef.current?.getTracks().forEach(t => t.stop())
    peers.current.forEach(pc => pc.close())
    peers.current.clear()
    if (timerRef.current) clearInterval(timerRef.current)
    if (heartbeatRef.current) clearInterval(heartbeatRef.current)
    navigate('/reels')
  }

  useEffect(() => () => { if (heartbeatRef.current) clearInterval(heartbeatRef.current) }, [])

  const createPeerForViewer = useCallback((viewerId: string) => {
    if (!socket || !user || !streamRef.current) return
    const pc = new RTCPeerConnection(ICE)
    streamRef.current.getTracks().forEach(t => pc.addTrack(t, streamRef.current!))
    pc.onicecandidate = e => {
      if (e.candidate) socket.emit('live:ice-candidate', { to: viewerId, from: user._id, candidate: e.candidate })
    }
    peers.current.set(viewerId, pc)
    pc.createOffer().then(offer => {
      pc.setLocalDescription(offer)
      socket.emit('live:offer', { to: viewerId, from: user._id, sdp: offer })
    })
  }, [socket, user])

  useEffect(() => {
    if (!socket || !user) return
    socket.on('live:viewer-joined', ({ viewerId }: { viewerId: string }) => {
      createPeerForViewer(viewerId)
    })
    socket.on('live:viewer-count', ({ count }: { count: number }) => {
      setViewerCount(count)
    })
    socket.on('live:viewer-left', ({ viewerId }: { viewerId: string }) => {
      const pc = peers.current.get(viewerId)
      if (pc) { pc.close(); peers.current.delete(viewerId) }
    })
    socket.on('live:answer', async ({ from, sdp }: { from: string; sdp: RTCSessionDescriptionInit }) => {
      const pc = peers.current.get(from)
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(sdp))
    })
    socket.on('live:ice-candidate', async ({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
      const pc = peers.current.get(from)
      if (pc) await pc.addIceCandidate(new RTCIceCandidate(candidate))
    })
    socket.on('live:comment', (data: { username: string; text: string }) => {
      setComments(prev => [{ ...data, id: Date.now().toString() }, ...prev].slice(0, 50))
    })
    return () => {
      socket.off('live:viewer-joined')
      socket.off('live:viewer-count')
      socket.off('live:viewer-left')
      socket.off('live:answer')
      socket.off('live:ice-candidate')
      socket.off('live:comment')
    }
  }, [socket, user, createPeerForViewer])

  const toggleMic = () => {
    const t = streamRef.current?.getAudioTracks()[0]
    if (t) { t.enabled = !t.enabled; setMicOn(m => !m) }
  }

  const toggleCam = () => {
    const t = streamRef.current?.getVideoTracks()[0]
    if (!t) return
    t.enabled = !t.enabled
    // While compositing, the outgoing track is the canvas — blanking it alone
    // would leave both source cameras running and the last frame painted.
    primaryTrackRef.current && (primaryTrackRef.current.enabled = t.enabled)
    secondStreamRef.current?.getVideoTracks().forEach(v => { v.enabled = t.enabled })
    setCamOn(c => !c)
  }

  // ── Dual camera ────────────────────────────────────────────────────────────
  // Restore the single-camera track everywhere. Safe to call when dual is off.
  const stopDualCamera = useCallback(() => {
    if (dualRafRef.current !== null) { cancelAnimationFrame(dualRafRef.current); dualRafRef.current = null }
    secondStreamRef.current?.getTracks().forEach(t => t.stop())
    secondStreamRef.current = null

    const stream = streamRef.current
    const primary = primaryTrackRef.current
    if (stream && primary) {
      const canvasTrack = canvasTrackRef.current
      if (canvasTrack) { stream.removeTrack(canvasTrack); canvasTrack.stop() }
      if (!stream.getVideoTracks().includes(primary)) stream.addTrack(primary)
      peers.current.forEach(pc => {
        pc.getSenders().find(x => x.track?.kind === 'video')?.replaceTrack(primary).catch(() => {})
      })
      if (videoRef.current) videoRef.current.srcObject = stream
    }
    canvasTrackRef.current = null
    primaryTrackRef.current = null
    setDualCam(false)
  }, [])

  const startDualCamera = useCallback(async () => {
    const stream = streamRef.current
    const primary = stream?.getVideoTracks()[0]
    if (!stream || !primary) return
    setDualBusy(true)
    setDualError(null)

    const other = facingMode === 'user' ? 'environment' : 'user'
    let second: MediaStream
    try {
      // `exact` first so we genuinely get the opposite lens; without it a device
      // with one camera happily returns the same one twice and the two panes are
      // identical. Fall back to a soft constraint for desktops with two webcams
      // that do not report facingMode at all.
      second = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: other } }, audio: false })
    } catch {
      try {
        second = await navigator.mediaDevices.getUserMedia({ video: { facingMode: other }, audio: false })
      } catch (err: any) {
        // Most phones (iOS Safari in particular) refuse to open a second camera
        // while one is already streaming. Say so plainly and stay single-camera
        // rather than dropping the broadcast that is already running.
        setDualError(err?.name === 'NotReadableError' || err?.name === 'OverconstrainedError'
          ? 'This device can only use one camera at a time.'
          : 'The second camera is unavailable on this device.')
        setDualBusy(false)
        return
      }
    }

    const mkVideo = (src: MediaStream) => {
      const v = document.createElement('video')
      v.muted = true; v.autoplay = true; v.playsInline = true
      v.srcObject = src
      void v.play().catch(() => {})
      return v
    }
    // The primary track keeps running as a draw source, so it is removed from the
    // outgoing stream but deliberately never stopped.
    const frontEl = mkVideo(new MediaStream([primary]))
    const backEl = mkVideo(second)

    const canvas = document.createElement('canvas')
    canvas.width = 720
    canvas.height = 1280
    const ctx = canvas.getContext('2d')
    if (!ctx) { second.getTracks().forEach(t => t.stop()); setDualBusy(false); return }

    const half = canvas.height / 2
    const paint = () => {
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      // Rear lens on top: it is usually pointed at the produce, which is the
      // subject, while the seller's face is the commentary underneath.
      drawCover(ctx, other === 'environment' ? backEl : frontEl, 0, 0, canvas.width, half)
      drawCover(ctx, other === 'environment' ? frontEl : backEl, 0, half, canvas.width, half)
      dualRafRef.current = requestAnimationFrame(paint)
    }
    paint()

    const canvasTrack = canvas.captureStream(30).getVideoTracks()[0]
    canvasTrack.enabled = camOn
    primaryTrackRef.current = primary
    secondStreamRef.current = second
    canvasTrackRef.current = canvasTrack

    stream.removeTrack(primary)
    stream.addTrack(canvasTrack)
    peers.current.forEach(pc => {
      pc.getSenders().find(x => x.track?.kind === 'video')?.replaceTrack(canvasTrack).catch(() => {})
    })
    if (videoRef.current) videoRef.current.srcObject = stream

    setDualCam(true)
    setDualBusy(false)
  }, [facingMode, camOn])

  useEffect(() => () => {
    if (dualRafRef.current !== null) cancelAnimationFrame(dualRafRef.current)
    secondStreamRef.current?.getTracks().forEach(t => t.stop())
    primaryTrackRef.current?.stop()
  }, [])

  // Flip between front/back camera, live-swapping the outgoing track for every viewer.
  const flipCamera = async () => {
    if (!streamRef.current) return
    const next = facingMode === 'user' ? 'environment' : 'user'
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: next }, audio: false })
      const newTrack = newStream.getVideoTracks()[0]
      if (!newTrack) return
      newTrack.enabled = camOn
      // Replace the video track in each viewer's peer connection (no renegotiation needed)
      peers.current.forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video')
        sender?.replaceTrack(newTrack).catch(() => {})
      })
      // Swap the local preview track
      const old = streamRef.current.getVideoTracks()[0]
      if (old) { streamRef.current.removeTrack(old); old.stop() }
      streamRef.current.addTrack(newTrack)
      if (videoRef.current) videoRef.current.srcObject = streamRef.current
      setFacingMode(next)
    } catch (err) {
      console.error('flip camera failed', err)
    }
  }

  const sendComment = () => {
    if (!commentText.trim() || !socket || !user || !isLive) return
    socket.emit('live:comment', { broadcasterId: user._id, username: user.username, text: commentText.trim() })
    setComments(prev => [{ username: user.username, text: commentText.trim(), id: Date.now().toString() }, ...prev].slice(0, 50))
    setCommentText('')
  }

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  // ── Permission error screen ────────────────────────────────────────────────
  if (permState === 'insecure') {
    return (
      <div className="h-screen bg-black flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 rounded-full bg-yellow-500/20 border-2 border-yellow-500/40 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="h-9 w-9 text-yellow-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-3">HTTPS required</h2>
          <p className="text-white/60 text-sm mb-8">
            Camera access requires a secure connection. Open the app via <span className="text-white font-mono">https://</span> — browsers block camera on plain HTTP outside of localhost.
          </p>
          <Button variant="ghost" onClick={() => navigate(-1)} className="text-white/60">Go back</Button>
        </div>
      </div>
    )
  }

  if (permState === 'in_use') {
    return (
      <div className="h-screen bg-black flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 rounded-full bg-orange-500/20 border-2 border-orange-500/40 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="h-9 w-9 text-orange-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-3">Camera in use</h2>
          <p className="text-white/60 text-sm mb-8">
            Another app is currently using your camera (a video call, another tab, etc.). Close it and try again.
          </p>
          <div className="flex flex-col gap-3">
            <Button onClick={() => { setPermState('idle'); requestCamera() }} className="w-full">
              <RefreshCw className="h-4 w-4" /> Try again
            </Button>
            <Button variant="ghost" onClick={() => navigate(-1)} className="w-full text-white/60">Go back</Button>
          </div>
        </div>
      </div>
    )
  }

  if (permState === 'denied') {
    return (
      <div className="h-screen bg-black flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 rounded-full bg-red-500/20 border-2 border-red-500/40 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="h-9 w-9 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-3">Camera access blocked</h2>
          <p className="text-white/60 text-sm mb-2">
            Your browser has blocked camera and microphone access for this site. You need to allow it to go live.
          </p>
          <p className="text-white/40 text-xs mb-8">
            Click the lock icon (🔒) in your browser's address bar → find "Camera" and "Microphone" → set both to "Allow" → then refresh this page.
          </p>
          <div className="flex flex-col gap-3">
            <Button onClick={() => { setPermState('idle'); requestCamera() }} className="w-full">
              <RefreshCw className="h-4 w-4" /> Try again
            </Button>
            <Button variant="ghost" onClick={() => navigate(-1)} className="w-full text-white/60">
              Go back
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (permState === 'unavailable') {
    return (
      <div className="h-screen bg-black flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 rounded-full bg-yellow-500/20 border-2 border-yellow-500/40 flex items-center justify-center mx-auto mb-6">
            <CameraOff className="h-9 w-9 text-yellow-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-3">No camera detected</h2>
          <p className="text-white/60 text-sm mb-8">
            No camera or microphone was found on this device. Please connect a camera to go live.
          </p>
          <Button variant="ghost" onClick={() => navigate(-1)} className="text-white/60">
            Go back
          </Button>
        </div>
      </div>
    )
  }

  const ControlButton = ({ on, onClick, onIcon, offIcon, danger }: { on: boolean; onClick: () => void; onIcon: ReactNode; offIcon: ReactNode; danger?: boolean }) => (
    <button onClick={onClick}
      className={`w-12 h-12 rounded-full flex items-center justify-center text-white transition-colors flex-shrink-0 ${on ? 'bg-white/20 hover:bg-white/30' : danger ? 'bg-red-500' : 'bg-white/20'}`}>
      {on ? onIcon : offIcon}
    </button>
  )

  const commentBubbles = (compact: boolean) => (
    <AnimatePresence>
      {comments.map(c => {
        const isMe = c.username === user?.username
        return (
          <motion.div key={c.id} initial={{ opacity: 0, x: isMe ? 10 : -10 }} animate={{ opacity: 1, x: 0 }}
            className={`flex items-start gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${isMe ? 'bg-brand-green text-white' : 'bg-brand-green/20 text-brand-green'}`}>
              {c.username[0]?.toUpperCase()}
            </div>
            <div className={`max-w-[80%] flex flex-col ${isMe ? 'items-end text-right' : ''}`}>
              <span className={`text-[11px] font-semibold ${isMe ? 'text-brand-green' : 'text-brand-lime'}`}>
                {isMe ? 'You (host)' : `@${c.username}`}
              </span>
              <span className={`text-xs px-2 py-1 rounded-xl mt-0.5 inline-block ${compact ? 'bg-black/40 backdrop-blur-sm text-white' : isMe ? 'bg-brand-green/20 text-white' : 'text-white/80'}`}>
                {c.text}
              </span>
            </div>
          </motion.div>
        )
      })}
    </AnimatePresence>
  )

  const commentInput = (
    <div className="flex gap-2">
      <input value={commentText} onChange={e => setCommentText(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && sendComment()}
        placeholder="Say something…"
        className="flex-1 min-w-0 bg-white/15 backdrop-blur-sm rounded-full px-4 py-2.5 text-white text-sm placeholder:text-white/40 focus:outline-none focus:bg-white/20" />
      <button onClick={sendComment} className="w-10 h-10 bg-brand-green rounded-full flex items-center justify-center text-white hover:bg-brand-emerald transition-colors flex-shrink-0">
        <Send className="h-4 w-4" />
      </button>
    </div>
  )

  return (
    <div className="h-[100dvh] bg-black flex overflow-hidden">
      {/* ── Video ── */}
      <div className="relative flex-1 min-w-0">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />

        {/* Second camera could not be opened — the broadcast carries on with one. */}
        {dualError && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 bg-black/85 border border-white/15 text-white text-xs px-3 py-2 rounded-xl max-w-[80%] text-center">
            {dualError}
            <button onClick={() => setDualError(null)} className="ml-2 text-white/50 hover:text-white">✕</button>
          </div>
        )}

        {/* Requesting permission overlay */}
        {permState === 'requesting' && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-4 px-6 text-center">
            <div className="w-16 h-16 rounded-full border-4 border-brand-green border-t-transparent animate-spin" />
            <p className="text-white text-sm">Requesting camera access…</p>
            <p className="text-white/40 text-xs">Allow camera and microphone in the browser prompt above</p>
          </div>
        )}

        {/* Pre-live setup (camera granted, not yet live) */}
        {permState === 'granted' && !isLive && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center px-6">
            <div className="flex flex-col items-center gap-5 w-full max-w-xs">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-brand-green/20 border-2 border-brand-green flex items-center justify-center mx-auto mb-3">
                  <Radio className="h-7 w-7 text-brand-green" />
                </div>
                <h2 className="text-xl font-bold text-white mb-1">Ready to go live</h2>
                <p className="text-white/50 text-xs">Your camera is on — viewers will see you</p>
              </div>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="What are you streaming today?"
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-brand-green"
              />
              <Button onClick={goLive} className="w-full py-3 text-base">
                <Radio className="h-5 w-5" /> Go Live Now
              </Button>
            </div>
          </div>
        )}

        {/* Live badge + stats */}
        {isLive && (
          <div className="absolute top-4 left-4 flex items-center gap-2 z-20" style={{ top: 'calc(1rem + env(safe-area-inset-top))' }}>
            <motion.div animate={{ opacity: [1, 0.5, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}
              className="flex items-center gap-2 bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-full">
              <div className="w-2 h-2 rounded-full bg-white" /> LIVE
            </motion.div>
            <div className="bg-black/50 text-white text-xs px-3 py-1.5 rounded-full font-mono">{fmt(duration)}</div>
            <div className="bg-black/50 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1">
              <Users className="h-3 w-3" />{formatNumber(viewerCount)}
            </div>
          </div>
        )}

        {/* Mobile floating comments (over the video, never a full panel) */}
        {isLive && (
          <div className="lg:hidden absolute left-3 right-3 bottom-[136px] max-h-[34vh] overflow-y-auto no-scrollbar flex flex-col-reverse gap-2 z-10 pointer-events-none">
            {commentBubbles(true)}
          </div>
        )}

        {/* Controls — centred; sits above the mobile comment bar, lower on desktop */}
        {isLive && (
          <div className="absolute left-1/2 -translate-x-1/2 bottom-[76px] lg:bottom-6 flex items-center gap-3 lg:gap-4 z-20">
            <ControlButton on={micOn} onClick={toggleMic} onIcon={<Mic className="h-5 w-5" />} offIcon={<MicOff className="h-5 w-5" />} danger />
            <ControlButton on={camOn} onClick={toggleCam} onIcon={<Camera className="h-5 w-5" />} offIcon={<CameraOff className="h-5 w-5" />} danger />
            <button
              onClick={() => (dualCam ? stopDualCamera() : void startDualCamera())}
              disabled={dualBusy}
              aria-pressed={dualCam}
              aria-label={dualCam ? 'Single camera' : 'Show both cameras'}
              className={`w-11 h-11 rounded-full flex items-center justify-center text-white transition-colors disabled:opacity-40 ${dualCam ? 'bg-brand-green' : 'bg-white/10 hover:bg-white/20'}`}>
              <LayoutGrid className="h-5 w-5" />
            </button>
            <button onClick={flipCamera} disabled={dualCam} aria-label="Flip camera"
              className="w-12 h-12 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors flex-shrink-0">
              <SwitchCamera className="h-5 w-5" />
            </button>
            <button onClick={stopStream} aria-label="End stream"
              className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shadow-xl transition-colors flex-shrink-0">
              <X className="h-6 w-6" />
            </button>
          </div>
        )}

        {/* Mobile comment input bar */}
        {isLive && (
          <div className="lg:hidden absolute left-3 right-3 bottom-4 z-20">
            {commentInput}
          </div>
        )}

        {/* Close pre-live */}
        {!isLive && (
          <button onClick={() => navigate(-1)} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors z-20" style={{ top: 'calc(1rem + env(safe-area-inset-top))' }}>
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* ── Desktop comments side panel ── */}
      {isLive && (
        <div className="hidden lg:flex w-80 bg-[#111827] flex-col border-l border-white/10">
          <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-brand-green" />
            <h3 className="text-white font-semibold text-sm">Live Comments</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3 flex flex-col-reverse">
            {commentBubbles(false)}
          </div>
          <div className="p-3 border-t border-white/10">
            {commentInput}
          </div>
        </div>
      )}
    </div>
  )
}
