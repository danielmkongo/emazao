import mongoose, { Schema, Document } from 'mongoose'

export type EscrowStatus = 'HOLDING' | 'RELEASED' | 'REFUNDED' | 'DISPUTED'

export interface IEscrow extends Document {
  orderId: mongoose.Types.ObjectId
  amount: number
  currency: string
  status: EscrowStatus
  /** Which rail collected this money — rows outlive any one provider. */
  provider?: string
  /** The provider's own id for the collection. */
  providerRef?: string
  /** Set once the seller has actually been paid out, so a retry can't double-pay. */
  payoutRef?: string
  payoutStatus?: 'PENDING' | 'SUCCESS' | 'REVERSED' | 'FAILED'
  /** @deprecated Stripe-era field, kept so pre-migration rows still read back. */
  stripePaymentIntentId?: string
  releasedAt?: Date
  refundedAt?: Date
  refundRef?: string
  refundStatus?: 'PENDING' | 'SENT' | 'FAILED'
  refundError?: string
  releaseReason?: 'BUYER_CONFIRMED' | 'AUTO' | 'ADMIN' | 'DISPUTE'
  createdAt: Date
}

const EscrowSchema = new Schema<IEscrow>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'TZS' },
    status: {
      type: String,
      enum: ['HOLDING', 'RELEASED', 'REFUNDED', 'DISPUTED'],
      default: 'HOLDING',
    },
    provider: { type: String },
    providerRef: { type: String },
    payoutRef: { type: String },
    payoutStatus: { type: String, enum: ['PENDING', 'SUCCESS', 'REVERSED', 'FAILED'] },
    stripePaymentIntentId: { type: String },
    releasedAt: { type: Date },
    refundedAt: { type: Date },
    // A refund is a real payout back to the buyer's wallet, tracked here so a
    // failed one can be seen and retried rather than silently lost.
    refundRef: { type: String },
    refundStatus: { type: String, enum: ['PENDING', 'SENT', 'FAILED'] },
    refundError: { type: String },
    releaseReason: { type: String, enum: ['BUYER_CONFIRMED', 'AUTO', 'ADMIN', 'DISPUTE'] },
  },
  { timestamps: true }
)

export default mongoose.model<IEscrow>('Escrow', EscrowSchema)
