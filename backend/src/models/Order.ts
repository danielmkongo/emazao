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
  trackingNumber?: string
  checkoutId?: mongoose.Types.ObjectId
  carrier?: string
  dispatchedAt?: Date
  trackingEvents?: { status: string; note?: string; location?: string; at: Date }[]
  escrowId?: mongoose.Types.ObjectId
  payerPhone?: string
  /** Snippe's own id for the hosted checkout, so its status can be asked for later. */
  cardSessionRef?: string
  collectionRequestedAt?: Date
  shippedAt?: Date
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
        productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
        title: { type: String, required: true },
        image: String,
        quantity: { type: Number, required: true, min: 0 },
        unit: { type: String, required: true },
        unitPrice: { type: Number, required: true, min: 0 },
        totalPrice: { type: Number, required: true, min: 0 },
      },
    ],
    subtotal: { type: Number, required: true },
    deliveryFee: { type: Number, default: 0 },
    platformFee: { type: Number, default: 0 },
    total: { type: Number, required: true },
    currency: { type: String, default: 'TZS' },
    deliveryAddress: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      region: String,
      country: { type: String, required: true },
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
    // Issued when the seller marks the order dispatched. Quotable over the
    // phone and printable on a delivery note, which an ObjectId is not.
    trackingNumber: { type: String, unique: true, sparse: true, uppercase: true, trim: true },
    carrier: { type: String, trim: true },
    dispatchedAt: { type: Date },
    // Append-only history. A single status field answers "where is it now" but
    // not "when did it leave" or "who said so", which is exactly what a buyer
    // chasing a late shipment — and a dispute reviewer afterwards — needs.
    trackingEvents: [{
      _id: false,
      status: { type: String, required: true },
      note: { type: String },
      location: { type: String },
      at: { type: Date, default: Date.now },
    }],
    escrowId: { type: Schema.Types.ObjectId, ref: 'Escrow' },
    // The mobile-money number that actually paid. A refund goes back to the
    // same wallet the money came from, never to a number typed in later.
    payerPhone: { type: String, select: false },
    // When a payment prompt was last sent. Lets the reconciler ask the
    // provider about recent attempts even if their webhook never arrives.
    // A card goes through the provider's hosted page, and that page is indexed
    // by the provider's reference rather than ours — so keep it, or a payment
    // whose webhook never arrives can never be reconciled.
    cardSessionRef: { type: String, index: true },
    collectionRequestedAt: { type: Date, index: true },
    // Starts the clock for automatic escrow release.
    shippedAt: { type: Date },
    // Set when this order was bought together with other sellers' orders in one
    // cart checkout. Such an order must be paid through its checkout: paying it
    // on its own and then the checkout as well would charge the buyer twice.
    checkoutId: { type: Schema.Types.ObjectId, ref: 'Checkout', index: true },
  },
  { timestamps: true }
)

// Compound rather than single-field: every list of orders sorts by createdAt
// desc (getOrders for a buyer or seller, the admin ledger by status). With only
// the match field indexed, Mongo finds the documents but then sorts them in
// memory — which fails outright past 32MB once an account has real history.
// A leading-equality prefix still serves the plain { buyerId } lookups these
// replace, so nothing regresses.
OrderSchema.index({ buyerId: 1, createdAt: -1 })
OrderSchema.index({ sellerId: 1, createdAt: -1 })
OrderSchema.index({ status: 1, createdAt: -1 })
// Lookup by the reference a buyer actually types into "Track my product".
OrderSchema.index({ trackingNumber: 1 })

export default mongoose.model<IOrder>('Order', OrderSchema)
