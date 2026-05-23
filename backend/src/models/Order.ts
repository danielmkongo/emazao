import mongoose, { Schema, Document } from 'mongoose'

export type OrderStatus =
  | 'PENDING'
  | 'PAYMENT_CONFIRMED'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'DISPUTED'

export interface IOrderItem {
  productId: mongoose.Types.ObjectId
  title: string
  image: string
  quantity: number
  unit: string
  unitPrice: number
  totalPrice: number
}

export interface IDeliveryAddress {
  street: string
  city: string
  region: string
  country: string
  coordinates?: { lat: number; lng: number }
}

export interface IOrder extends Document {
  orderNumber: string
  buyerId: mongoose.Types.ObjectId
  sellerId: mongoose.Types.ObjectId
  items: IOrderItem[]
  subtotal: number
  deliveryFee: number
  platformFee: number
  total: number
  currency: string
  deliveryAddress: IDeliveryAddress
  notes?: string
  status: OrderStatus
  estimatedDelivery?: Date
  deliveredAt?: Date
  escrowId?: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const OrderSchema = new Schema<IOrder>(
  {
    orderNumber: { type: String, required: true, unique: true },
    buyerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    sellerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    items: [
      {
        productId: { type: Schema.Types.ObjectId, ref: 'Product' },
        title: String,
        image: String,
        quantity: Number,
        unit: String,
        unitPrice: Number,
        totalPrice: Number,
      },
    ],
    subtotal: { type: Number, required: true },
    deliveryFee: { type: Number, default: 0 },
    platformFee: { type: Number, default: 0 },
    total: { type: Number, required: true },
    currency: { type: String, default: 'USD' },
    deliveryAddress: {
      street: String,
      city: String,
      region: String,
      country: String,
      coordinates: { lat: Number, lng: Number },
    },
    notes: { type: String },
    status: {
      type: String,
      enum: [
        'PENDING', 'PAYMENT_CONFIRMED', 'PROCESSING', 'SHIPPED',
        'DELIVERED', 'COMPLETED', 'CANCELLED', 'REFUNDED', 'DISPUTED',
      ],
      default: 'PENDING',
    },
    estimatedDelivery: { type: Date },
    deliveredAt: { type: Date },
    escrowId: { type: Schema.Types.ObjectId, ref: 'Escrow' },
  },
  { timestamps: true }
)

OrderSchema.index({ buyerId: 1 })
OrderSchema.index({ sellerId: 1 })
OrderSchema.index({ status: 1 })

export default mongoose.model<IOrder>('Order', OrderSchema)
