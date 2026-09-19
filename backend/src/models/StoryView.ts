import mongoose, { Schema, Document } from 'mongoose'

/** One person having seen one story, and the quick reaction they left, if any. */
export interface IStoryView extends Document {
  storyId: mongoose.Types.ObjectId
  ownerId: mongoose.Types.ObjectId
  viewerId: mongoose.Types.ObjectId
  reaction?: string
  createdAt: Date
}

const StoryViewSchema = new Schema<IStoryView>(
  {
    storyId: { type: Schema.Types.ObjectId, ref: 'Story', required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    viewerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reaction: { type: String, maxlength: 8 },
  },
  { timestamps: true }
)

StoryViewSchema.index({ storyId: 1, viewerId: 1 }, { unique: true })
StoryViewSchema.index({ storyId: 1, createdAt: -1 })
// Views outlive their story by a day so the owner's viewer list never races
// the story's own expiry, then they go too.
StoryViewSchema.index({ createdAt: 1 }, { expireAfterSeconds: 48 * 60 * 60 })

export default mongoose.model<IStoryView>('StoryView', StoryViewSchema)
