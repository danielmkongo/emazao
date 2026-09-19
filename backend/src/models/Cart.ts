import mongoose, { Schema, Document } from 'mongoose'

/**
 * A buyer's cart, kept on the server rather than in the browser so it follows
 * them between phone and laptop, and survives clearing the browser.
 *
 * Only the product and quantity are stored. Price, seller and availability are
 * read fresh every time the cart is shown and again at checkout — a price saved
 * here would go stale the moment a farmer changed it.
 */
export interface ICart extends Document {
  userId: mongoose.Types.ObjectId
  items: { productId: mongoose.Types.ObjectId; quantity: number; addedAt: Date }[]
  updatedAt: Date
}

const CartSchema = new Schema<ICart>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    items: [{
      _id: false,
      productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
      quantity: { type: Number, required: true, min: 0.01 },
      addedAt: { type: Date, default: Date.now },
    }],
  },
  { timestamps: true }
)

export default mongoose.model<ICart>('Cart', CartSchema)
