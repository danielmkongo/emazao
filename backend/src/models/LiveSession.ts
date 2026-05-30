import mongoose, { Schema, Document } from 'mongoose'

export interface ILiveSession extends Document {
  broadcasterId: mongoose.Types.ObjectId
  title: string
  viewerCount: number
  startedAt: Date
}

const LiveSessionSchema = new Schema<ILiveSession>({
  broadcasterId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  title: { type: String, default: '' },
  viewerCount: { type: Number, default: 0 },
  startedAt: { type: Date, default: Date.now },
})

export default mongoose.model<ILiveSession>('LiveSession', LiveSessionSchema)
