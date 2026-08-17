import mongoose, { Schema, Document } from 'mongoose'

/**
 * A laundering signal raised by the monitoring rules.
 *
 * Identity checks answer "is this a real person". These answer "is this a real
 * trade" — which is where marketplace laundering actually happens: genuinely
 * verified people running fictitious sales to move dirty money through an
 * account that produces clean agricultural revenue and a full paper trail.
 */
export type RiskFlagType =
  /** Buyer and seller share a device, IP, phone or payout wallet. */
  | 'SELF_DEALING'
  /** Many orders sitting just under a verification or review threshold. */
  | 'STRUCTURING'
  /** Dormant account jumping to high volume without a plausible ramp. */
  | 'VELOCITY_SPIKE'
  /** Withdrawal wallet registered to a different name than the verified identity. */
  | 'PAYOUT_NAME_MISMATCH'
  /** Same national ID behind more than one seller account. */
  | 'DUPLICATE_IDENTITY'
  /** Trade loop: value returning to its origin through intermediaries. */
  | 'CIRCULAR_TRADING'
  /** Order value wildly out of line with the listing's normal price. */
  | 'PRICE_ANOMALY'

export type RiskSeverity = 'LOW' | 'MEDIUM' | 'HIGH'

export type RiskFlagStatus = 'OPEN' | 'CLEARED' | 'CONFIRMED'

export interface IRiskFlag extends Document {
  type: RiskFlagType
  severity: RiskSeverity
  status: RiskFlagStatus

  /** Who the flag is about. */
  userId: mongoose.Types.ObjectId
  /** The counterparty, where the rule concerns a pair. */
  relatedUserId?: mongoose.Types.ObjectId
  orderId?: mongoose.Types.ObjectId

  /** Human-readable explanation shown in the review queue. */
  detail: string
  /** Rule inputs, kept so a reviewer can see why it fired without rerunning it. */
  evidence?: Record<string, unknown>

  /** True when this flag caused escrow/payout to be withheld. */
  blockedPayout: boolean

  reviewedBy?: mongoose.Types.ObjectId
  reviewedAt?: Date
  reviewNote?: string

  createdAt: Date
}

const RiskFlagSchema = new Schema<IRiskFlag>(
  {
    type: {
      type: String,
      required: true,
      enum: [
        'SELF_DEALING', 'STRUCTURING', 'VELOCITY_SPIKE', 'PAYOUT_NAME_MISMATCH',
        'DUPLICATE_IDENTITY', 'CIRCULAR_TRADING', 'PRICE_ANOMALY',
      ],
    },
    severity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], default: 'MEDIUM' },
    status: { type: String, enum: ['OPEN', 'CLEARED', 'CONFIRMED'], default: 'OPEN' },

    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    relatedUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order' },

    detail: { type: String, required: true },
    evidence: { type: Schema.Types.Mixed },

    blockedPayout: { type: Boolean, default: false },

    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    reviewNote: { type: String },
  },
  { timestamps: true },
)

RiskFlagSchema.index({ status: 1, severity: 1, createdAt: -1 })
RiskFlagSchema.index({ userId: 1, status: 1 })
// One open flag per rule per order — re-running the engine must not pile up
// duplicates of a finding a reviewer is already looking at.
RiskFlagSchema.index(
  { type: 1, userId: 1, orderId: 1 },
  { unique: true, partialFilterExpression: { status: 'OPEN' } },
)

export default mongoose.model<IRiskFlag>('RiskFlag', RiskFlagSchema)
