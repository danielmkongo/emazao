import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { createServer } from 'http'
import { Server as SocketServer } from 'socket.io'
import rateLimit from 'express-rate-limit'
import path from 'path'
import fs from 'fs'

import { env } from './config/env'
import { connectDB } from './config/db'
import { initSocket } from './socket'
import { setIo } from './services/notification.service'
import { errorHandler, notFound } from './middleware/errorHandler'
import { paymentWebhook } from './controllers/payment.controller'

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
import liveRoutes from './routes/live.routes'
import eventRoutes from './routes/event.routes'
import recommendationRoutes from './routes/recommendation.routes'
import verificationRoutes from './routes/verification.routes'
import reviewRoutes from './routes/review.routes'
import feedbackRoutes from './routes/feedback.routes'
import cartRoutes from './routes/cart.routes'
import storyRoutes from './routes/story.routes'
import { seedCategories } from './config/seed'
import { startRecommendationJobs } from './services/recommendation/jobs'
import { startRequirementExpiryJob } from './services/requirementExpiry.job'
import LiveSession from './models/LiveSession'
import { migrateSaves } from './models/Save'

const app = express()
const httpServer = createServer(app)

/**
 * Origins allowed to call the API and open a socket.
 *
 * CLIENT_URL used to be passed straight through as a single origin, which can
 * only ever match one host. That broke realtime in two ordinary situations: a
 * developer running Vite on :5173 against the API on :9000 (every socket
 * handshake rejected by CORS, so live messages and calls silently never
 * arrived), and a deployment served at both example.com and www.example.com,
 * where whichever one is configured blocks the other.
 *
 * CLIENT_URL now accepts a comma-separated list, the www/apex counterpart is
 * derived automatically, and local dev origins are allowed outside production.
 */
const allowedOrigins = (() => {
  const configured = env.CLIENT_URL.split(',').map(o => o.trim()).filter(Boolean)
  const withCounterparts = configured.flatMap(o => {
    try {
      const u = new URL(o)
      const host = u.host.startsWith('www.') ? u.host.slice(4) : `www.${u.host}`
      return [o, `${u.protocol}//${host}`]
    } catch {
      return [o]
    }
  })
  if (env.NODE_ENV !== 'production') {
    withCounterparts.push('http://localhost:5173', 'http://127.0.0.1:5173')
  }
  return [...new Set(withCounterparts)]
})()

// A request with no Origin header (curl, a health check, a native app) is not a
// browser cross-origin request, so there is nothing for CORS to protect against.
const corsOrigin = (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
  if (!origin || allowedOrigins.includes(origin)) return cb(null, true)
  cb(null, false)
}

// Socket.io — long ping timeout keeps live streams alive through nginx
const io = new SocketServer(httpServer, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'], credentials: true },
  pingTimeout: 60000,   // wait 60s for pong before disconnecting
  pingInterval: 25000,  // ping every 25s (well under nginx's 60s read timeout)
})
initSocket(io)
setIo(io)

// Middleware
app.use(helmet({
  hsts: false,                      // no HTTPS-upgrade header
  crossOriginOpenerPolicy: false,   // causes browser warnings on HTTP
  originAgentCluster: false,        // same
  contentSecurityPolicy: false,     // CSP can block assets on HTTP
}))
app.use(cors({ origin: corsOrigin, credentials: true }))

// Request logging — previously there was no record of what requests a
// production incident even involved, only whatever a controller happened to
// console.error inside its own catch block.
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'))

app.use(express.json({ limit: '10mb' }))

// Payment provider callback. Mounted outside the /api router stack so it bypasses
// `protect` — the provider proves itself with an HMAC checksum over the payload
// instead of a session. ClickPesa's checksum is computed over the canonicalised
// JSON rather than the raw byte stream, so unlike Stripe this can safely run
// after express.json().
app.post('/api/payments/webhook', paymentWebhook)
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
app.use('/api/live', liveRoutes)
app.use('/api/events', eventRoutes)
app.use('/api/recommendation', recommendationRoutes)
app.use('/api/verification', verificationRoutes)
app.use('/api/reviews', reviewRoutes)
app.use('/api/feedback', feedbackRoutes)
app.use('/api/cart', cartRoutes)
app.use('/api/stories', storyRoutes)

// An unmatched /api/* path should 404 as JSON, not fall through to the SPA's
// index.html below — otherwise a typo'd endpoint or a client bug looks like a
// silent 200 instead of a clear error.
app.use('/api', notFound)

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
}

// Always mounted, regardless of whether the frontend build exists — previously
// this only ran in the `else` branch above, so in production (where the built
// frontend is served from this same process) a thrown error had nowhere to
// land and fell through to Express's default handler instead.
app.use(errorHandler)

// Start
const start = async () => {
  // Fail loudly on a missing production secret instead of silently issuing
  // tokens signed with (or accepting webhooks verified against) a fallback
  // value anyone could guess from the source.
  if (env.NODE_ENV === 'production') {
    // Hard requirements: tokens signed with a guessable fallback are forgeable,
    // and there is no usable mode without a database.
    const required = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'MONGO_URI']
    const missing = required.filter(k => !process.env[k])
    if (missing.length) throw new Error(`Missing required env var(s) in production: ${missing.join(', ')}`)

    // Feature keys. These used to be hard requirements too, which meant a site
    // with no payment provider yet could not start at all. Each unset key now
    // disables its own feature at the point of use rather than the whole server:
    // the webhook rejects every callback without CLICKPESA_CHECKSUM_KEY, and ID
    // verification returns "not configured" without NIDA_HASH_KEY. So the site
    // serves, and the parts that need credentials stay off until they have them.
    const degraded: Record<string, string> = {
      CLICKPESA_CLIENT_ID: 'payment collection disabled',
      CLICKPESA_API_KEY: 'payment collection disabled',
      CLICKPESA_CHECKSUM_KEY: 'payment webhooks rejected — orders cannot be confirmed paid',
      NIDA_HASH_KEY: 'seller ID verification disabled',
      // Falls back to a shared default, so fingerprints stay correlatable across
      // deployments — a weaker signal for self-dealing detection, not an outage.
      FINGERPRINT_SALT: 'risk fingerprints use the default salt',
    }
    const unset = Object.keys(degraded).filter(k => !process.env[k])
    if (unset.length) {
      console.warn('⚠️  Running with reduced functionality — unset in production:')
      for (const k of unset) console.warn(`   ${k}: ${degraded[k]}`)
    }
  }

  await connectDB()

  // In-memory viewer/broadcaster tracking always starts empty on a fresh process,
  // so any LiveSession left over from before a restart/crash is guaranteed stale —
  // clear it immediately rather than waiting on the TTL index.
  await LiveSession.deleteMany({})

  await seedCategories()
  // Idempotent: upgrades product-only saves and drops the index that would make
  // a second reel save collide. Failure is logged, not fatal — the app still
  // works for everything except saving reels.
  await migrateSaves().catch(err => console.error('saves migration failed:', (err as Error).message))
  startRecommendationJobs()
  startRequirementExpiryJob()
  httpServer.listen(parseInt(env.PORT), () => {
    console.log(`🚀 EMAZAO API running on port ${env.PORT}`)
    console.log(`🌐 Environment: ${env.NODE_ENV}`)
  })
}

start().catch((err) => {
  console.error('❌ Startup failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
