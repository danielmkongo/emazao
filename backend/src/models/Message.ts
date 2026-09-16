import mongoose, { Schema, Document } from 'mongoose'

export interface IMessage extends Document {
  conversationId: mongoose.Types.ObjectId
  senderId: mongoose.Types.ObjectId
  content: string
  mediaUrl?: string
  mediaType?: 'IMAGE' | 'VIDEO'
  deliveredAt?: Date
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
    // Set when the message actually reaches the recipient's client — either
    // pushed over their socket while they are connected, or on their next fetch
    // of the thread if they were offline. Distinct from readAt, which means they
    // opened the conversation: "arrived on their phone" and "they have seen it"
    // are different promises to make to a sender negotiating a shipment.
    deliveredAt: { type: Date },
    readAt: { type: Date },
  },
  { timestamps: true }
)

MessageSchema.index({ conversationId: 1, createdAt: 1 })
// Serves the "mark everything not yet delivered to me" update on thread open.
MessageSchema.index({ conversationId: 1, deliveredAt: 1 })

export default mongoose.model<IMessage>('Message', MessageSchema)
