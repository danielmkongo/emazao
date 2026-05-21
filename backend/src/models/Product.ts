import mongoose, { Schema, Document } from 'mongoose'

export type ProductCondition = 'FRESH' | 'PROCESSED' | 'DRIED' | 'FROZEN' | 'SEEDS'
export type ProductStatus = 'ACTIVE' | 'INACTIVE' | 'OUT_OF_STOCK' | 'PENDING_REVIEW'

export interface IProduct extends Document {
  sellerId: mongoose.Types.ObjectId
  categoryId: mongoose.Types.ObjectId
  title: string
  slug: string
  description: string
  images: string[]
  price: number
  priceUnit: string
  minimumOrder?: number
  availableStock?: number
  stockUnit?: string
  condition: ProductCondition
  isOrganic: boolean
  harvestDate?: Date
  origin?: string
  certifications: string[]
  tags: string[]
  status: ProductStatus
  isBoosted: boolean
  boostExpiresAt?: Date
  viewCount: number
  likeCount: number
  saveCount: number
  orderCount: number
  rating: number
  ratingCount: number
  createdAt: Date
  updatedAt: Date
}

const ProductSchema = new Schema<IProduct>(
  {
    sellerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    description: { type: String, required: true },
    images: [{ type: String }],
    price: { type: Number, required: true, min: 0 },
    priceUnit: { type: String, required: true },
    minimumOrder: { type: Number },
    availableStock: { type: Number },
    stockUnit: { type: String },
    condition: {
      type: String,
      enum: ['FRESH', 'PROCESSED', 'DRIED', 'FROZEN', 'SEEDS'],
      default: 'FRESH',
    },
    isOrganic: { type: Boolean, default: false },
    harvestDate: { type: Date },
    origin: { type: String },
    certifications: [{ type: String }],
    tags: [{ type: String }],
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'OUT_OF_STOCK', 'PENDING_REVIEW'],
      default: 'ACTIVE',
    },
    isBoosted: { type: Boolean, default: false },
    boostExpiresAt: { type: Date },
    viewCount: { type: Number, default: 0 },
    likeCount: { type: Number, default: 0 },
    saveCount: { type: Number, default: 0 },
    orderCount: { type: Number, default: 0 },
    rating: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
  },
  { timestamps: true }
)

ProductSchema.index({ sellerId: 1 })
ProductSchema.index({ categoryId: 1 })
ProductSchema.index({ tags: 1 })
ProductSchema.index({ status: 1, isBoosted: 1 })
ProductSchema.index({ slug: 1 })
ProductSchema.index({ title: 'text', description: 'text', tags: 'text' })

export default mongoose.model<IProduct>('Product', ProductSchema)
