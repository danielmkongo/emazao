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
  STRIPE_SECRET_KEY: process.env['STRIPE_SECRET_KEY'] || '',
  STRIPE_WEBHOOK_SECRET: process.env['STRIPE_WEBHOOK_SECRET'] || '',
  EMAIL_HOST: process.env['EMAIL_HOST'] || 'smtp.gmail.com',
  EMAIL_PORT: parseInt(process.env['EMAIL_PORT'] || '587'),
  EMAIL_USER: process.env['EMAIL_USER'] || '',
  EMAIL_PASS: process.env['EMAIL_PASS'] || '',
  EMAIL_FROM: process.env['EMAIL_FROM'] || 'EMAZAO <noreply@emazao.com>',
  OPENAI_API_KEY: process.env['OPENAI_API_KEY'] || '',
  NODE_ENV: process.env['NODE_ENV'] || 'development',
} as const
