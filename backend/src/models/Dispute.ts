import mongoose, { Schema, Document } from 'mongoose'

export type DisputeStatus = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED_BUYER' | 'RESOLVED_SELLER' | 'ESCALATED'

export interface IDispute extends Document {
  orderId: mongoose.Types.ObjectId
  raisedById: mongoose.Types.ObjectId
  reason: string
  description: string
  evidence: string[]
  status: DisputeStatus
  resolution?: string
  createdAt: Date
  updatedAt: Date
}

const DisputeSchema = new Schema<IDispute>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    raisedById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, required: true },
    description: { type: String, required: true },
    evidence: [{ type: String }],
    status: {
      type: String,
      enum: ['OPEN', 'UNDER_REVIEW', 'RESOLVED_BUYER', 'RESOLVED_SELLER', 'ESCALATED'],
      default: 'OPEN',
    },
    resolution: { type: String },
  },
  { timestamps: true }
)

export default mongoose.model<IDispute>('Dispute', DisputeSchema)
