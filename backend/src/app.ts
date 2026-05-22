import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { createServer } from 'http'
import { Server as SocketServer } from 'socket.io'
import rateLimit from 'express-rate-limit'
import path from 'path'
import fs from 'fs'

import { env } from './config/env'
import { connectDB } from './config/db'
import { initSocket } from './socket'
import { errorHandler, notFound } from './middleware/errorHandler'

// Routes
import authRoutes from './routes/auth.routes'
import userRoutes from './routes/user.routes'
import productRoutes from './routes/product.routes'
import requirementRoutes from './routes/requirement.routes'
import feedRoutes from './routes/feed.routes'
import searchRoutes from './routes/search.routes'
import uploadRoutes from './routes/upload.routes'
import orderRoutes from './routes/order.routes'
import paymentRoutes from './routes/payment.routes'
import walletRoutes from './routes/wallet.routes'
import messageRoutes from './routes/message.routes'
import notificationRoutes from './routes/notification.routes'
import analyticsRoutes from './routes/analytics.routes'
import socialRoutes from './routes/social.routes'
import reelRoutes from './routes/reel.routes'
import adminRoutes from './routes/admin.routes'
import categoryRoutes from './routes/category.routes'
import { seedCategories } from './config/seed'

const app = express()
const httpServer = createServer(app)

// Socket.io
const io = new SocketServer(httpServer, {
  cors: { origin: env.CLIENT_URL, methods: ['GET', 'POST'] },
})
initSocket(io)

// Middleware
app.use(helmet({ hsts: false })) // disable HSTS until HTTPS is configured
app.use(cors({ origin: env.CLIENT_URL, credentials: true }))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false })
app.use('/api', limiter)

// Health check
app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }))

// API Routes
app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/products', productRoutes)
app.use('/api/requirements', requirementRoutes)
app.use('/api/feed', feedRoutes)
app.use('/api/search', searchRoutes)
app.use('/api/upload', uploadRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/payments', paymentRoutes)
app.use('/api/wallet', walletRoutes)
app.use('/api/messages', messageRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/social', socialRoutes)
app.use('/api/reels', reelRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/categories', categoryRoutes)

// Serve frontend static files if built
const frontendDist = path.join(__dirname, '../../frontend/dist')
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist))
  // Express 5 catch-all: use middleware instead of app.get('*')
  app.use((_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'))
  })
} else {
  app.use(notFound)
  app.use(errorHandler)
}

// Start
const start = async () => {
  await connectDB()
  await seedCategories()
  httpServer.listen(parseInt(env.PORT), () => {
    console.log(`🚀 EMAZAO API running on port ${env.PORT}`)
    console.log(`🌐 Environment: ${env.NODE_ENV}`)
  })
}

start()
