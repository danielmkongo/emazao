import mongoose, { Schema, Document } from 'mongoose'

export interface IMessage extends Document {
  conversationId: mongoose.Types.ObjectId
  senderId: mongoose.Types.ObjectId
  content: string
  mediaUrl?: string
  mediaType?: 'IMAGE' | 'VIDEO'
  readAt?: Date
  createdAt: Date
}

const MessageSchema = new Schema<IMessage>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    mediaUrl: { type: String },
    mediaType: { type: String, enum: ['IMAGE', 'VIDEO'] },
    readAt: { type: Date },
  },
  { timestamps: true }
)

MessageSchema.index({ conversationId: 1, createdAt: 1 })

export default mongoose.model<IMessage>('Message', MessageSchema)
