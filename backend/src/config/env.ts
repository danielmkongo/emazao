import dotenv from 'dotenv'
dotenv.config()

export const env = {
  PORT: process.env['PORT'] || '5000',
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
