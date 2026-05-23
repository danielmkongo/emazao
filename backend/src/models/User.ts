import mongoose, { Schema, Document } from 'mongoose'

export type UserRole = 'BUYER' | 'FARMER' | 'BUSINESS_BUYER' | 'LOGISTICS' | 'ADMIN' | 'SUPER_ADMIN'
export type AccountType = 'PERSONAL' | 'BUSINESS'
export type VerifiedType = 'ID_VERIFIED' | 'FARM_VERIFIED' | 'BUSINESS_VERIFIED'
export type SubscriptionTier = 'FREE' | 'PRO_FARMER' | 'ENTERPRISE'

export interface IUser extends Document {
  email: string
  phone?: string
  name: string
  username: string
  passwordHash?: string
  avatar?: string
  coverImage?: string
  bio?: string
  role: UserRole
  accountType: AccountType
  isVerified: boolean
  verifiedType?: VerifiedType
  location?: string
  country?: string
  region?: string
  language: string
  currency: string
  subscriptionTier: SubscriptionTier
  onboardingDone: boolean
  refreshToken?: string
  otp?: string
  otpExpiry?: Date
  followersCount: number
  followingCount: number
  createdAt: Date
  updatedAt: Date
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, unique: true, required: true, lowercase: true, trim: true },
    phone: { type: String, unique: true, sparse: true, trim: true },
    name: { type: String, required: true, trim: true },
    username: { type: String, unique: true, required: true, lowercase: true, trim: true },
    passwordHash: { type: String },
    avatar: { type: String },
    coverImage: { type: String },
    bio: { type: String, maxlength: 500 },
    role: {
      type: String,
      enum: ['BUYER', 'FARMER', 'BUSINESS_BUYER', 'LOGISTICS', 'ADMIN', 'SUPER_ADMIN'],
      default: 'BUYER',
    },
    accountType: { type: String, enum: ['PERSONAL', 'BUSINESS'], default: 'PERSONAL' },
    isVerified: { type: Boolean, default: false },
    verifiedType: { type: String, enum: ['ID_VERIFIED', 'FARM_VERIFIED', 'BUSINESS_VERIFIED'] },
    location: { type: String },
    country: { type: String },
    region: { type: String },
    language: { type: String, default: 'en' },
    currency: { type: String, default: 'USD' },
    subscriptionTier: { type: String, enum: ['FREE', 'PRO_FARMER', 'ENTERPRISE'], default: 'FREE' },
    onboardingDone: { type: Boolean, default: false },
    refreshToken: { type: String },
    otp: { type: String },
    otpExpiry: { type: Date },
    followersCount: { type: Number, default: 0 },
    followingCount: { type: Number, default: 0 },
  },
  { timestamps: true }
)

UserSchema.index({ role: 1 })
UserSchema.index({ country: 1, region: 1 })

export default mongoose.model<IUser>('User', UserSchema)
