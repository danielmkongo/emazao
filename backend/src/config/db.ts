import mongoose from 'mongoose'
import { env } from './env'

export const connectDB = async (): Promise<void> => {
  try {
    const conn = await mongoose.connect(env.MONGO_URI)
    console.log(`✅ MongoDB connected: ${conn.connection.host}`)
  } catch (err) {
    console.error('❌ MongoDB connection error:', err)
    console.warn('⚠️  Server starting without database. Set MONGO_URI in .env to a running MongoDB instance or MongoDB Atlas URI.')
  }
}
