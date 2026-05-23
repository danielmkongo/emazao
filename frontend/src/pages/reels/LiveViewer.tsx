import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send, Users, Heart } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { getSocket } from '@/lib/socket'
import { formatNumber } from '@/lib/utils'

interface LiveComment { username: string; text: string; id: string }

const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }

export default function LiveViewer() {
  const { broadcasterId } = useParams<{ broadcasterId: string }>()
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [commentText, setCommentText] = useState('')
  const [comments, setComments] = useState<LiveComment[]>([])
  const [viewerCount, setViewerCount] = useState(1)
  const [streamEnded, setStreamEnded] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)

  const socket = user ? getSocket(user._id) : null

  useEffect(() => {
    if (!socket || !user || !broadcasterId) return

    const pc = new RTCPeerConnection(ICE)
    pcRef.current = pc

    pc.ontrack = e => {
      if (videoRef.current) videoRef.current.srcObject = e.streams[0]
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
      await pc.addIceCandidate(new RTCIceCandidate(candidate))
    })

    socket.on('live:comment', (data: { username: string; text: string }) => {
      setComments(prev => [{ ...data, id: Date.now().toString() }, ...prev].slice(0, 50))
    })

    socket.on('live:ended', () => setStreamEnded(true))

    return () => {
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

  return (
    <div className="h-screen bg-black flex overflow-hidden">
      <div className="relative flex-1">
        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />

        {streamEnded && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center flex-col gap-4">
            <p className="text-white text-xl font-bold">Live stream ended</p>
            <button onClick={() => navigate('/reels')} className="text-brand-green text-sm underline">Back to Reels</button>
          </div>
        )}

        <div className="absolute top-4 left-4 flex items-center gap-3">
          <motion.div animate={{ opacity: [1, 0.5, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}
            className="flex items-center gap-2 bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-full">
            <div className="w-2 h-2 rounded-full bg-white" />
            LIVE
          </motion.div>
          <div className="bg-black/50 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1">
            <Users className="h-3 w-3" />{formatNumber(viewerCount)}
          </div>
        </div>

        <button onClick={() => navigate(-1)}
          className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/40 flex items-center justify-center text-white hover:bg-black/60">
          <X className="h-5 w-5" />
        </button>

        <motion.button whileTap={{ scale: 1.4 }}
          onClick={() => {
            if (broadcasterId && socket && user) {
              socket.emit('live:comment', { broadcasterId, username: user.username, text: '❤️' })
            }
          }}
          className="absolute bottom-6 right-4 w-12 h-12 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center">
          <Heart className="h-6 w-6 text-red-400" />
        </motion.button>
      </div>

      <div className="w-72 bg-[#111827] flex flex-col border-l border-white/10">
        <div className="px-4 py-3 border-b border-white/10">
          <h3 className="text-white font-semibold text-sm">Comments</h3>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3 flex flex-col-reverse">
          <AnimatePresence>
            {comments.map(c => (
              <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
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
            placeholder="Say something..."
            className="flex-1 bg-white/10 rounded-xl px-3 py-2 text-white text-xs placeholder:text-white/30 focus:outline-none" />
          <button onClick={sendComment} className="w-8 h-8 bg-brand-green rounded-xl flex items-center justify-center text-white">
            <Send className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  )
}
