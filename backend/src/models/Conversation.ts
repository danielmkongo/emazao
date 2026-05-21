import mongoose, { Schema, Document } from 'mongoose'

export interface IConversation extends Document {
  participants: mongoose.Types.ObjectId[]
  type: 'DIRECT' | 'BID_NEGOTIATION'
  lastMessage?: string
  lastMessageAt?: Date
  createdAt: Date
}

const ConversationSchema = new Schema<IConversation>(
  {
    participants: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    type: { type: String, enum: ['DIRECT', 'BID_NEGOTIATION'], default: 'DIRECT' },
    lastMessage: { type: String },
    lastMessageAt: { type: Date },
  },
  { timestamps: true }
)

ConversationSchema.index({ participants: 1 })

export default mongoose.model<IConversation>('Conversation', ConversationSchema)
