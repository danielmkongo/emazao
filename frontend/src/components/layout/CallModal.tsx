import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, FlipHorizontal } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { getSocket } from '@/lib/socket'
import { useAuthStore } from '@/store/authStore'

interface CallState {
  type: 'idle' | 'calling' | 'incoming' | 'connected'
  video: boolean
  callerId?: string
  callerName?: string
  callerAvatar?: string
  calleeId?: string
  calleeName?: string
  calleeAvatar?: string
}

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
}

let peerConnection: RTCPeerConnection | null = null

export function useCallStore() {
  const [call, setCall] = useState<CallState>({ type: 'idle', video: false })
  return { call, setCall }
}

export default function CallModal({
  call,
  setCall,
}: {
  call: ReturnType<typeof useCallStore>['call']
  setCall: ReturnType<typeof useCallStore>['setCall']
}) {
  const { user } = useAuthStore()
  const [micMuted, setMicMuted] = useState(false)
  const [camOff, setCamOff] = useState(false)
  const [mirrored, setMirrored] = useState(true)
  const [duration, setDuration] = useState(0)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const cleanup = useCallback(() => {
    localStreamRef.current?.getTracks().forEach(t => t.stop())
    localStreamRef.current = null
    peerConnection?.close()
    peerConnection = null
    if (timerRef.current) clearInterval(timerRef.current)
    setDuration(0)
  }, [])

  const hangUp = useCallback((notify = true) => {
    if (!user) return
    const otherId = call.callerId ?? call.calleeId
    if (notify && otherId) {
      const socket = getSocket(user._id)
      socket.emit('call:end', { to: otherId })
    }
    cleanup()
    setCall({ type: 'idle', video: false })
  }, [call, user, cleanup, setCall])

  const startLocalStream = async (video: boolean) => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video })
    localStreamRef.current = stream
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream
    }
    return stream
  }

  const createPeer = (stream: MediaStream, onIce: (c: RTCIceCandidate) => void) => {
    const pc = new RTCPeerConnection(ICE_SERVERS)
    stream.getTracks().forEach(t => pc.addTrack(t, stream))
    pc.onicecandidate = e => e.candidate && onIce(e.candidate)
    pc.ontrack = e => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0]
    }
    peerConnection = pc
    return pc
  }

  // Socket event listeners
  useEffect(() => {
    if (!user?._id) return
    const socket = getSocket(user._id)

    socket.on('call:incoming', (data: { callerId: string; callerName: string; callerAvatar?: string; video: boolean }) => {
      setCall({ type: 'incoming', video: data.video, callerId: data.callerId, callerName: data.callerName, callerAvatar: data.callerAvatar })
    })

    socket.on('call:accepted', async ({ calleeId }: { calleeId: string }) => {
      const stream = await startLocalStream(call.video)
      const pc = createPeer(stream, (c) => socket.emit('call:ice-candidate', { to: calleeId, from: user._id, candidate: c }))
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      socket.emit('call:offer', { to: calleeId, from: user._id, sdp: offer })
      setCall(prev => ({ ...prev, type: 'connected' }))
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
    })

    socket.on('call:declined', () => {
      cleanup()
      setCall({ type: 'idle', video: false })
    })

    socket.on('call:offer', async ({ from, sdp }: { from: string; sdp: RTCSessionDescriptionInit }) => {
      const stream = localStreamRef.current ?? await startLocalStream(call.video)
      const pc = createPeer(stream, (c) => socket.emit('call:ice-candidate', { to: from, from: user._id, candidate: c }))
      await pc.setRemoteDescription(new RTCSessionDescription(sdp))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      socket.emit('call:answer', { to: from, from: user._id, sdp: answer })
      setCall(prev => ({ ...prev, type: 'connected' }))
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
    })

    socket.on('call:answer', async ({ sdp }: { sdp: RTCSessionDescriptionInit }) => {
      await peerConnection?.setRemoteDescription(new RTCSessionDescription(sdp))
    })

    socket.on('call:ice-candidate', async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
      await peerConnection?.addIceCandidate(new RTCIceCandidate(candidate))
    })

    socket.on('call:ended', () => {
      cleanup()
      setCall({ type: 'idle', video: false })
    })

    return () => {
      socket.off('call:incoming')
      socket.off('call:accepted')
      socket.off('call:declined')
      socket.off('call:offer')
      socket.off('call:answer')
      socket.off('call:ice-candidate')
      socket.off('call:ended')
    }
  }, [user?._id, call.video])

  const acceptCall = async () => {
    if (!user || !call.callerId) return
    const socket = getSocket(user._id)
    const stream = await startLocalStream(call.video)
    localStreamRef.current = stream
    socket.emit('call:accept', { callerId: call.callerId, calleeId: user._id })
    setCall(prev => ({ ...prev, type: 'connected' }))
  }

  const declineCall = () => {
    if (!user || !call.callerId) return
    const socket = getSocket(user._id)
    socket.emit('call:decline', { callerId: call.callerId })
    setCall({ type: 'idle', video: false })
  }

  const toggleMic = () => {
    const track = localStreamRef.current?.getAudioTracks()[0]
    if (track) { track.enabled = !track.enabled; setMicMuted(m => !m) }
  }

  const toggleCam = () => {
    const track = localStreamRef.current?.getVideoTracks()[0]
    if (track) { track.enabled = !track.enabled; setCamOff(c => !c) }
  }

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  if (call.type === 'idle') return null

  const displayName = call.type === 'incoming' ? call.callerName : call.calleeName
  const displayAvatar = call.type === 'incoming' ? call.callerAvatar : call.calleeAvatar

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center"
      >
        {/* Remote video (full screen) */}
        {call.video && call.type === 'connected' && (
          <video ref={remoteVideoRef} autoPlay playsInline
            className="absolute inset-0 w-full h-full object-cover" />
        )}

        {/* Local video (pip) */}
        {call.video && (
          <video ref={localVideoRef} autoPlay playsInline muted
            className="absolute bottom-28 right-4 w-28 h-40 rounded-xl object-cover border-2 border-white/20 z-10 cursor-pointer"
            style={{ transform: mirrored ? 'scaleX(-1)' : 'none' }}
            onClick={() => setMirrored(m => !m)}
            title="Tap to mirror"
          />
        )}

        {/* Overlay UI */}
        <div className="relative z-10 flex flex-col items-center gap-6 text-center px-6">
          <Avatar src={displayAvatar} name={displayName ?? 'User'} size="2xl" />
          <div>
            <h2 className="text-2xl font-bold text-white">{displayName}</h2>
            <p className="text-white/60 mt-1 text-sm">
              {call.type === 'incoming' ? 'Incoming call...' :
               call.type === 'calling' ? 'Calling...' :
               fmt(duration)}
            </p>
          </div>

          {/* Incoming call actions */}
          {call.type === 'incoming' && (
            <div className="flex gap-8 mt-4">
              <div className="flex flex-col items-center gap-2">
                <motion.button whileTap={{ scale: 0.9 }}
                  onClick={declineCall}
                  className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center text-white shadow-xl">
                  <PhoneOff className="h-7 w-7" />
                </motion.button>
                <span className="text-white/60 text-xs">Decline</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <motion.button whileTap={{ scale: 0.9 }}
                  onClick={acceptCall}
                  className="w-16 h-16 rounded-full bg-brand-green flex items-center justify-center text-white shadow-xl">
                  <Phone className="h-7 w-7" />
                </motion.button>
                <span className="text-white/60 text-xs">Accept</span>
              </div>
            </div>
          )}

          {/* Active call controls */}
          {(call.type === 'calling' || call.type === 'connected') && (
            <div className="flex gap-5 mt-4">
              <div className="flex flex-col items-center gap-2">
                <button onClick={toggleMic}
                  className={`w-14 h-14 rounded-full flex items-center justify-center text-white ${micMuted ? 'bg-white/20' : 'bg-white/10'}`}>
                  {micMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                </button>
                <span className="text-white/40 text-xs">{micMuted ? 'Unmute' : 'Mute'}</span>
              </div>

              {call.video && (
                <div className="flex flex-col items-center gap-2">
                  <button onClick={toggleCam}
                    className={`w-14 h-14 rounded-full flex items-center justify-center text-white ${camOff ? 'bg-white/20' : 'bg-white/10'}`}>
                    {camOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
                  </button>
                  <span className="text-white/40 text-xs">{camOff ? 'Camera on' : 'Camera off'}</span>
                </div>
              )}

              {call.video && (
                <div className="flex flex-col items-center gap-2">
                  <button onClick={() => setMirrored(m => !m)}
                    className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center text-white">
                    <FlipHorizontal className="h-6 w-6" />
                  </button>
                  <span className="text-white/40 text-xs">Flip</span>
                </div>
              )}

              <div className="flex flex-col items-center gap-2">
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => hangUp(true)}
                  className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center text-white shadow-xl">
                  <PhoneOff className="h-6 w-6" />
                </motion.button>
                <span className="text-white/40 text-xs">End</span>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
