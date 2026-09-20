import mongoose, { Schema, Document } from 'mongoose'

export interface IMessage extends Document {
  conversationId: mongoose.Types.ObjectId
  senderId: mongoose.Types.ObjectId
  content: string
  mediaUrl?: string
  mediaType?: 'IMAGE' | 'VIDEO'
  sharedReel?: mongoose.Types.ObjectId
  sharedProduct?: mongoose.Types.ObjectId
  clientId?: string
  storyReply?: {
    storyId: mongoose.Types.ObjectId
    ownerId: mongoose.Types.ObjectId
    mediaUrl?: string
    mediaType?: 'IMAGE' | 'VIDEO'
    text?: string
    background?: string
    reaction?: string
  }
  deliveredAt?: Date
  readAt?: Date
  createdAt: Date
}

const MessageSchema = new Schema<IMessage>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // May be empty when the message is a shared reel with no note attached —
    // the reel itself is the message. Empty text with nothing attached is still
    // refused, in the controller.
    content: { type: String, default: '' },
    // The sender's own id for this message, echoed back so their app can swap
    // its "sending…" copy for the saved one instead of showing both.
    clientId: { type: String, maxlength: 64 },
    mediaUrl: { type: String },
    mediaType: { type: String, enum: ['IMAGE', 'VIDEO'] },
    // A reel sent from its share sheet, rendered in the thread as a card that
    // opens the reel — Instagram and TikTok's "send to" rather than a pasted link.
    sharedReel: { type: Schema.Types.ObjectId, ref: 'Reel' },
    // The listing a question is about, attached when a buyer taps "Ask" on a
    // product. A reference rather than a copy: a seller answering "is this
    // still available?" should see the listing as it stands now, including its
    // current price and stock, not as it looked when the question was asked.
    sharedProduct: { type: Schema.Types.ObjectId, ref: 'Product' },
    // A reply or reaction to a story. A copy of what the story showed rather
    // than a reference: the story is gone in a day but the conversation stays,
    // and "what was this about?" must still be answerable next week.
    storyReply: {
      type: new Schema({
        storyId: { type: Schema.Types.ObjectId, ref: 'Story', required: true },
        ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        mediaUrl: String,
        mediaType: { type: String, enum: ['IMAGE', 'VIDEO'] },
        text: String,
        background: String,
        reaction: String,
      }, { _id: false }),
    },
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
