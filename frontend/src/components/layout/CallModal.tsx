import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, FlipHorizontal, LayoutGrid, PictureInPicture } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { getSocket } from '@/lib/socket'
import { ICE_SERVERS } from '@/lib/webrtc'
import { useAuthStore } from '@/store/authStore'
import { playRingtone } from '@/lib/sound'

interface CallState {
  type: 'idle' | 'calling' | 'incoming' | 'connected'
  video: boolean
  // Set once when a call starts and never overwritten by later `type` transitions —
  // `type` alone can't tell us which side we're on once a call reaches 'connected',
  // which previously made the callee's screen show blank/wrong identity info.
  direction?: 'incoming' | 'outgoing'
  callerId?: string
  callerName?: string
  callerAvatar?: string
  calleeId?: string
  calleeName?: string
  calleeAvatar?: string
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
  // 'pip'   — remote fills the screen, own camera in a small corner tile (default).
  // 'split' — both cameras at equal size, so you can watch yourself and the other
  //           person at once (framing a product on camera, showing a document).
  const [layout, setLayout] = useState<'pip' | 'split'>('pip')
  const [duration, setDuration] = useState(0)
  const [rtcConnected, setRtcConnected] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  // State-tracked remote stream so the re-attach effect reruns when ontrack fires,
  // even if it races against React committing the <video> element to the DOM.
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const remoteStreamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const disconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Always-current snapshot of the call, so socket handlers (registered once) never
  // read stale state. This is the core of the overhaul — listeners no longer churn.
  const callRef = useRef(call)
  callRef.current = call

  const cleanup = useCallback(() => {
    localStreamRef.current?.getTracks().forEach(t => t.stop())
    localStreamRef.current = null
    remoteStreamRef.current = null
    // Explicitly detach media from the <video> elements, not just stop() the
    // tracks — some mobile browsers keep the camera-in-use indicator lit until
    // the element's srcObject is actually cleared, not only when the track stops.
    if (localVideoRef.current) localVideoRef.current.srcObject = null
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
    peerConnection?.close()
    peerConnection = null
    pendingCandidates = []
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    if (disconnectTimerRef.current) { clearTimeout(disconnectTimerRef.current); disconnectTimerRef.current = null }
    setMicMuted(false)
    setCamOff(false)
    setRtcConnected(false)
    setDuration(0)
    setRemoteStream(null)
  }, [])

  const hangUp = useCallback((notify = true) => {
    const c = callRef.current
    const otherId = c.callerId ?? c.calleeId
    if (notify && otherId && user) {
      getSocket().emit('call:end', { to: otherId })
    }
    cleanup()
    setCall({ type: 'idle', video: false })
  }, [user, cleanup, setCall])

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
    // NOTE: pendingCandidates is intentionally NOT reset here. On the callee path,
    // 'call:offer' awaits startLocalStream() (a mic/camera permission prompt) before
    // calling createPeer() — ICE candidates arriving during that await are correctly
    // buffered by the 'call:ice-candidate' handler below. Resetting the buffer here
    // wiped exactly those candidates the instant createPeer() ran, before they were
    // ever flushed — a top cause of "rings but never connects". cleanup() already
    // resets the buffer on every real call-end path, so no reset is needed here.
    stream.getTracks().forEach(t => pc.addTrack(t, stream))
    pc.onicecandidate = e => e.candidate && onIce(e.candidate)
    pc.onconnectionstatechange = () => {
      // The call timer starts here — when media is actually flowing — so both sides
      // count the same talk time, not "time since the accept button".
      if (pc.connectionState === 'connected') {
        setRtcConnected(true)
        if (disconnectTimerRef.current) { clearTimeout(disconnectTimerRef.current); disconnectTimerRef.current = null }
      }
      if (pc.connectionState === 'disconnected') {
        // Browsers often sit in 'disconnected' for a while (and can recover via ICE
        // restart) before ever reaching 'failed' — give it a grace period instead of
        // leaving a zombie "connected" call with the timer still running forever.
        if (!disconnectTimerRef.current) {
          disconnectTimerRef.current = setTimeout(() => {
            setErrorMsg('Call connection lost.')
            hangUp(true)
          }, 8000)
        }
      }
      if (pc.connectionState === 'failed') {
        setErrorMsg('Call connection failed — check your network and try again.')
        hangUp(true)
      }
    }
    pc.ontrack = e => {
      remoteStreamRef.current = e.streams[0]
      // Trigger state update so the re-attach effect reruns after React commits the
      // remote <video> element — without this, ontrack can race the DOM mount and
      // the caller ends up seeing only themselves (black remote view).
      setRemoteStream(e.streams[0])
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
    const socket = getSocket()

    socket.on('call:incoming', (data: { callerId: string; callerName: string; callerAvatar?: string; video: boolean }) => {
      // Ignore if we're already in an outgoing or active call — prevents a
      // simultaneous cross-call from overwriting our state and showing "Incoming"
      // on the caller's own screen. Tell the caller we're busy instead of just
      // leaving them ringing for the full timeout with no explanation.
      if (callRef.current.type !== 'idle') {
        socket.emit('call:busy', { callerId: data.callerId })
        return
      }
      setCall({ type: 'incoming', direction: 'incoming', video: data.video, callerId: data.callerId, callerName: data.callerName, callerAvatar: data.callerAvatar })
    })

    socket.on('call:accepted', async ({ calleeId }: { calleeId: string }) => {
      const wantVideo = callRef.current.video
      try {
        const stream = await startLocalStream(wantVideo)
        const pc = createPeer(stream, (c) => socket.emit('call:ice-candidate', { to: calleeId, candidate: c }))
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        socket.emit('call:offer', { to: calleeId, sdp: offer })
        setCall(prev => ({ ...prev, type: 'connected' }))
      } catch {
        setErrorMsg(mediaError(wantVideo))
        hangUp(true)
      }
    })

    socket.on('call:declined', () => {
      cleanup()
      setCall({ type: 'idle', video: false })
    })

    socket.on('call:busy', () => {
      setErrorMsg('This person is on another call.')
      hangUp(false)
    })

    socket.on('call:peer-disconnected', () => {
      setErrorMsg('The other person lost connection.')
      hangUp(false)
    })

    socket.on('call:offer', async ({ from, sdp }: { from: string; sdp: RTCSessionDescriptionInit }) => {
      const wantVideo = callRef.current.video
      try {
        const stream = localStreamRef.current ?? await startLocalStream(wantVideo)
        const pc = createPeer(stream, (c) => socket.emit('call:ice-candidate', { to: from, candidate: c }))
        await pc.setRemoteDescription(new RTCSessionDescription(sdp))
        await flushPendingCandidates()
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        socket.emit('call:answer', { to: from, sdp: answer })
        setCall(prev => ({ ...prev, type: 'connected' }))
      } catch {
        setErrorMsg(mediaError(wantVideo))
        hangUp(true)
      }
    })

    socket.on('call:answer', async ({ sdp }: { sdp: RTCSessionDescriptionInit }) => {
      try {
        await peerConnection?.setRemoteDescription(new RTCSessionDescription(sdp))
        await flushPendingCandidates()
      } catch {
        setErrorMsg('Call connection failed — check your network and try again.')
        hangUp(true)
      }
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
      socket.off('call:busy')
      socket.off('call:peer-disconnected')
      socket.off('call:offer')
      socket.off('call:answer')
      socket.off('call:ice-candidate')
      socket.off('call:ended')
    }
    // Registered once per user — handlers read live state via callRef, so we never
    // tear down/re-add listeners mid-call (which was dropping signalling events).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id])

  // Re-attach the remote stream whenever the stream or the call type changes.
  // Using state (remoteStream) rather than a ref ensures this effect reruns even
  // when ontrack races ahead of React committing the remote <video> element.
  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream
      remoteVideoRef.current.play?.().catch(() => {})
    }
  }, [remoteStream, call.type])

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

  // Audible ringtone while an incoming call is pending — previously this modal
  // was purely visual, so a call arriving while the recipient was on another
  // page/screen (i.e. not staring at the phone) produced no indication at all.
  useEffect(() => {
    if (call.type !== 'incoming') return
    const stop = playRingtone()
    return stop
  }, [call.type])

  // Stop ringing after 35s if the other side never answers (or is offline).
  useEffect(() => {
    if (call.type !== 'calling') return
    const t = setTimeout(() => { setErrorMsg('No answer.'); hangUp(true) }, 35_000)
    return () => clearTimeout(t)
  }, [call.type, hangUp])

  // Mirror the above on the receiving side — previously only the caller ever gave
  // up, so an unanswered incoming call could sit ringing indefinitely.
  useEffect(() => {
    if (call.type !== 'incoming') return
    const t = setTimeout(() => {
      if (user && call.callerId) getSocket().emit('call:decline', { callerId: call.callerId })
      setCall({ type: 'idle', video: false })
    }, 35_000)
    return () => clearTimeout(t)
  }, [call.type, call.callerId, user, setCall])

  // Talk-time ticks only while media is actually connected — identical on both ends.
  useEffect(() => {
    if (!rtcConnected) return
    if (!timerRef.current) timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null } }
  }, [rtcConnected])

  const acceptCall = async () => {
    if (!user || !call.callerId) return
    const socket = getSocket()
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
    socket.emit('call:accept', { callerId: call.callerId })
    setCall(prev => ({ ...prev, type: 'connected' }))
  }

  const declineCall = () => {
    if (!user || !call.callerId) return
    const socket = getSocket()
    socket.emit('call:decline', { callerId: call.callerId })
    setCall({ type: 'idle', video: false })
  }

  // Basic modal accessibility: move focus into the dialog when it opens (it
  // previously stayed wherever it was on the page behind the call UI), and
  // let Escape decline/hang up — there was no keyboard way to dismiss this
  // modal at all before.
  useEffect(() => {
    if (call.type === 'idle') return
    modalRef.current?.focus()
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (call.type === 'incoming') declineCall()
      else hangUp(true)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call.type])

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

  // Branch on `direction` (fixed for the lifetime of the call), not `type` — once
  // connected, `type` is 'connected' on both ends, which previously made the
  // receiving side fall through to `calleeName`/`calleeAvatar`, fields that are
  // never populated for an incoming call, showing a blank/wrong identity.
  const displayName = call.direction === 'incoming' ? call.callerName : call.calleeName
  const displayAvatar = call.direction === 'incoming' ? call.callerAvatar : call.calleeAvatar

  // Only meaningful once there are two live video feeds to place.
  const isSplit = layout === 'split' && call.video && call.type === 'connected'

  return (
    <AnimatePresence>
      <motion.div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={call.type === 'incoming' ? 'Incoming call' : 'Call'}
        tabIndex={-1}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center outline-none"
      >
        {/* Remote media. For video calls it fills the screen; for audio calls the
            same element is kept offscreen but still plays the remote sound (a
            display:none element can be muted by some browsers, so we hide it via
            size/opacity instead). */}
        {call.type === 'connected' && (
          <video ref={remoteVideoRef} autoPlay playsInline
            className={!call.video
              ? 'absolute w-px h-px opacity-0 pointer-events-none'
              : isSplit
                // Stacked on a portrait phone, side by side once there is width
                // for it — halving a portrait screen vertically keeps both faces
                // upright, whereas two narrow columns crops them.
                ? 'absolute inset-x-0 top-0 h-1/2 w-full object-cover md:inset-y-0 md:left-0 md:w-1/2 md:h-full'
                : 'absolute inset-0 w-full h-full object-cover'} />
        )}

        {/* Local video (pip) */}
        {call.video && (
          <video ref={localVideoRef} autoPlay playsInline muted
            className={isSplit
              ? 'absolute inset-x-0 bottom-0 h-1/2 w-full object-cover border-t-2 border-white/10 md:inset-y-0 md:left-auto md:right-0 md:w-1/2 md:h-full md:border-t-0 md:border-l-2'
              : 'absolute bottom-28 right-4 w-28 h-40 rounded-xl object-cover border-2 border-white/20 z-10 cursor-pointer'}
            style={{ transform: mirrored ? 'scaleX(-1)' : 'none' }}
            onClick={() => setMirrored(m => !m)}
            title="Tap to mirror"
          />
        )}

        {/* Overlay UI */}
        <div className={isSplit
          ? 'absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-2 text-center px-6 pb-6 pt-10 bg-gradient-to-t from-black/80 to-transparent'
          : 'relative z-10 flex flex-col items-center gap-6 text-center px-6'}>
          <div className={isSplit ? 'hidden' : 'relative'}>
            {(call.type === 'incoming' || call.type === 'calling') && (
              <motion.span
                className="absolute -inset-3 rounded-full border-2 border-brand-green/60"
                animate={{ scale: [1, 1.25, 1], opacity: [0.8, 0, 0.8] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
              />
            )}
            <Avatar src={displayAvatar} name={displayName ?? 'User'} size="2xl" />
          </div>
          <div className={isSplit ? 'hidden' : undefined}>
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

              {/* Both cameras at once. Only offered once connected — before that
                  there is no remote feed to place beside your own. */}
              {call.video && call.type === 'connected' && (
                <div className="flex flex-col items-center gap-2">
                  <button onClick={() => setLayout(l => (l === 'split' ? 'pip' : 'split'))}
                    aria-pressed={isSplit}
                    className={`w-14 h-14 rounded-full flex items-center justify-center text-white ${isSplit ? 'bg-white/20' : 'bg-white/10'}`}>
                    {isSplit ? <PictureInPicture className="h-6 w-6" /> : <LayoutGrid className="h-6 w-6" />}
                  </button>
                  <span className="text-white/40 text-xs">{isSplit ? 'Inset' : 'Both'}</span>
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
