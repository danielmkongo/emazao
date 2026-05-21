import mongoose, { Schema, Document } from 'mongoose'

export type BidStatus = 'PENDING' | 'SHORTLISTED' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN'

export interface IBid extends Document {
  requirementId: mongoose.Types.ObjectId
  farmerId: mongoose.Types.ObjectId
  pricePerUnit: number
  totalPrice: number
  currency: string
  deliveryTimeline: string
  deliveryNotes?: string
  message: string
  certifications: string[]
  sampleAvailable: boolean
  status: BidStatus
  score?: number
  createdAt: Date
  updatedAt: Date
}

const BidSchema = new Schema<IBid>(
  {
    requirementId: { type: Schema.Types.ObjectId, ref: 'Requirement', required: true },
    farmerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    pricePerUnit: { type: Number, required: true },
    totalPrice: { type: Number, required: true },
    currency: { type: String, default: 'USD' },
    deliveryTimeline: { type: String, required: true },
    deliveryNotes: { type: String },
    message: { type: String, required: true },
    certifications: [{ type: String }],
    sampleAvailable: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['PENDING', 'SHORTLISTED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'],
      default: 'PENDING',
    },
    score: { type: Number },
  },
  { timestamps: true }
)

BidSchema.index({ requirementId: 1, farmerId: 1 }, { unique: true })
BidSchema.index({ requirementId: 1, status: 1 })
BidSchema.index({ farmerId: 1 })

export default mongoose.model<IBid>('Bid', BidSchema)
