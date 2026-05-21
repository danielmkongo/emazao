import mongoose, { Schema, Document } from 'mongoose'

export interface ISave extends Document {
  userId: mongoose.Types.ObjectId
  productId: mongoose.Types.ObjectId
  createdAt: Date
}

const SaveSchema = new Schema<ISave>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  },
  { timestamps: true }
)

SaveSchema.index({ userId: 1, productId: 1 }, { unique: true })

export default mongoose.model<ISave>('Save', SaveSchema)
