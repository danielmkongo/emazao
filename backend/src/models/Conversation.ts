import mongoose, { Schema, Document } from 'mongoose'

export interface IConversation extends Document {
  participants: mongoose.Types.ObjectId[]
  type: 'DIRECT' | 'BID_NEGOTIATION'
  lastMessage?: string
  lastMessageAt?: Date
  clears?: { userId: mongoose.Types.ObjectId; at: Date }[]
  createdAt: Date
}

const ConversationSchema = new Schema<IConversation>(
  {
    participants: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    type: { type: String, enum: ['DIRECT', 'BID_NEGOTIATION'], default: 'DIRECT' },
    lastMessage: { type: String },
    lastMessageAt: { type: Date },

    // "Delete chat", one entry per person who has done it. Deleting a
    // conversation hides it and everything said before that moment from that
    // one person; nothing is removed, because the other party still has their
    // copy and a dispute may turn on it. A later message brings the thread
    // back, as it does everywhere else, starting from empty.
    clears: [{
      _id: false,
      userId: { type: Schema.Types.ObjectId, ref: 'User' },
      at: { type: Date },
    }],
  },
  { timestamps: true }
)

// The inbox query is find({ participants }) sorted by lastMessageAt desc, and
// it now runs on every incoming message rather than only on page load, so the
// in-memory sort this avoids was about to get a lot more expensive.
ConversationSchema.index({ participants: 1, lastMessageAt: -1 })

export default mongoose.model<IConversation>('Conversation', ConversationSchema)
