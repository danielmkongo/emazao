import mongoose, { Schema, Document } from 'mongoose'

export type NotificationType =
  | 'ORDER' | 'BID' | 'MESSAGE' | 'LIKE' | 'FOLLOW'
  | 'COMMENT' | 'PAYMENT' | 'DELIVERY' | 'PROMOTION' | 'SYSTEM'

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId
  type: NotificationType
  title: string
  body: string
  data?: Record<string, unknown>
  isRead: boolean
  readAt?: Date
  createdAt: Date
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['ORDER', 'BID', 'MESSAGE', 'LIKE', 'FOLLOW', 'COMMENT', 'PAYMENT', 'DELIVERY', 'PROMOTION', 'SYSTEM'],
    },
    title: { type: String, required: true },
    body: { type: String, required: true },
    data: { type: Schema.Types.Mixed },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date },
  },
  { timestamps: true }
)

NotificationSchema.index({ userId: 1, readAt: 1 })
NotificationSchema.index({ userId: 1, createdAt: -1 })

export default mongoose.model<INotification>('Notification', NotificationSchema)
