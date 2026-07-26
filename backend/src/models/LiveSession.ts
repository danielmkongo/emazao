import mongoose, { Schema, Document } from 'mongoose'

export interface ILiveSession extends Document {
  broadcasterId: mongoose.Types.ObjectId
  title: string
  viewerCount: number
  startedAt: Date
  lastHeartbeatAt: Date
}

const LiveSessionSchema = new Schema<ILiveSession>({
  broadcasterId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  title: { type: String, default: '' },
  viewerCount: { type: Number, default: 0 },
  startedAt: { type: Date, default: Date.now },
  // TTL index: if a broadcaster's process/tab dies without ever emitting
  // 'live:end' (crash, killed connection) and the periodic heartbeat stops,
  // Mongo garbage-collects the stale session ~60s after the last heartbeat
  // instead of it lingering forever and showing as permanently "LIVE".
  lastHeartbeatAt: { type: Date, default: Date.now, expires: 60 },
})

export default mongoose.model<ILiveSession>('LiveSession', LiveSessionSchema)
