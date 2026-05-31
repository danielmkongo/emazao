import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, CameraOff, Mic, MicOff, Radio, X, Send, Users, AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/authStore'
import { getSocket } from '@/lib/socket'
import { formatNumber } from '@/lib/utils'

interface LiveComment { username: string; text: string; id: string }

const ICE = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'turn:openrelay.metered.ca:80',               username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443',              username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
  ],
}

type PermState = 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable' | 'insecure' | 'in_use'

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

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const peers = useRef<Map<string, RTCPeerConnection>>(new Map())
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const socket = user ? getSocket(user._id) : null

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
    socket.emit('live:start', { broadcasterId: user._id, title: title || `${user.name} is live!` })
    setIsLive(true)
    timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
  }

  const stopStream = () => {
    if (!socket || !user) return
    socket.emit('live:end', { broadcasterId: user._id })
    streamRef.current?.getTracks().forEach(t => t.stop())
    peers.current.forEach(pc => pc.close())
    peers.current.clear()
    if (timerRef.current) clearInterval(timerRef.current)
    navigate('/reels')
  }

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
      setViewerCount(c => c + 1)
      createPeerForViewer(viewerId)
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
    if (t) { t.enabled = !t.enabled; setCamOn(c => !c) }
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

  return (
    <div className="h-screen bg-black flex overflow-hidden">
      {/* ── Video ── */}
      <div className="relative flex-1">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />

        {/* Requesting permission overlay */}
        {permState === 'requesting' && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 rounded-full border-4 border-brand-green border-t-transparent animate-spin" />
            <p className="text-white text-sm">Requesting camera access…</p>
            <p className="text-white/40 text-xs">Allow camera and microphone in the browser prompt above</p>
          </div>
        )}

        {/* Pre-live setup (camera granted, not yet live) */}
        {permState === 'granted' && !isLive && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="flex flex-col items-center gap-5 w-72">
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
          <div className="absolute top-4 left-4 flex items-center gap-3">
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

        {/* Controls */}
        {isLive && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4">
            <button onClick={toggleMic}
              className={`w-12 h-12 rounded-full flex items-center justify-center text-white transition-colors ${micOn ? 'bg-white/20 hover:bg-white/30' : 'bg-red-500'}`}>
              {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            </button>
            <button onClick={toggleCam}
              className={`w-12 h-12 rounded-full flex items-center justify-center text-white transition-colors ${camOn ? 'bg-white/20 hover:bg-white/30' : 'bg-red-500'}`}>
              {camOn ? <Camera className="h-5 w-5" /> : <CameraOff className="h-5 w-5" />}
            </button>
            <button onClick={stopStream}
              className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shadow-xl transition-colors">
              <X className="h-6 w-6" />
            </button>
          </div>
        )}

        {/* Close pre-live */}
        {!isLive && (
          <button onClick={() => navigate(-1)} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* ── Live comments panel ── */}
      {isLive && (
        <div className="w-80 bg-[#111827] flex flex-col border-l border-white/10">
          <div className="px-4 py-3 border-b border-white/10">
            <h3 className="text-white font-semibold text-sm">Live Comments</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3 flex flex-col-reverse">
            <AnimatePresence>
              {comments.map(c => (
                <motion.div key={c.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                  className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-brand-green/20 flex items-center justify-center flex-shrink-0 text-xs text-brand-green font-bold">
                    {c.username[0]?.toUpperCase()}
                  </div>
                  <div>
                    <span className="text-brand-lime text-xs font-semibold">@{c.username} </span>
                    <span className="text-white/80 text-xs">{c.text}</span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <div className="p-3 border-t border-white/10 flex gap-2">
            <input value={commentText} onChange={e => setCommentText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendComment()}
              placeholder="Say something…"
              className="flex-1 bg-white/10 rounded-xl px-3 py-2 text-white text-xs placeholder:text-white/30 focus:outline-none" />
            <button onClick={sendComment} className="w-8 h-8 bg-brand-green rounded-xl flex items-center justify-center text-white hover:bg-brand-emerald transition-colors">
              <Send className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
