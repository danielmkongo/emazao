import mongoose from 'mongoose'
import { env } from './env'

export const connectDB = async (): Promise<void> => {
  try {
    // Fail in 10s rather than the 30s default: every model call after this point
    // buffers against a dead connection, so a slow failure here surfaced as a
    // server that printed nothing and never bound its port.
    const conn = await mongoose.connect(env.MONGO_URI, { serverSelectionTimeoutMS: 10000 })
    console.log(`✅ MongoDB connected: ${conn.connection.host}`)
  } catch (err) {
    // Previously this was swallowed and the server claimed it would start anyway —
    // but startup immediately awaits LiveSession.deleteMany(), which buffers
    // forever without a connection, so the process just hung silently. There is
    // no usable "without database" mode: every route needs Mongo.
    console.error('❌ MongoDB connection failed:', (err as Error).message)
    console.error('   Check MONGO_URI in backend/.env. For Atlas, confirm your current')
    console.error('   IP is on the cluster Network Access allowlist and the cluster is not paused.')
    throw err
  }
}
