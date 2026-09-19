import mongoose, { Schema, Document } from 'mongoose'

/** How long a story stays up. Instagram's and WhatsApp Status's 24 hours. */
export const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000

export const STORY_BACKGROUNDS = ['harvest', 'sunrise', 'soil', 'rain', 'night'] as const
export type StoryBackground = typeof STORY_BACKGROUNDS[number]

export interface IStory extends Document {
  userId: mongoose.Types.ObjectId
  /** Absent for a text story, which is drawn on `background` instead. */
  mediaUrl?: string
  mediaType?: 'IMAGE' | 'VIDEO'
  text?: string
  background?: StoryBackground
  caption?: string
  /**
   * A product sticker. A seller can pin one of their listings to a story and
   * viewers tap it to open the product — the story becomes a shop window, which
   * is what a farmer posting a morning harvest photo actually wants.
   */
  productId?: mongoose.Types.ObjectId
  viewCount: number
  reactionCount: number
  expiresAt: Date
  createdAt: Date
}

const StorySchema = new Schema<IStory>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    mediaUrl: { type: String },
    mediaType: { type: String, enum: ['IMAGE', 'VIDEO'] },
    text: { type: String, maxlength: 280 },
    background: { type: String, enum: STORY_BACKGROUNDS },
    caption: { type: String, maxlength: 200 },
    productId: { type: Schema.Types.ObjectId, ref: 'Product' },
    viewCount: { type: Number, default: 0 },
    reactionCount: { type: Number, default: 0 },
    // MongoDB's TTL monitor removes the document once this passes. Queries
    // still filter on it, because the monitor only runs about once a minute.
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true }
)

StorySchema.index({ userId: 1, expiresAt: 1 })

export default mongoose.model<IStory>('Story', StorySchema)
