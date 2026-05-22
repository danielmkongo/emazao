export type UserRole = 'BUYER' | 'FARMER' | 'BUSINESS_BUYER' | 'LOGISTICS' | 'ADMIN' | 'SUPER_ADMIN'
export type SubscriptionTier = 'FREE' | 'PRO_FARMER' | 'ENTERPRISE'

export interface User {
  _id: string
  name: string
  email: string
  username: string
  avatar?: string
  coverImage?: string
  bio?: string
  role: UserRole
  isVerified: boolean
  verifiedType?: string
  country?: string
  region?: string
  location?: string
  currency: string
  subscriptionTier: SubscriptionTier
  onboardingDone: boolean
  followersCount: number
  followingCount: number
  createdAt: string
}

export interface SellerProfile {
  _id: string
  userId: string
  farmName: string
  farmDescription?: string
  farmSize?: number
  farmLocation?: string
  farmImages: string[]
  certifications: string[]
  specializations: string[]
  storeSlug: string
  bannerImage?: string
  rating: number
  ratingCount: number
  totalSales: number
  totalRevenue: number
  onTimeDelivery: number
}

export interface Category {
  _id: string
  name: string
  slug: string
  icon?: string
  image?: string
}

export interface Product {
  _id: string
  sellerId: User | string
  categoryId: Category | string
  title: string
  slug: string
  description: string
  images: string[]
  price: number
  priceUnit: string
  minimumOrder?: number
  availableStock?: number
  stockUnit?: string
  condition: string
  isOrganic: boolean
  tags: string[]
  status: string
  isBoosted: boolean
  viewCount: number
  likeCount: number
  saveCount: number
  orderCount: number
  rating: number
  ratingCount: number
  createdAt: string
}

export interface Requirement {
  _id: string
  buyerId: User | string
  title: string
  description: string
  productType: string
  quantityAmount: number
  quantityUnit: string
  deliveryLocation: string
  deliveryFrequency?: string
  budgetMin?: number
  budgetMax?: number
  budgetCurrency: string
  preferredQuality?: string
  deadline?: string
  images: string[]
  status: string
  bidCount: number
  viewCount: number
  isUrgent: boolean
  createdAt: string
}

export interface Bid {
  _id: string
  requirementId: string
  farmerId: User | string
  pricePerUnit: number
  totalPrice: number
  currency: string
  deliveryTimeline: string
  message: string
  status: string
  score?: number
  sampleAvailable: boolean
  certifications: string[]
  createdAt: string
}

export interface Order {
  _id: string
  orderNumber: string
  buyerId: User | string
  sellerId: User | string
  items: OrderItem[]
  subtotal: number
  deliveryFee: number
  platformFee: number
  total: number
  currency: string
  status: string
  estimatedDelivery?: string
  deliveryAddress?: {
    street: string
    city: string
    region: string
    country: string
  }
  createdAt: string
}

export interface OrderItem {
  productId: string
  title: string
  image: string
  quantity: number
  unit: string
  unitPrice: number
  totalPrice: number
}

export interface Reel {
  _id: string
  userId: User | string
  productId?: string
  caption?: string
  videoUrl: string
  thumbnailUrl?: string
  duration?: number
  tags: string[]
  viewCount: number
  likeCount: number
  commentCount: number
  shareCount: number
  status: string
  createdAt: string
}

export interface FeedItem {
  type: 'PRODUCT' | 'REEL'
  score: number
  data: Product | Reel
  createdAt: string
}

export interface Notification {
  _id: string
  userId: string
  type: string
  title: string
  body: string
  data?: Record<string, unknown>
  readAt?: string
  createdAt: string
}

export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
  pagination?: { page: number; limit: number; total: number }
  nextCursor?: string | null
}
