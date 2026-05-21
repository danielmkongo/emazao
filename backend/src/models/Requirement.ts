import mongoose, { Schema, Document } from 'mongoose'

export type RequirementStatus = 'OPEN' | 'REVIEWING' | 'AWARDED' | 'FULFILLED' | 'CANCELLED' | 'EXPIRED'

export interface IRequirement extends Document {
  buyerId: mongoose.Types.ObjectId
  title: string
  description: string
  productType: string
  categoryId?: mongoose.Types.ObjectId
  quantityAmount: number
  quantityUnit: string
  deliveryLocation: string
  deliveryFrequency?: string
  budgetMin?: number
  budgetMax?: number
  budgetCurrency: string
  preferredQuality?: string
  deadline?: Date
  images: string[]
  videoUrl?: string
  status: RequirementStatus
  bidCount: number
  viewCount: number
  isUrgent: boolean
  expiresAt?: Date
  createdAt: Date
  updatedAt: Date
}

const RequirementSchema = new Schema<IRequirement>(
  {
    buyerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    productType: { type: String, required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category' },
    quantityAmount: { type: Number, required: true },
    quantityUnit: { type: String, required: true },
    deliveryLocation: { type: String, required: true },
    deliveryFrequency: { type: String },
    budgetMin: { type: Number },
    budgetMax: { type: Number },
    budgetCurrency: { type: String, default: 'USD' },
    preferredQuality: { type: String },
    deadline: { type: Date },
    images: [{ type: String }],
    videoUrl: { type: String },
    status: {
      type: String,
      enum: ['OPEN', 'REVIEWING', 'AWARDED', 'FULFILLED', 'CANCELLED', 'EXPIRED'],
      default: 'OPEN',
    },
    bidCount: { type: Number, default: 0 },
    viewCount: { type: Number, default: 0 },
    isUrgent: { type: Boolean, default: false },
    expiresAt: { type: Date },
  },
  { timestamps: true }
)

RequirementSchema.index({ buyerId: 1 })
RequirementSchema.index({ status: 1 })
RequirementSchema.index({ deliveryLocation: 1 })
RequirementSchema.index({ productType: 1 })
RequirementSchema.index({ title: 'text', description: 'text', productType: 'text' })

export default mongoose.model<IRequirement>('Requirement', RequirementSchema)
