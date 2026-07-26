// Synthesized notification sounds via the Web Audio API — no audio asset files
// to host/license, and it works instantly regardless of network conditions.
let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
  if (!AudioCtx) return null
  if (!ctx) ctx = new AudioCtx()
  // Browsers suspend AudioContext until a user gesture — resume opportunistically.
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function tone(freq: number, startAt: number, duration: number, volume = 0.15) {
  const audio = getCtx()
  if (!audio) return
  const osc = audio.createOscillator()
  const gain = audio.createGain()
  osc.frequency.value = freq
  osc.type = 'sine'
  gain.gain.setValueAtTime(volume, audio.currentTime + startAt)
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + startAt + duration)
  osc.connect(gain)
  gain.connect(audio.destination)
  osc.start(audio.currentTime + startAt)
  osc.stop(audio.currentTime + startAt + duration)
}

// Short two-note "ding" for a new message/notification.
export function playNotificationSound(): void {
  tone(880, 0, 0.12)
  tone(1175, 0.1, 0.15)
}

// Looping ringtone for incoming calls — returns a stop function.
export function playRingtone(): () => void {
  let stopped = false
  const ring = () => {
    if (stopped) return
    tone(740, 0, 0.35, 0.18)
    tone(880, 0.4, 0.35, 0.18)
  }
  ring()
  const interval = setInterval(ring, 1600)
  return () => {
    stopped = true
    clearInterval(interval)
  }
}
