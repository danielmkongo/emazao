import mongoose, { Schema, Document } from 'mongoose'

export interface ISellerProfile extends Document {
  userId: mongoose.Types.ObjectId
  farmName: string
  farmDescription?: string
  farmSize?: number
  farmLocation?: string
  farmImages: string[]
  certifications: string[]
  specializations: string[]
  deliveryRadius?: number
  storeSlug: string
  bannerImage?: string
  rating: number
  ratingCount: number
  totalSales: number
  totalRevenue: number
  onTimeDelivery: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

const SellerProfileSchema = new Schema<ISellerProfile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    farmName: { type: String, required: true },
    farmDescription: { type: String },
    farmSize: { type: Number },
    farmLocation: { type: String },
    farmImages: [{ type: String }],
    certifications: [{ type: String }],
    specializations: [{ type: String }],
    deliveryRadius: { type: Number },
    storeSlug: { type: String, required: true, unique: true, lowercase: true },
    bannerImage: { type: String },
    rating: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    totalSales: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    onTimeDelivery: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
)

SellerProfileSchema.index({ storeSlug: 1 })
SellerProfileSchema.index({ farmLocation: 1 })
SellerProfileSchema.index({ specializations: 1 })

export default mongoose.model<ISellerProfile>('SellerProfile', SellerProfileSchema)
