import mongoose, { Schema, Document } from 'mongoose'

export type SaveTarget = 'Product' | 'Reel'

/**
 * A bookmark on a product or a reel — Instagram's save, TikTok's favourites.
 *
 * This used to hold only productId, so reels could not be saved at all. It now
 * addresses any saveable thing by (targetType, targetId), the same shape Like
 * already uses. `productId` is kept, populated for product saves, because rows
 * written before the change carry only that field; migrateSaves() backfills
 * them on boot.
 */
export interface ISave extends Document {
  userId: mongoose.Types.ObjectId
  targetType: SaveTarget
  targetId: mongoose.Types.ObjectId
  productId?: mongoose.Types.ObjectId
  createdAt: Date
}

const SaveSchema = new Schema<ISave>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    targetType: { type: String, enum: ['Product', 'Reel'], required: true },
    targetId: { type: Schema.Types.ObjectId, required: true, refPath: 'targetType' },
    productId: { type: Schema.Types.ObjectId, ref: 'Product' },
  },
  { timestamps: true }
)

SaveSchema.index({ userId: 1, targetType: 1, targetId: 1 }, { unique: true })
// "My saved, newest first" — the profile's Saved tab.
SaveSchema.index({ userId: 1, targetType: 1, createdAt: -1 })

const Save = mongoose.model<ISave>('Save', SaveSchema)

/**
 * Bring rows from the product-only schema up to date. Idempotent, and run on
 * every boot so a deploy cannot forget it.
 *
 * Dropping the old { userId, productId } unique index is the part that matters:
 * a reel save has no productId, so under that index a user's second reel save
 * would collide with their first on a null key and fail.
 */
export async function migrateSaves(): Promise<void> {
  const legacy = await Save.collection.updateMany(
    { targetId: { $exists: false }, productId: { $exists: true } },
    [{ $set: { targetId: '$productId', targetType: 'Product' } }]
  )
  if (legacy.modifiedCount) console.log(`saves: backfilled ${legacy.modifiedCount} product save(s) to the new shape`)

  const indexes = await Save.collection.indexes()
  if (indexes.some(i => i.name === 'userId_1_productId_1')) {
    await Save.collection.dropIndex('userId_1_productId_1')
    console.log('saves: dropped the product-only unique index')
  }
  await Save.syncIndexes()
}

export default Save
