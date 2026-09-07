import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

const envPath = path.resolve(__dirname, '../../.env')
const hasEnvFile = fs.existsSync(envPath)

// A deploy that pulls the repo gets no .env (it is gitignored, and the commit
// that untracked it deletes the file on every other clone). Without this notice
// the process silently falls back to the defaults below — binding a different
// port and pointing at a local Mongo that isn't there — which looks exactly
// like "the deploy didn't take" rather than "the config vanished".
if (!hasEnvFile) {
  console.warn(`⚠️  No .env found at ${envPath} — using built-in defaults.`)
  console.warn('   Copy backend/.env.example to backend/.env and fill it in.')
}

dotenv.config()

export const env = {
  // Must match .env.example and the Vite dev proxy target (frontend/vite.config.ts).
  // These disagreed before: the example said 9000 while this fell back to 5000, so a
  // missing .env moved the API to a port nothing was proxying to.
  PORT: process.env['PORT'] || '9000',
  MONGO_URI: process.env['MONGO_URI'] || 'mongodb://localhost:27017/emazao',
  JWT_SECRET: process.env['JWT_SECRET'] || 'fallback_secret',
  JWT_REFRESH_SECRET: process.env['JWT_REFRESH_SECRET'] || 'fallback_refresh',
  JWT_EXPIRES_IN: process.env['JWT_EXPIRES_IN'] || '15m',
  JWT_REFRESH_EXPIRES_IN: process.env['JWT_REFRESH_EXPIRES_IN'] || '7d',
  CLIENT_URL: process.env['CLIENT_URL'] || 'http://localhost:5173',
  CLOUDINARY_CLOUD_NAME: process.env['CLOUDINARY_CLOUD_NAME'] || '',
  CLOUDINARY_API_KEY: process.env['CLOUDINARY_API_KEY'] || '',
  CLOUDINARY_API_SECRET: process.env['CLOUDINARY_API_SECRET'] || '',
  // --- Payments ---
  // Which rail money actually moves over. See services/payments/index.ts.
  PAYMENT_PROVIDER: process.env['PAYMENT_PROVIDER'] || 'clickpesa',
  CLICKPESA_CLIENT_ID: process.env['CLICKPESA_CLIENT_ID'] || '',
  CLICKPESA_API_KEY: process.env['CLICKPESA_API_KEY'] || '',
  // Optional, but leaving it unset disables webhook authenticity checks entirely.
  CLICKPESA_CHECKSUM_KEY: process.env['CLICKPESA_CHECKSUM_KEY'] || '',
  // --- Identity & risk ---
  // Keys the national ID hash. Changing it orphans every stored hash, so treat it
  // as permanent once live — rotating it means re-collecting every seller's ID.
  NIDA_HASH_KEY: process.env['NIDA_HASH_KEY'] || '',
  FINGERPRINT_SALT: process.env['FINGERPRINT_SALT'] || 'dev_fingerprint_salt',
  // Optional self-hosted CPU vision service (OpenCV/MediaPipe). Unset = liveness
  // and face matching are unavailable rather than silently passing.
  BIOMETRIC_SERVICE_URL: process.env['BIOMETRIC_SERVICE_URL'] || '',
  BIOMETRIC_SERVICE_KEY: process.env['BIOMETRIC_SERVICE_KEY'] || '',
  EMAIL_HOST: process.env['EMAIL_HOST'] || 'smtp.gmail.com',
  EMAIL_PORT: parseInt(process.env['EMAIL_PORT'] || '587'),
  EMAIL_USER: process.env['EMAIL_USER'] || '',
  EMAIL_PASS: process.env['EMAIL_PASS'] || '',
  EMAIL_FROM: process.env['EMAIL_FROM'] || 'EMAZAO <noreply@emazao.com>',
  OPENAI_API_KEY: process.env['OPENAI_API_KEY'] || '',
  NODE_ENV: process.env['NODE_ENV'] || 'development',
} as const
