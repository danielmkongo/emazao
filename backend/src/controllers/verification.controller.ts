import crypto from 'crypto'
import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import VerificationProfile from '../models/VerificationProfile'
import LivenessChallenge, { LIVENESS_ACTIONS, type LivenessAction } from '../models/LivenessChallenge'
import RiskFlag from '../models/RiskFlag'
import User from '../models/User'
import { env } from '../config/env'
import { parseNida, hashNida, nidaLast4, nameMatchScore } from '../utils/nida'
import { biometric } from '../services/verification/biometric'
import { TIER_POLICIES, policyFor, checkPayoutEligibility } from '../services/verification/tiers'
import { uploadKycDocument, signedKycUrl } from '../config/cloudinary'

const CHALLENGE_TTL_MS = 2 * 60 * 1000
const CHALLENGE_ACTION_COUNT = 3
const LIVENESS_PASS_SCORE = 0.7
const FACE_MATCH_PASS_SCORE = 0.65

async function profileFor(userId: string) {
  return VerificationProfile.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId, tier: 0, status: 'UNVERIFIED' } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )
}

function audit(profile: any, action: string, note?: string, actorId?: string) {
  profile.auditLog.push({ action, note, actorId, at: new Date() })
}

/** GET /api/verification/me — current state plus what's needed to progress. */
export const getMyVerification = async (req: AuthRequest, res: Response) => {
  try {
    const profile = await profileFor(req.user!.id)
    res.json({
      success: true,
      data: {
        tier: profile.tier,
        status: profile.status,
        label: policyFor(profile.tier).label,
        lifetimePayoutValue: profile.lifetimePayoutValue,
        payoutCeiling: policyFor(profile.tier).payoutCeiling,
        nidaLast4: profile.nidaLast4,
        payoutAccountName: profile.payoutAccountName,
        payoutVerifiedAt: profile.payoutVerifiedAt,
        documents: profile.documents.map(d => ({ kind: d.kind, uploadedAt: d.uploadedAt })),
        rejectionReason: profile.rejectionReason,
        tiers: TIER_POLICIES.map(t => ({
          tier: t.tier,
          label: t.label,
          payoutCeiling: t.payoutCeiling === Infinity ? null : t.payoutCeiling,
          requirements: t.requirements,
        })),
        biometricAvailable: biometric.available,
      },
    })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

/** GET /api/verification/payout-eligibility?amount= */
export const getPayoutEligibility = async (req: AuthRequest, res: Response) => {
  try {
    const amount = Number(req.query['amount'] ?? 0)
    res.json({ success: true, data: await checkPayoutEligibility(req.user!.id, amount) })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

/**
 * POST /api/verification/nida — submit the national ID number.
 * Stored only as a keyed hash; a duplicate raises a flag rather than blocking,
 * since the honest explanation (a re-registration) is as likely as the dishonest one.
 */
export const submitNida = async (req: AuthRequest, res: Response) => {
  try {
    const { nidaNumber, declaredName } = req.body
    if (!declaredName?.trim()) {
      return res.status(400).json({ success: false, message: 'Your full name as printed on your ID is required' })
    }

    const parsed = parseNida(nidaNumber)
    if (!parsed.valid) return res.status(400).json({ success: false, message: parsed.reason })

    if (!env.NIDA_HASH_KEY) {
      return res.status(500).json({ success: false, message: 'Identity verification is not configured. Contact support.' })
    }

    const hash = hashNida(parsed.normalised!, env.NIDA_HASH_KEY)
    const profile = await profileFor(req.user!.id)

    const duplicate = await VerificationProfile.findOne({
      nidaHash: hash,
      userId: { $ne: profile.userId },
    }).select('userId').lean()

    profile.nidaHash = hash
    profile.nidaLast4 = nidaLast4(parsed.normalised!)
    profile.nidaDateOfBirth = parsed.dateOfBirth
    profile.declaredName = declaredName.trim()
    audit(profile, 'NIDA_SUBMITTED', `ending ${profile.nidaLast4}`, req.user!.id)
    await profile.save()

    if (duplicate) {
      await RiskFlag.create({
        type: 'DUPLICATE_IDENTITY', severity: 'HIGH', status: 'OPEN',
        userId: profile.userId, relatedUserId: duplicate.userId,
        detail: 'This national ID is already registered to another seller account.',
        blockedPayout: true,
      }).catch(() => {})
    }

    res.json({ success: true, data: { nidaLast4: profile.nidaLast4, duplicateDetected: !!duplicate } })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

/**
 * POST /api/verification/liveness/challenge
 * Issues a random, short-lived action sequence. Randomising server-side is the
 * whole point: an attacker cannot pre-record a video of a sequence they can't predict.
 */
export const createLivenessChallenge = async (req: AuthRequest, res: Response) => {
  try {
    if (!biometric.available) {
      return res.status(503).json({ success: false, message: 'Liveness checks are temporarily unavailable' })
    }

    // Fisher-Yates over a crypto-random source — Math.random() is predictable
    // enough that a determined attacker could pre-compute likely sequences.
    const pool = [...LIVENESS_ACTIONS]
    for (let i = pool.length - 1; i > 0; i--) {
      const j = crypto.randomInt(i + 1)
      ;[pool[i], pool[j]] = [pool[j], pool[i]]
    }
    const actions = pool.slice(0, CHALLENGE_ACTION_COUNT)
    const nonce = crypto.randomBytes(16).toString('hex')

    await LivenessChallenge.create({
      userId: req.user!.id,
      nonce,
      actions,
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
    })

    res.json({ success: true, data: { nonce, actions, expiresInMs: CHALLENGE_TTL_MS } })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

/**
 * POST /api/verification/liveness/verify
 * The client sends captured frames; the *server* decides whether they satisfy
 * the challenge. A client-reported pass is never accepted.
 */
export const verifyLiveness = async (req: AuthRequest, res: Response) => {
  try {
    const { nonce, frames } = req.body as { nonce: string; frames: string[] }
    if (!nonce || !Array.isArray(frames) || !frames.length) {
      return res.status(400).json({ success: false, message: 'A challenge nonce and captured frames are required' })
    }

    // Consume atomically so the same frames can't be replayed against the same
    // challenge, even by two concurrent requests.
    const challenge = await LivenessChallenge.findOneAndUpdate(
      { nonce, userId: req.user!.id, consumed: false, expiresAt: { $gt: new Date() } },
      { consumed: true },
      { new: true },
    )
    if (!challenge) {
      return res.status(400).json({ success: false, message: 'This challenge has expired or was already used. Please start again.' })
    }

    const result = await biometric.verifyLiveness(frames, challenge.actions as LivenessAction[])
    challenge.passed = result.passed && result.score >= LIVENESS_PASS_SCORE
    challenge.score = result.score
    challenge.failureReason = challenge.passed ? undefined : (result.reason ?? 'Actions not detected')
    await challenge.save()

    if (!challenge.passed) {
      return res.status(400).json({
        success: false,
        message: 'We could not confirm the actions. Make sure your face is well lit and centred, then try again.',
      })
    }

    const profile = await profileFor(req.user!.id)
    // Keep the best frame as the reference selfie for the ID face comparison.
    const selfieId = await uploadKycDocument(Buffer.from(frames[frames.length - 1], 'base64'))
    profile.documents = profile.documents.filter(d => d.kind !== 'SELFIE')
    profile.documents.push({
      kind: 'SELFIE', url: selfieId, uploadedAt: new Date(),
      faceDetected: true, faceScore: result.score,
    })
    audit(profile, 'LIVENESS_PASSED', `score ${result.score.toFixed(2)}`, req.user!.id)
    await profile.save()

    res.json({ success: true, data: { score: result.score } })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

/**
 * POST /api/verification/document — upload an ID or business document.
 * When a selfie exists and this is an ID front, we also compare the faces.
 */
export const uploadDocument = async (req: AuthRequest, res: Response) => {
  try {
    const { kind } = req.body as { kind: string }
    const allowed = ['NATIONAL_ID_FRONT', 'NATIONAL_ID_BACK', 'BUSINESS_REGISTRATION']
    if (!allowed.includes(kind)) {
      return res.status(400).json({ success: false, message: 'Invalid document type' })
    }
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' })

    const profile = await profileFor(req.user!.id)
    const publicId = await uploadKycDocument(req.file.buffer, req.file.mimetype)

    let faceDetected: boolean | undefined
    let faceScore: number | undefined

    if (kind === 'NATIONAL_ID_FRONT' && biometric.available) {
      const selfie = profile.documents.find(d => d.kind === 'SELFIE')
      try {
        const detect = await biometric.detectFace(req.file.buffer.toString('base64'))
        faceDetected = detect.faceCount > 0
        faceScore = detect.score
        if (selfie && faceDetected) {
          // The stored selfie is an authenticated Cloudinary asset, so hand the
          // vision service a short-lived signed URL to fetch rather than trying
          // to inline an image we'd have to download and re-encode first.
          const compare = await biometric.compareFaces(
            req.file.buffer.toString('base64'),
            signedKycUrl(selfie.url),
          )
          if (!compare.match || compare.score < FACE_MATCH_PASS_SCORE) {
            audit(profile, 'FACE_MISMATCH', `score ${compare.score.toFixed(2)}`, req.user!.id)
          } else {
            audit(profile, 'FACE_MATCHED', `score ${compare.score.toFixed(2)}`, req.user!.id)
          }
        }
      } catch {
        // Vision service down — record the document and let a human review it
        // rather than blocking an honest seller on our own outage.
        audit(profile, 'FACE_CHECK_SKIPPED', 'biometric service unavailable', req.user!.id)
      }
    }

    profile.documents = profile.documents.filter(d => d.kind !== kind)
    profile.documents.push({ kind: kind as any, url: publicId, uploadedAt: new Date(), faceDetected, faceScore })
    audit(profile, 'DOCUMENT_UPLOADED', kind, req.user!.id)
    await profile.save()

    res.json({ success: true, data: { kind, faceDetected } })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

/**
 * POST /api/verification/submit — send for review once requirements are met.
 * Tier 1 is granted automatically (phone + wallet-name match are objective
 * machine checks); tiers 2 and 3 go to a human.
 */
export const submitForReview = async (req: AuthRequest, res: Response) => {
  try {
    const profile = await profileFor(req.user!.id)
    const user = await User.findById(req.user!.id).select('isVerified name')

    if (!user?.isVerified) {
      return res.status(400).json({ success: false, message: 'Confirm your phone number or email first' })
    }
    if (!profile.nidaHash) {
      return res.status(400).json({ success: false, message: 'Submit your National ID number first' })
    }

    const hasId = profile.documents.some(d => d.kind === 'NATIONAL_ID_FRONT')
    const hasSelfie = profile.documents.some(d => d.kind === 'SELFIE')
    if (!hasId || !hasSelfie) {
      return res.status(400).json({
        success: false,
        message: 'Upload a photo of your National ID and complete the liveness check',
      })
    }

    profile.status = 'PENDING_REVIEW'
    audit(profile, 'SUBMITTED_FOR_REVIEW', undefined, req.user!.id)
    await profile.save()

    res.json({ success: true, message: 'Submitted. We usually review within one business day.' })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

/**
 * Records the identity anchor from a completed payout: mobile money wallets in
 * Tanzania are registered against NIDA by law, so the account name a provider
 * returns is already government-anchored. Called from the withdrawal flow.
 */
export async function recordPayoutIdentity(
  userId: string,
  phone: string,
  accountName: string | undefined,
  amount: number,
): Promise<void> {
  const profile = await profileFor(userId)
  profile.lifetimePayoutValue += amount
  profile.payoutPhone = phone

  if (accountName) {
    const declared = profile.declaredName || ''
    const score = declared ? nameMatchScore(declared, accountName) : 0
    profile.payoutAccountName = accountName
    profile.payoutNameMatchScore = score
    profile.payoutVerifiedAt = new Date()

    // Auto-promote to tier 1: phone-verified and the wallet's registered name
    // matches the declared name. Both are objective, so no human is needed.
    if (profile.tier === 0 && score >= 0.5) {
      profile.tier = 1
      audit(profile, 'TIER_1_GRANTED', `wallet name match ${score.toFixed(2)}`)
    }

    if (declared && score < 0.5) {
      await RiskFlag.create({
        type: 'PAYOUT_NAME_MISMATCH', severity: 'MEDIUM', status: 'OPEN',
        userId: profile.userId,
        detail: `Withdrawal wallet is registered to "${accountName}" but the account declares "${declared}".`,
        evidence: { accountName, declaredName: declared, score },
      }).catch(() => {})
    }
  }

  await profile.save()
}
