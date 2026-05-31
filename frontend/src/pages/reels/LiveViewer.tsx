import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send, Users, Heart, Share2, Volume2, VolumeX, Loader2, WifiOff } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { getSocket } from '@/lib/socket'
import { formatNumber } from '@/lib/utils'

interface LiveComment { username: string; text: string; id: string }

// STUN + free TURN fallback for cross-network connections
const ICE = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'turn:openrelay.metered.ca:80',              username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443',             username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
  ],
}

type ConnState = 'connecting' | 'connected' | 'failed'

export default function LiveViewer() {
  const { broadcasterId } = useParams<{ broadcasterId: string }>()
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [commentText, setCommentText] = useState('')
  const [comments, setComments] = useState<LiveComment[]>([])
  const [viewerCount, setViewerCount] = useState(1)
  const [streamEnded, setStreamEnded] = useState(false)
  const [muted, setMuted] = useState(true)          // start muted to satisfy browser autoplay
  const [connState, setConnState] = useState<ConnState>('connecting')
  const videoRef = useRef<HTMLVideoElement>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)

  const socket = user ? getSocket(user._id) : null

  useEffect(() => {
    if (!socket || !user || !broadcasterId) return

    const pc = new RTCPeerConnection(ICE)
    pcRef.current = pc

    pc.ontrack = e => {
      if (videoRef.current) {
        videoRef.current.srcObject = e.streams[0]
        setConnState('connected')
      }
    }

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        setConnState('failed')
      } else if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        setConnState('connected')
      }
    }

    pc.onicecandidate = e => {
      if (e.candidate) socket.emit('live:ice-candidate', { to: broadcasterId, from: user._id, candidate: e.candidate })
    }

    socket.emit('live:join', { broadcasterId, viewerId: user._id })

    socket.on('live:offer', async ({ from, sdp }: { from: string; sdp: RTCSessionDescriptionInit }) => {
      if (from !== broadcasterId) return
      await pc.setRemoteDescription(new RTCSessionDescription(sdp))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      socket.emit('live:answer', { to: broadcasterId, from: user._id, sdp: answer })
    })

    socket.on('live:ice-candidate', async ({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
      if (from !== broadcasterId) return
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)) } catch {}
    })

    socket.on('live:comment', (data: { username: string; text: string }) => {
      setComments(prev => [{ ...data, id: Date.now().toString() }, ...prev].slice(0, 50))
    })

    socket.on('live:ended', () => setStreamEnded(true))

    return () => {
      socket.emit('live:leave', { broadcasterId, viewerId: user._id })
      pc.close()
      socket.off('live:offer')
      socket.off('live:ice-candidate')
      socket.off('live:comment')
      socket.off('live:ended')
    }
  }, [socket, user, broadcasterId])

  const sendComment = () => {
    if (!commentText.trim() || !socket || !user || !broadcasterId) return
    socket.emit('live:comment', { broadcasterId, username: user.username, text: commentText.trim() })
    setComments(prev => [{ username: user.username, text: commentText.trim(), id: Date.now().toString() }, ...prev].slice(0, 50))
    setCommentText('')
  }

  const CommentItem = ({ c }: { c: LiveComment }) => {
    const isMe = c.username === user?.username
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className={`flex items-start gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${isMe ? 'bg-brand-green text-white' : 'bg-white/15 text-white'}`}>
          {c.username[0]?.toUpperCase()}
        </div>
        <div className={`flex flex-col max-w-[80%] ${isMe ? 'items-end' : 'items-start'}`}>
          <span className={`text-xs font-semibold ${isMe ? 'text-brand-lime' : 'text-brand-lime'}`}>
            {isMe ? 'You' : `@${c.username}`}
          </span>
          <span className={`text-xs px-2 py-1 rounded-xl mt-0.5 ${isMe ? 'bg-brand-green/25 text-white' : 'text-white/80'}`}>
            {c.text}
          </span>
        </div>
      </motion.div>
    )
  }

  return (
    <div className="h-screen bg-black overflow-hidden relative">
      {/* Full-screen video — starts muted to satisfy browser autoplay policy */}
      <video ref={videoRef} autoPlay playsInline muted={muted} className="absolute inset-0 w-full h-full object-cover" />

      {/* Connection state overlay */}
      {connState === 'connecting' && !streamEnded && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20 pointer-events-none">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-10 w-10 text-white/70 animate-spin" />
            <p className="text-white/60 text-sm">Connecting to stream…</p>
          </div>
        </div>
      )}
      {connState === 'failed' && !streamEnded && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-20">
          <div className="flex flex-col items-center gap-4 text-center px-6">
            <WifiOff className="h-12 w-12 text-red-400" />
            <p className="text-white font-semibold">Connection failed</p>
            <p className="text-white/50 text-sm">Could not reach the stream. The broadcaster may be on a restricted network.</p>
            <button onClick={() => window.location.reload()} className="text-brand-green text-sm underline">Try again</button>
          </div>
        </div>
      )}

      {/* Stream ended overlay */}
      {streamEnded && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center flex-col gap-4 z-20">
          <p className="text-white text-xl font-bold">Live stream ended</p>
          <button onClick={() => navigate('/reels')} className="text-brand-green text-sm underline">Back to Reels</button>
        </div>
      )}

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center gap-3 p-4 bg-gradient-to-b from-black/60 to-transparent">
        <motion.div animate={{ opacity: [1, 0.5, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}
          className="flex items-center gap-2 bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-full">
          <div className="w-2 h-2 rounded-full bg-white" /> LIVE
        </motion.div>
        <div className="bg-black/50 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1">
          <Users className="h-3 w-3" />{formatNumber(viewerCount)}
        </div>
        <div className="flex-1" />
        {/* Unmute button — browsers block audio autoplay until user interaction */}
        <button
          onClick={() => setMuted(m => !m)}
          className="flex items-center gap-1.5 bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-full text-white text-xs font-medium border border-white/20 mr-1"
        >
          {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          {muted ? 'Unmute' : 'Mute'}
        </button>
        <button
          onClick={async () => {
            const url = `${window.location.origin}/live/${broadcasterId}`
            if (navigator.share) {
              try { await navigator.share({ title: 'Watch live on eMazao', url }) } catch {}
            } else {
              const el = document.createElement('textarea')
              el.value = url
              el.style.cssText = 'position:fixed;opacity:0'
              document.body.appendChild(el); el.select()
              document.execCommand('copy'); document.body.removeChild(el)
            }
          }}
          className="w-9 h-9 rounded-full bg-black/40 flex items-center justify-center text-white hover:bg-black/60 transition-colors mr-1"
        >
          <Share2 className="h-4 w-4" />
        </button>
        <button onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-black/40 flex items-center justify-center text-white hover:bg-black/60 transition-colors">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* ── Desktop: side-by-side comments panel ── */}
      <div className="hidden lg:flex absolute inset-0 z-10 pointer-events-none">
        <div className="flex-1" />
        <div className="w-80 bg-[#111827]/90 backdrop-blur-sm flex flex-col border-l border-white/10 pointer-events-auto">
          <div className="px-4 py-3 border-b border-white/10 flex-shrink-0">
            <h3 className="text-white font-semibold text-sm">Comments</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3 flex flex-col-reverse">
            <AnimatePresence>{comments.map(c => <CommentItem key={c.id} c={c} />)}</AnimatePresence>
          </div>
          <div className="p-3 border-t border-white/10 flex gap-2 flex-shrink-0">
            <input value={commentText} onChange={e => setCommentText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendComment()}
              placeholder="Say something…"
              className="flex-1 bg-white/10 rounded-xl px-3 py-2 text-white text-xs placeholder:text-white/30 focus:outline-none" />
            <button onClick={sendComment}
              className="w-8 h-8 bg-brand-green rounded-xl flex items-center justify-center text-white flex-shrink-0">
              <Send className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile: floating comments + bottom input ── */}
      <div className="lg:hidden absolute bottom-0 left-0 right-0 z-10">
        {/* Scrolling comment feed over video */}
        <div className="px-4 pb-2 space-y-2 max-h-48 overflow-hidden flex flex-col-reverse pointer-events-none">
          <AnimatePresence>
            {comments.slice(0, 8).map(c => (
              <motion.div key={c.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                className="flex items-start gap-2 bg-black/50 backdrop-blur-sm rounded-xl px-3 py-1.5 w-fit max-w-[85%]">
                <div className="w-5 h-5 rounded-full bg-brand-green/30 flex items-center justify-center flex-shrink-0 text-[10px] text-brand-green font-bold">
                  {c.username[0]?.toUpperCase()}
                </div>
                <div>
                  <span className="text-brand-lime text-[11px] font-semibold">@{c.username} </span>
                  <span className="text-white/90 text-[11px]">{c.text}</span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Mobile input bar */}
        <div className="flex items-center gap-2 px-4 py-3 bg-black/60 backdrop-blur-sm border-t border-white/10">
          <input
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendComment()}
            placeholder="Say something…"
            className="flex-1 bg-white/10 rounded-full px-4 py-2 text-white text-sm placeholder:text-white/40 focus:outline-none"
          />
          <button onClick={sendComment}
            className="w-9 h-9 bg-brand-green rounded-full flex items-center justify-center text-white flex-shrink-0">
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Mobile heart button */}
      <motion.button
        whileTap={{ scale: 1.4 }}
        onClick={() => {
          if (broadcasterId && socket && user) {
            socket.emit('live:comment', { broadcasterId, username: user.username, text: '❤️' })
          }
        }}
        className="lg:hidden absolute bottom-20 right-4 z-10 w-12 h-12 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center"
      >
        <Heart className="h-6 w-6 text-red-400" />
      </motion.button>
    </div>
  )
}
