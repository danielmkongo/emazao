import { env } from '../../config/env'
import type { LivenessAction } from '../../models/LivenessChallenge'

/**
 * Adapter for the external CPU vision service (OpenCV / MediaPipe, no GPU needed).
 *
 * Kept behind an interface for the same reason as the payment provider: the
 * self-hosted implementation is a starting point, and swapping in a commercial
 * verifier later should be a config change, not a refactor.
 *
 * Suggested service endpoints — implement these in the Python API:
 *
 *   POST /liveness/verify
 *     { frames: string[] (base64 JPEG), actions: ["BLINK","LOOK_LEFT",...] }
 *     → { passed: bool, score: 0..1, actionsDetected: [...], reason?: string }
 *     Landmark the frames (MediaPipe Face Mesh / dlib 68), then check each
 *     requested action occurred *in the requested order*: blink via eye aspect
 *     ratio dropping below ~0.2 and recovering; head turn via yaw from the
 *     landmark geometry; mouth open via lip separation ratio.
 *
 *   POST /face/compare
 *     { selfie: base64, reference: string (https URL, fetch it) }
 *     → { match: bool, score: 0..1 }
 *     Compares the face on the ID document against the stored liveness selfie.
 *     `reference` is a short-lived signed URL — download it, don't cache it.
 *
 *   POST /face/detect
 *     { image: base64 }
 *     → { faceCount: int, score: 0..1 }
 *     Haar cascade is fine here — this only asks "is there one clear face".
 */

export interface LivenessResult {
  passed: boolean
  score: number
  actionsDetected: string[]
  reason?: string
}

export interface FaceCompareResult {
  match: boolean
  score: number
}

export interface FaceDetectResult {
  faceCount: number
  score: number
}

export interface BiometricProvider {
  readonly available: boolean
  verifyLiveness(frames: string[], actions: LivenessAction[]): Promise<LivenessResult>
  compareFaces(selfie: string, reference: string): Promise<FaceCompareResult>
  detectFace(image: string): Promise<FaceDetectResult>
}

async function post<T>(path: string, body: unknown, timeoutMs = 20000): Promise<T> {
  // Vision work on CPU is slow enough that an unbounded wait would pin a request
  // thread indefinitely if the service stalls.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${env.BIOMETRIC_SERVICE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(env.BIOMETRIC_SERVICE_KEY ? { 'x-api-key': env.BIOMETRIC_SERVICE_KEY } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`biometric service ${path} returned ${res.status}`)
    return (await res.json()) as T
  } finally {
    clearTimeout(timer)
  }
}

class HttpBiometricProvider implements BiometricProvider {
  readonly available = true

  async verifyLiveness(frames: string[], actions: LivenessAction[]): Promise<LivenessResult> {
    return post<LivenessResult>('/liveness/verify', { frames, actions })
  }

  async compareFaces(selfie: string, reference: string): Promise<FaceCompareResult> {
    return post<FaceCompareResult>('/face/compare', { selfie, reference })
  }

  async detectFace(image: string): Promise<FaceDetectResult> {
    return post<FaceDetectResult>('/face/detect', { image })
  }
}

/**
 * Used when no vision service is configured. Everything reports "not checked"
 * rather than "passed" — a missing service must never look like a pass, or
 * turning it off silently disables the control.
 */
class UnavailableBiometricProvider implements BiometricProvider {
  readonly available = false
  private fail(): never {
    throw new Error('No biometric service configured (set BIOMETRIC_SERVICE_URL)')
  }
  async verifyLiveness(): Promise<LivenessResult> { this.fail() }
  async compareFaces(): Promise<FaceCompareResult> { this.fail() }
  async detectFace(): Promise<FaceDetectResult> { this.fail() }
}

export const biometric: BiometricProvider = env.BIOMETRIC_SERVICE_URL
  ? new HttpBiometricProvider()
  : new UnavailableBiometricProvider()
