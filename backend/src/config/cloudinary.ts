import { v2 as cloudinary } from 'cloudinary'
import { env } from './env'

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
})

/**
 * Uploads an identity document.
 *
 * `type: 'authenticated'` is the important part: unlike product images, these are
 * sensitive personal data under Tanzania's Personal Data Protection Act 2022. An
 * authenticated asset is not reachable from its URL alone — it needs a signed,
 * expiring link — so a leaked database row does not expose anyone's ID card.
 */
export const uploadKycDocument = async (buffer: Buffer, mimetype = 'image/jpeg'): Promise<string> => {
  const dataUri = `data:${mimetype};base64,${buffer.toString('base64')}`
  const result = await cloudinary.uploader.upload(dataUri, {
    folder: 'emazao/kyc',
    type: 'authenticated',
    resource_type: 'image',
    // No `fetch_format: auto` — re-encoding a document can smooth out exactly the
    // compression artefacts a reviewer needs to spot a forgery.
    transformation: [{ quality: 'auto:best' }],
  })
  return result.public_id
}

/**
 * Short-lived signed URL for a reviewer to view a document. Expires quickly so a
 * link pasted into a chat or an email stops working almost immediately.
 */
export const signedKycUrl = (publicId: string, ttlSeconds = 300): string =>
  cloudinary.url(publicId, {
    type: 'authenticated',
    resource_type: 'image',
    sign_url: true,
    secure: true,
    expires_at: Math.floor(Date.now() / 1000) + ttlSeconds,
  })

export default cloudinary
