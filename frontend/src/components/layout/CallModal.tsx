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
    // Free public TURN relay so calls also connect across different networks
    // (mobile data ↔ wifi / strict NATs), where STUN alone fails.
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
  ],
}

let peerConnection: RTCPeerConnection | null = null
// ICE candidates can arrive before the remote description is set — adding them then
// throws and the candidate is lost (a top cause of "rings but never connects"). We
// buffer until the remote description exists, then flush.
let pendingCandidates: RTCIceCandidateInit[] = []

async function flushPendingCandidates() {
  if (!peerConnection?.remoteDescription) return
  for (const c of pendingCandidates) {
    try { await peerConnection.addIceCandidate(new RTCIceCandidate(c)) } catch { /* ignore */ }
  }
  pendingCandidates = []
}

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
  const [rtcConnected, setRtcConnected] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const remoteStreamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const cleanup = useCallback(() => {
    localStreamRef.current?.getTracks().forEach(t => t.stop())
    localStreamRef.current = null
    remoteStreamRef.current = null
    peerConnection?.close()
    peerConnection = null
    pendingCandidates = []
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    setMicMuted(false)
    setCamOff(false)
    setRtcConnected(false)
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

  // Friendly message for the common getUserMedia failures.
  const mediaError = (video: boolean) => {
    if (!window.isSecureContext) return 'Calls need a secure (https) connection.'
    return video
      ? 'Camera/microphone blocked. Allow access in your browser, then try again.'
      : 'Microphone blocked. Allow access in your browser, then try again.'
  }

  const createPeer = (stream: MediaStream, onIce: (c: RTCIceCandidate) => void) => {
    const pc = new RTCPeerConnection(ICE_SERVERS)
    pendingCandidates = []
    stream.getTracks().forEach(t => pc.addTrack(t, stream))
    pc.onicecandidate = e => e.candidate && onIce(e.candidate)
    pc.onconnectionstatechange = () => {
      // The call timer starts here — when media is actually flowing — so both sides
      // count the same talk time, not "time since the accept button".
      if (pc.connectionState === 'connected') setRtcConnected(true)
      if (pc.connectionState === 'failed') {
        setErrorMsg('Call connection failed — check your network and try again.')
        hangUp(true)
      }
    }
    pc.ontrack = e => {
      // Stash the remote stream and attach it — a dedicated effect re-attaches if the
      // media element mounts slightly later, so audio/video never silently drops.
      remoteStreamRef.current = e.streams[0]
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = e.streams[0]
        remoteVideoRef.current.play?.().catch(() => {})
      }
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
      try {
        const stream = await startLocalStream(call.video)
        const pc = createPeer(stream, (c) => socket.emit('call:ice-candidate', { to: calleeId, from: user._id, candidate: c }))
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        socket.emit('call:offer', { to: calleeId, from: user._id, sdp: offer })
        setCall(prev => ({ ...prev, type: 'connected' }))
      } catch {
        setErrorMsg(mediaError(call.video))
        hangUp(true)
      }
    })

    socket.on('call:declined', () => {
      cleanup()
      setCall({ type: 'idle', video: false })
    })

    socket.on('call:offer', async ({ from, sdp }: { from: string; sdp: RTCSessionDescriptionInit }) => {
      try {
        const stream = localStreamRef.current ?? await startLocalStream(call.video)
        const pc = createPeer(stream, (c) => socket.emit('call:ice-candidate', { to: from, from: user._id, candidate: c }))
        await pc.setRemoteDescription(new RTCSessionDescription(sdp))
        await flushPendingCandidates()
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        socket.emit('call:answer', { to: from, from: user._id, sdp: answer })
        setCall(prev => ({ ...prev, type: 'connected' }))
      } catch {
        setErrorMsg(mediaError(call.video))
        hangUp(true)
      }
    })

    socket.on('call:answer', async ({ sdp }: { sdp: RTCSessionDescriptionInit }) => {
      await peerConnection?.setRemoteDescription(new RTCSessionDescription(sdp))
      await flushPendingCandidates()
    })

    socket.on('call:ice-candidate', async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
      // Buffer until the remote description is set, otherwise addIceCandidate throws.
      if (peerConnection?.remoteDescription) {
        try { await peerConnection.addIceCandidate(new RTCIceCandidate(candidate)) } catch { /* ignore */ }
      } else {
        pendingCandidates.push(candidate)
      }
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

  // Re-attach the remote stream once the media element is mounted (handles the
  // race where ontrack fires before React renders the <video>).
  useEffect(() => {
    if (call.type === 'connected' && remoteVideoRef.current && remoteStreamRef.current) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current
      remoteVideoRef.current.play?.().catch(() => {})
    }
  }, [call.type, call.video])

  // Keep the local preview attached whenever a video call is on screen.
  useEffect(() => {
    if (call.video && localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current
    }
  }, [call.type, call.video])

  // Auto-dismiss the error toast
  useEffect(() => {
    if (!errorMsg) return
    const t = setTimeout(() => setErrorMsg(null), 6000)
    return () => clearTimeout(t)
  }, [errorMsg])

  // Stop ringing after 35s if the other side never answers (or is offline).
  useEffect(() => {
    if (call.type !== 'calling') return
    const t = setTimeout(() => { setErrorMsg('No answer.'); hangUp(true) }, 35_000)
    return () => clearTimeout(t)
  }, [call.type, hangUp])

  // Talk-time ticks only while media is actually connected — identical on both ends.
  useEffect(() => {
    if (!rtcConnected) return
    if (!timerRef.current) timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null } }
  }, [rtcConnected])

  const acceptCall = async () => {
    if (!user || !call.callerId) return
    const socket = getSocket(user._id)
    try {
      // Acquire mic/cam first — if this fails the call can't proceed, and we must
      // surface why instead of leaving the Accept button looking dead.
      await startLocalStream(call.video)
    } catch {
      setErrorMsg(mediaError(call.video))
      socket.emit('call:decline', { callerId: call.callerId })
      setCall({ type: 'idle', video: false })
      return
    }
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

  if (call.type === 'idle') {
    // Still surface an error (e.g. permission denied) even though the call ended.
    return (
      <AnimatePresence>
        {errorMsg && (
          <motion.div
            key="call-error"
            initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            onClick={() => setErrorMsg(null)}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] bg-red-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-xl max-w-[90vw] text-center cursor-pointer"
          >
            {errorMsg}
          </motion.div>
        )}
      </AnimatePresence>
    )
  }

  const displayName = call.type === 'incoming' ? call.callerName : call.calleeName
  const displayAvatar = call.type === 'incoming' ? call.callerAvatar : call.calleeAvatar

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center"
      >
        {/* Remote media. For video calls it fills the screen; for audio calls the
            same element is kept offscreen but still plays the remote sound (a
            display:none element can be muted by some browsers, so we hide it via
            size/opacity instead). */}
        {call.type === 'connected' && (
          <video ref={remoteVideoRef} autoPlay playsInline
            className={call.video
              ? 'absolute inset-0 w-full h-full object-cover'
              : 'absolute w-px h-px opacity-0 pointer-events-none'} />
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
          <div className="relative">
            {(call.type === 'incoming' || call.type === 'calling') && (
              <motion.span
                className="absolute -inset-3 rounded-full border-2 border-brand-green/60"
                animate={{ scale: [1, 1.25, 1], opacity: [0.8, 0, 0.8] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
              />
            )}
            <Avatar src={displayAvatar} name={displayName ?? 'User'} size="2xl" />
          </div>
          <div>
            <p className="text-brand-lime/80 text-xs font-semibold uppercase tracking-[0.18em] mb-1.5">
              {call.type === 'incoming' ? `Incoming ${call.video ? 'video' : 'voice'} call`
                : call.type === 'calling' ? `Outgoing ${call.video ? 'video' : 'voice'} call`
                : call.video ? 'Video call' : 'Voice call'}
            </p>
            <h2 className="text-2xl font-bold text-white">{displayName}</h2>
            <p className="text-white/60 mt-1 text-sm">
              {call.type === 'incoming' ? 'Ringing…' :
               call.type === 'calling' ? 'Ringing…' :
               rtcConnected ? fmt(duration) : 'Connecting…'}
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
