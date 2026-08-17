import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import RiskFlag, { type RiskFlagStatus } from '../models/RiskFlag'
import VerificationProfile from '../models/VerificationProfile'
import { signedKycUrl } from '../config/cloudinary'
import { sendNotification } from '../services/notification.service'

/** GET /api/admin/compliance/flags — the AML review queue, worst first. */
export const listFlags = async (req: AuthRequest, res: Response) => {
  try {
    const requested = String(req.query['status'] ?? 'OPEN')
    const status: RiskFlagStatus = (['OPEN', 'CLEARED', 'CONFIRMED'] as const).includes(requested as RiskFlagStatus)
      ? (requested as RiskFlagStatus)
      : 'OPEN'
    const page = Math.max(1, Number(req.query['page'] ?? 1))
    const limit = Math.min(50, Number(req.query['limit'] ?? 20))

    const [flags, total] = await Promise.all([
      RiskFlag.find({ status })
        .populate('userId', 'name username email phone')
        .populate('relatedUserId', 'name username')
        .populate('orderId', 'orderNumber total currency status')
        .sort({ severity: 1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      RiskFlag.countDocuments({ status }),
    ])

    res.json({ success: true, data: flags, meta: { page, limit, total } })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

/**
 * PUT /api/admin/compliance/flags/:id — clear or confirm a flag.
 * Clearing lifts the payout block; confirming suspends the account so funds stay
 * frozen while the case is escalated.
 */
export const reviewFlag = async (req: AuthRequest, res: Response) => {
  try {
    const { decision, note } = req.body as { decision: 'CLEARED' | 'CONFIRMED'; note?: string }
    if (!['CLEARED', 'CONFIRMED'].includes(decision)) {
      return res.status(400).json({ success: false, message: 'Decision must be CLEARED or CONFIRMED' })
    }

    const flag = await RiskFlag.findOneAndUpdate(
      { _id: req.params['id'], status: 'OPEN' },
      { status: decision, reviewedBy: req.user!.id, reviewedAt: new Date(), reviewNote: note },
      { new: true },
    )
    if (!flag) return res.status(409).json({ success: false, message: 'Flag not found or already reviewed' })

    if (decision === 'CONFIRMED') {
      // upsert: a flagged user who has never touched the verification system
      // (never called /verification/me, never withdrawn) has no
      // VerificationProfile document yet. Without upsert this update silently
      // matches nothing and the account walks away unsuspended — the exact
      // account confirming a self-dealing/laundering flag most needs to stop.
      await VerificationProfile.findOneAndUpdate(
        { userId: flag.userId },
        {
          $set: { status: 'SUSPENDED' },
          $setOnInsert: { userId: flag.userId, tier: 0 },
          $push: {
            auditLog: { action: 'SUSPENDED_BY_COMPLIANCE', actorId: req.user!.id, note: flag.type, at: new Date() },
          },
        },
        { upsert: true },
      )
    } else {
      await sendNotification({
        userId: flag.userId.toString(),
        type: 'SYSTEM',
        title: 'Account review complete',
        body: 'Your account has been reviewed and withdrawals are available again.',
        link: '/wallet',
      }).catch(() => {})
    }

    res.json({ success: true, data: flag })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

/** GET /api/admin/compliance/verifications — sellers awaiting manual review. */
export const listPendingVerifications = async (_req: AuthRequest, res: Response) => {
  try {
    const profiles = await VerificationProfile.find({ status: 'PENDING_REVIEW' })
      .populate('userId', 'name username email phone role')
      .sort({ updatedAt: 1 })
      .limit(50)
      .lean()

    res.json({ success: true, data: profiles.map(p => ({ ...p, nidaHash: undefined })) })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

/**
 * GET /api/admin/compliance/verifications/:userId/documents
 * Mints short-lived signed links. Every access is written to the profile's audit
 * log — under the Personal Data Protection Act we must be able to say who looked
 * at someone's ID and when.
 */
export const getVerificationDocuments = async (req: AuthRequest, res: Response) => {
  try {
    const profile = await VerificationProfile.findOne({ userId: req.params['userId'] })
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' })

    profile.auditLog.push({
      action: 'DOCUMENTS_VIEWED',
      actorId: req.user!.id as any,
      note: `${profile.documents.length} document(s)`,
      at: new Date(),
    })
    await profile.save()

    res.json({
      success: true,
      data: profile.documents.map(d => ({
        kind: d.kind,
        url: signedKycUrl(d.url),
        uploadedAt: d.uploadedAt,
        faceDetected: d.faceDetected,
        faceScore: d.faceScore,
      })),
    })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

/** PUT /api/admin/compliance/verifications/:userId — approve to a tier, or reject. */
export const decideVerification = async (req: AuthRequest, res: Response) => {
  try {
    const { decision, tier, reason } = req.body as {
      decision: 'APPROVE' | 'REJECT'
      tier?: number
      reason?: string
    }

    const profile = await VerificationProfile.findOne({ userId: req.params['userId'] })
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' })

    if (decision === 'APPROVE') {
      const granted = [1, 2, 3].includes(Number(tier)) ? Number(tier) : 2
      profile.tier = granted as any
      profile.status = 'VERIFIED'
      profile.rejectionReason = undefined
      profile.auditLog.push({ action: 'APPROVED', actorId: req.user!.id as any, note: `tier ${granted}`, at: new Date() })
    } else {
      if (!reason?.trim()) {
        return res.status(400).json({ success: false, message: 'A rejection reason is required — the seller is told what to fix' })
      }
      profile.status = 'REJECTED'
      profile.rejectionReason = reason.trim()
      profile.auditLog.push({ action: 'REJECTED', actorId: req.user!.id as any, note: reason, at: new Date() })
    }

    profile.reviewedBy = req.user!.id as any
    profile.reviewedAt = new Date()
    await profile.save()

    await sendNotification({
      userId: String(req.params['userId']),
      type: 'SYSTEM',
      title: decision === 'APPROVE' ? 'Verification approved' : 'Verification needs attention',
      body: decision === 'APPROVE'
        ? `You're verified. Your withdrawal limit has been raised.`
        : `We couldn't verify your account: ${reason}`,
      link: '/wallet/verification',
    }).catch(() => {})

    res.json({ success: true, data: { tier: profile.tier, status: profile.status } })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}
