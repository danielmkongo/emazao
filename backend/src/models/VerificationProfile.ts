import mongoose, { Schema, Document } from 'mongoose'

/**
 * Seller verification state, kept off the User document because it is sensitive
 * personal data under Tanzania's Personal Data Protection Act 2022 and needs a
 * different access and retention policy from ordinary profile fields.
 *
 * Tiers escalate with cumulative payout value rather than gating everyone at
 * signup — a risk-based approach (what FATF expects) that keeps a farmer selling
 * a few kilos out of a biometric flow they'd abandon.
 */
export type VerificationTier = 0 | 1 | 2 | 3

export type VerificationStatus =
  | 'UNVERIFIED'
  | 'PENDING_REVIEW'
  | 'VERIFIED'
  | 'REJECTED'
  | 'SUSPENDED'

export interface IVerificationDocument {
  kind: 'NATIONAL_ID_FRONT' | 'NATIONAL_ID_BACK' | 'SELFIE' | 'BUSINESS_REGISTRATION'
  /** Cloudinary URL. Stored in a restricted-access folder, never a public one. */
  url: string
  uploadedAt: Date
  /** Result of the optional face-presence check, when a biometric service is configured. */
  faceDetected?: boolean
  faceScore?: number
}

export interface IVerificationAudit {
  action: string
  actorId?: mongoose.Types.ObjectId
  note?: string
  at: Date
}

export interface IVerificationProfile extends Document {
  userId: mongoose.Types.ObjectId
  tier: VerificationTier
  status: VerificationStatus

  /** Name the seller claims, checked against the name on their payout wallet. */
  declaredName?: string

  // --- National ID ---
  // The number itself is never stored. See utils/nida.ts.
  nidaHash?: string
  nidaLast4?: string
  nidaDateOfBirth?: Date

  // --- Payout wallet identity anchor ---
  // Tanzanian SIMs are registered against NIDA by law, so the name a mobile money
  // provider holds for a wallet is already government-anchored. Matching it against
  // the declared name is our strongest free identity signal.
  payoutPhone?: string
  payoutAccountName?: string
  payoutNameMatchScore?: number
  payoutVerifiedAt?: Date

  documents: IVerificationDocument[]

  /** Cumulative value paid out, in the wallet's currency — drives tier requirements. */
  lifetimePayoutValue: number

  reviewedBy?: mongoose.Types.ObjectId
  reviewedAt?: Date
  rejectionReason?: string

  /** Every read/write of this record by staff, for PDPA accountability. */
  auditLog: IVerificationAudit[]

  createdAt: Date
  updatedAt: Date
}

const VerificationProfileSchema = new Schema<IVerificationProfile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    tier: { type: Number, enum: [0, 1, 2, 3], default: 0 },
    status: {
      type: String,
      enum: ['UNVERIFIED', 'PENDING_REVIEW', 'VERIFIED', 'REJECTED', 'SUSPENDED'],
      default: 'UNVERIFIED',
    },

    declaredName: { type: String, trim: true },

    nidaHash: { type: String },
    nidaLast4: { type: String },
    nidaDateOfBirth: { type: Date },

    payoutPhone: { type: String },
    payoutAccountName: { type: String },
    payoutNameMatchScore: { type: Number },
    payoutVerifiedAt: { type: Date },

    documents: [
      {
        kind: {
          type: String,
          enum: ['NATIONAL_ID_FRONT', 'NATIONAL_ID_BACK', 'SELFIE', 'BUSINESS_REGISTRATION'],
        },
        url: { type: String, required: true },
        uploadedAt: { type: Date, default: Date.now },
        faceDetected: { type: Boolean },
        faceScore: { type: Number },
      },
    ],

    lifetimePayoutValue: { type: Number, default: 0 },

    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    rejectionReason: { type: String },

    auditLog: [
      {
        action: { type: String, required: true },
        actorId: { type: Schema.Types.ObjectId, ref: 'User' },
        note: { type: String },
        at: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
)

// Sparse because most profiles have no NIDA yet; non-unique deliberately — the
// same ID appearing on two accounts is a signal to flag and review, not an error
// to throw at whoever happens to register second.
VerificationProfileSchema.index({ nidaHash: 1 }, { sparse: true })
VerificationProfileSchema.index({ payoutPhone: 1 }, { sparse: true })
VerificationProfileSchema.index({ status: 1, tier: 1 })

export default mongoose.model<IVerificationProfile>('VerificationProfile', VerificationProfileSchema)
