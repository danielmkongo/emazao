import mongoose, { Schema, Document } from 'mongoose'

/**
 * A blocked identity, kept separate from the User record it came from.
 *
 * Suspending a user stops that account; it does nothing to stop the same person
 * signing up again an hour later with a new email. The durable identifiers are
 * the phone number and the national ID, so those are what get banned — and they
 * have to outlive the account, because a deleted user takes its own isSuspended
 * flag with it.
 *
 * The national ID is stored only as the same keyed hash used everywhere else
 * (see utils/nida.ts); the number itself is never written here.
 */
export interface IBanEntry extends Document {
  phone?: string
  nidaHash?: string
  reason: string
  bannedBy: mongoose.Types.ObjectId
  bannedByEmail: string
  sourceUserId?: mongoose.Types.ObjectId
  liftedAt?: Date
  liftedBy?: mongoose.Types.ObjectId
  createdAt: Date
}

const BanEntrySchema = new Schema<IBanEntry>(
  {
    // Sparse because an entry may ban a phone, a national ID, or both — a plain
    // unique index would collide on every document that omits one of them.
    phone: { type: String, trim: true, index: true, sparse: true },
    nidaHash: { type: String, index: true, sparse: true },
    reason: { type: String, required: true },
    bannedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    bannedByEmail: { type: String, required: true },
    sourceUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    // Lifting sets a date rather than deleting the row, so the history of who
    // was banned and who reversed it survives.
    liftedAt: { type: Date },
    liftedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

BanEntrySchema.index({ liftedAt: 1, createdAt: -1 })

export default mongoose.model<IBanEntry>('BanEntry', BanEntrySchema)
