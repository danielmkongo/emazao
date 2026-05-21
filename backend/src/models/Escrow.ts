import mongoose, { Schema, Document } from 'mongoose'

export type EscrowStatus = 'HOLDING' | 'RELEASED' | 'REFUNDED' | 'DISPUTED'

export interface IEscrow extends Document {
  orderId: mongoose.Types.ObjectId
  amount: number
  currency: string
  status: EscrowStatus
  stripePaymentIntentId?: string
  releasedAt?: Date
  refundedAt?: Date
  createdAt: Date
}

const EscrowSchema = new Schema<IEscrow>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'USD' },
    status: {
      type: String,
      enum: ['HOLDING', 'RELEASED', 'REFUNDED', 'DISPUTED'],
      default: 'HOLDING',
    },
    stripePaymentIntentId: { type: String },
    releasedAt: { type: Date },
    refundedAt: { type: Date },
  },
  { timestamps: true }
)

export default mongoose.model<IEscrow>('Escrow', EscrowSchema)
