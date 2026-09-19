import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, SwitchCamera, LayoutGrid, PictureInPicture, Layers } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { getSocket } from '@/lib/socket'
import { ICE_SERVERS } from '@/lib/webrtc'
import { useAuthStore } from '@/store/authStore'
import { playRingtone } from '@/lib/sound'
import { openCamera, startDualCamera, type DualCamera, type Facing } from '@/lib/camera'

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
  const [facing, setFacing] = useState<Facing>('user')
  const [dual, setDual] = useState(false)
  const [cameraBusy, setCameraBusy] = useState(false)
  const [bigView, setBigView] = useState<'remote' | 'local'>('remote')
  const dualRef = useRef<DualCamera | null>(null)
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
    dualRef.current?.stop()
    dualRef.current = null
    setDual(false)
    setFacing('user')
    setBigView('remote')
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
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: video ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } : false })
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
      localVideoRef.current.srcObject = dualRef.current ? new MediaStream([dualRef.current.track]) : localStreamRef.current
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

  // The track actually being sent: the composite while both cameras are on.
  const outgoingVideo = () => dualRef.current?.track ?? localStreamRef.current?.getVideoTracks()[0]
  const sendVideo = (track: MediaStreamTrack) =>
    peerConnection?.getSenders().find(s => s.track?.kind === 'video')?.replaceTrack(track).catch(() => {})
  const showLocal = (stream: MediaStream | null) => {
    if (localVideoRef.current) { localVideoRef.current.srcObject = stream; localVideoRef.current.play?.().catch(() => {}) }
  }

  const toggleCam = () => {
    const next = camOff // turning on if currently off
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = next })
    if (dualRef.current) dualRef.current.track.enabled = next
    setCamOff(c => !c)
  }

  // A real switch between front and back lenses, sent to the other person.
  // ("Flip" used to only mirror your own preview.)
  const flipCamera = async () => {
    if (dualRef.current) { dualRef.current.swap(); return }
    const stream = localStreamRef.current
    if (!stream || cameraBusy) return
    setCameraBusy(true)
    const next: Facing = facing === 'user' ? 'environment' : 'user'
    try {
      const fresh = await openCamera(next)
      const track = fresh.getVideoTracks()[0]
      track.enabled = !camOff
      const old = stream.getVideoTracks()[0]
      await sendVideo(track)
      if (old) { stream.removeTrack(old); old.stop() }
      stream.addTrack(track)
      showLocal(stream)
      setFacing(next)
    } catch {
      setErrorMsg('Could not switch camera on this device.')
    } finally { setCameraBusy(false) }
  }

  // Both cameras at once, as one picture the other person sees: the back
  // camera full frame (the produce), your face in the corner.
  const toggleDual = async () => {
    const stream = localStreamRef.current
    if (!stream || cameraBusy) return
    if (dualRef.current) {
      const cam = stream.getVideoTracks()[0]
      if (cam) await sendVideo(cam)
      dualRef.current.stop(); dualRef.current = null
      showLocal(stream)
      setDual(false)
      return
    }
    setCameraBusy(true)
    try {
      const d = await startDualCamera({ stream, facing })
      d.track.enabled = !camOff
      dualRef.current = d
      await sendVideo(d.track)
      showLocal(new MediaStream([d.track]))
      setDual(true)
    } catch (e: any) {
      setErrorMsg(e?.message ?? 'Both cameras are not available on this device.')
    } finally { setCameraBusy(false) }
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
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[90] bg-red-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-xl max-w-[90vw] text-center cursor-pointer"
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

  const liveVideo = call.video && call.type === 'connected'
  const isSplit = layout === 'split' && liveVideo
  // Which feed fills the screen in the usual layout; tap the small tile to swap.
  const localBig = liveVideo && !isSplit && bigView === 'local'
  const mirrorLocal = facing === 'user' && !dual
  const status = call.type === 'incoming' ? `Incoming ${call.video ? 'video' : 'voice'} call`
    : call.type === 'calling' ? 'Ringing…'
    : rtcConnected ? fmt(duration) : 'Connecting…'

  const big = 'absolute inset-0 w-full h-full object-cover'
  const tile = 'absolute top-[calc(env(safe-area-inset-top,0px)+76px)] right-3 w-[104px] h-[148px] md:w-[150px] md:h-[210px] rounded-2xl object-cover ring-2 ring-white/25 shadow-2xl z-20 cursor-pointer'
  const splitTop = 'absolute inset-x-0 top-0 h-1/2 w-full object-cover md:inset-y-0 md:left-0 md:w-1/2 md:h-full'
  const splitBottom = 'absolute inset-x-0 bottom-0 h-1/2 w-full object-cover md:inset-y-0 md:left-auto md:right-0 md:w-1/2 md:h-full'

  const Control = ({ onClick, active, label, children, danger, disabled }: {
    onClick: () => void; active?: boolean; label: string; children: React.ReactNode; danger?: boolean; disabled?: boolean
  }) => (
    <div className="flex flex-col items-center gap-1.5 min-w-[56px]">
      <motion.button whileTap={{ scale: 0.9 }} onClick={onClick} disabled={disabled} aria-label={label} aria-pressed={active}
        className={`w-[54px] h-[54px] rounded-full flex items-center justify-center transition-colors disabled:opacity-40 ${
          danger ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
          : active ? 'bg-white text-black' : 'bg-white/15 text-white hover:bg-white/25'}`}>
        {children}
      </motion.button>
      <span className="text-white/70 text-[11px] font-medium">{label}</span>
    </div>
  )

  return (
    <AnimatePresence>
      <motion.div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={call.type === 'incoming' ? 'Incoming call' : 'Call'}
        tabIndex={-1}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[85] bg-neutral-950 overflow-hidden outline-none"
      >
        {/* Backdrop for voice calls and while ringing: the person, blurred. */}
        {(!liveVideo) && displayAvatar && (
          <img src={displayAvatar} alt="" className="absolute inset-0 w-full h-full object-cover scale-125 blur-3xl opacity-50" />
        )}
        {!liveVideo && <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/50 to-black/80" />}

        {/* Remote media. For voice calls the element stays mounted but invisible
            so it still plays the other person's audio (display:none can mute it). */}
        {call.type === 'connected' && (
          <video ref={remoteVideoRef} autoPlay playsInline
            className={!call.video ? 'absolute w-px h-px opacity-0 pointer-events-none'
              : isSplit ? splitTop : localBig ? tile : big}
            onClick={localBig ? () => setBigView('remote') : undefined} />
        )}

        {/* Your camera */}
        {call.video && (
          <video ref={localVideoRef} autoPlay playsInline muted
            className={isSplit ? splitBottom : !liveVideo ? `${big} opacity-90` : localBig ? big : tile}
            style={{ transform: mirrorLocal ? 'scaleX(-1)' : 'none' }}
            onClick={liveVideo && !isSplit && !localBig ? () => setBigView('local') : undefined}
            title={liveVideo && !isSplit && !localBig ? 'Tap to make big' : undefined}
          />
        )}

        {/* Top bar: who and how long */}
        {liveVideo && (
          <div className="absolute inset-x-0 top-0 z-30 px-4 pt-[calc(env(safe-area-inset-top,0px)+14px)] pb-10 bg-gradient-to-b from-black/60 to-transparent flex items-center gap-3">
            <Avatar src={displayAvatar} name={displayName ?? 'User'} size="sm" />
            <div className="min-w-0">
              <p className="text-white font-semibold text-[15px] truncate">{displayName}</p>
              <p className="text-white/70 text-[12.5px] tabular">{status}</p>
            </div>
            {dual && <span className="ml-auto text-[11px] font-bold uppercase tracking-wide bg-white/90 text-black px-2 py-1 rounded-full">Both cameras</span>}
          </div>
        )}

        {/* Ringing / voice-call centre */}
        {!liveVideo && (
          <div className="relative z-10 h-full flex flex-col items-center pt-[18vh] text-center px-6">
            <div className="relative mb-6">
              {(call.type === 'incoming' || call.type === 'calling') && (
                <motion.span className="absolute -inset-4 rounded-full border-2 border-white/40"
                  animate={{ scale: [1, 1.3, 1], opacity: [0.7, 0, 0.7] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }} />
              )}
              <Avatar src={displayAvatar} name={displayName ?? 'User'} size="2xl" className="ring-4 ring-white/15" />
            </div>
            <h2 className="text-[28px] font-bold text-white leading-tight" style={{ fontFamily: 'var(--font-display)' }}>{displayName}</h2>
            <p className="text-white/70 mt-1.5 text-[15px] tabular">{status}</p>
          </div>
        )}

        {/* Controls */}
        <div className="absolute inset-x-0 bottom-0 z-30 pb-[calc(env(safe-area-inset-bottom,0px)+26px)] pt-12 bg-gradient-to-t from-black/75 via-black/40 to-transparent">
          {call.type === 'incoming' ? (
            <div className="flex justify-center gap-20">
              <div className="flex flex-col items-center gap-2">
                <motion.button whileTap={{ scale: 0.9 }} onClick={declineCall} aria-label="Decline"
                  className="w-[70px] h-[70px] rounded-full bg-red-500 flex items-center justify-center text-white shadow-xl shadow-red-500/30">
                  <PhoneOff className="h-7 w-7" />
                </motion.button>
                <span className="text-white/80 text-[13px]">Decline</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <motion.button whileTap={{ scale: 0.9 }} onClick={acceptCall} aria-label="Accept"
                  animate={{ y: [0, -5, 0] }} transition={{ duration: 1.2, repeat: Infinity }}
                  className="w-[70px] h-[70px] rounded-full bg-brand-green flex items-center justify-center text-white shadow-xl shadow-brand-green/40">
                  {call.video ? <Video className="h-7 w-7" /> : <Phone className="h-7 w-7" />}
                </motion.button>
                <span className="text-white/80 text-[13px]">Accept</span>
              </div>
            </div>
          ) : (
            <div className="flex justify-center flex-wrap gap-x-3 gap-y-4 px-3 max-w-md mx-auto">
              <Control onClick={toggleMic} active={micMuted} label={micMuted ? 'Unmute' : 'Mute'}>
                {micMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
              </Control>
              {call.video && (
                <Control onClick={toggleCam} active={camOff} label={camOff ? 'Camera on' : 'Camera off'}>
                  {camOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
                </Control>
              )}
              {call.video && (
                <Control onClick={flipCamera} label={dual ? 'Swap' : 'Flip'} disabled={cameraBusy}>
                  <SwitchCamera className="h-6 w-6" />
                </Control>
              )}
              {liveVideo && (
                <Control onClick={toggleDual} active={dual} label="Both cams" disabled={cameraBusy}>
                  <Layers className="h-6 w-6" />
                </Control>
              )}
              {liveVideo && (
                <Control onClick={() => setLayout(l => (l === 'split' ? 'pip' : 'split'))} active={isSplit} label={isSplit ? 'Inset' : 'Side by side'}>
                  {isSplit ? <PictureInPicture className="h-6 w-6" /> : <LayoutGrid className="h-6 w-6" />}
                </Control>
              )}
              <Control onClick={() => hangUp(true)} label="End" danger>
                <PhoneOff className="h-6 w-6" />
              </Control>
            </div>
          )}
        </div>

        <AnimatePresence>
          {errorMsg && (
            <motion.div key="err" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              onClick={() => setErrorMsg(null)}
              className="absolute top-[calc(env(safe-area-inset-top,0px)+80px)] left-1/2 -translate-x-1/2 z-40 bg-black/80 text-white text-sm px-4 py-2.5 rounded-xl max-w-[88vw] text-center">
              {errorMsg}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  )
}
