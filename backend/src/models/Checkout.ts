import mongoose, { Schema, Document } from 'mongoose'

/**
 * One payment covering several sellers' orders.
 *
 * The orders stay separate — each seller has their own escrow, dispatch,
 * tracking, dispute and review — but the buyer pays for all of them in a single
 * mobile-money approval. This record ties the orders to that one payment, so the
 * webhook knows which orders a confirmed collection belongs to.
 */
export interface ICheckout extends Document {
  buyerId: mongoose.Types.ObjectId
  orderIds: mongoose.Types.ObjectId[]
  total: number
  currency: string
  status: 'PENDING' | 'PAID' | 'CANCELLED'
  providerRef?: string
  paidAt?: Date
  createdAt: Date
}

const CheckoutSchema = new Schema<ICheckout>(
  {
    buyerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    orderIds: [{ type: Schema.Types.ObjectId, ref: 'Order', required: true }],
    total: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'TZS' },
    status: { type: String, enum: ['PENDING', 'PAID', 'CANCELLED'], default: 'PENDING' },
    providerRef: { type: String },
    paidAt: { type: Date },
  },
  { timestamps: true }
)

export default mongoose.model<ICheckout>('Checkout', CheckoutSchema)
