import { Router, Response } from 'express'
import { upload } from '../middleware/upload.middleware'
import { protect } from '../middleware/auth.middleware'
import { AuthRequest } from '../middleware/auth.middleware'
import cloudinary from '../config/cloudinary'
import { env } from '../config/env'

/**
 * A still image of a Cloudinary video, cut from its first second.
 *
 * The upload route used to make one by swapping '.mp4' for '.jpg', which does
 * nothing to a phone recording — iPhones save .mov and the in-app camera
 * saves .webm — so those reels were stored with the video itself as their
 * "thumbnail". Cloudinary will render a frame of any video if asked by
 * transformation, whatever the extension, so ask it that way.
 */
function videoPoster(url: string): string {
  const m = url.match(/^(https?:\/\/res\.cloudinary\.com\/[^/]+\/video\/upload\/)(.+?)(\.[a-z0-9]+)?(\?.*)?$/i)
  return m ? `${m[1]}so_1,w_480,c_limit,q_auto,f_jpg/${m[2]}.jpg` : url
}

const router = Router()

/** Cloudinary rejects with a plain object, not an Error, so .message was undefined. */
function uploadError(err: unknown): string {
  const e = err as { message?: string; error?: { message?: string } }
  return e?.message || e?.error?.message || 'Upload failed'
}

/**
 * POST /api/upload/sign — permission for the phone to upload straight to Cloudinary.
 *
 * Uploads used to pass through this server: phone → nginx → Express → Cloudinary.
 * nginx refuses bodies over 1 MB unless configured otherwise, so most videos and
 * many photos died there as "too large"; the whole file sat in this process's
 * memory as base64; and the phone's progress bar reached 100% the moment the
 * file reached us, then sat still while we forwarded it on.
 *
 * Now the phone sends the file to Cloudinary itself, in chunks, and this route
 * only signs the request. The API secret never leaves the server, the folder is
 * fixed here rather than chosen by the caller, and a signature is only good
 * for an hour (Cloudinary's own rule).
 */
router.post('/sign', protect, (req: AuthRequest, res: Response) => {
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    // The caller falls back to uploading through this server.
    res.status(503).json({ success: false, message: 'Direct upload is not configured' })
    return
  }
  const resourceType = req.body?.kind === 'video' ? 'video' : 'image'
  const folder = resourceType === 'video' ? 'emazao/videos' : 'emazao/images'
  const timestamp = Math.round(Date.now() / 1000)
  const signature = cloudinary.utils.api_sign_request({ folder, timestamp }, env.CLOUDINARY_API_SECRET)
  res.json({
    success: true,
    data: {
      cloudName: env.CLOUDINARY_CLOUD_NAME,
      apiKey: env.CLOUDINARY_API_KEY,
      resourceType,
      folder,
      timestamp,
      signature,
    },
  })
})

router.post('/image', protect, upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) { res.status(400).json({ success: false, message: 'No file uploaded' }); return }
    const b64 = Buffer.from(req.file.buffer).toString('base64')
    const dataUri = `data:${req.file.mimetype};base64,${b64}`
    const result = await cloudinary.uploader.upload(dataUri, {
      folder: 'emazao/images',
      transformation: [{ quality: 'auto', fetch_format: 'auto' }],
    })
    res.json({ success: true, data: { url: result.secure_url, publicId: result.public_id } })
  } catch (err) {
    console.error('[upload] failed:', uploadError(err))
    res.status(500).json({ success: false, message: uploadError(err) })
  }
})

router.post('/video', protect, upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) { res.status(400).json({ success: false, message: 'No file uploaded' }); return }
    const b64 = Buffer.from(req.file.buffer).toString('base64')
    const dataUri = `data:${req.file.mimetype};base64,${b64}`
    const result = await cloudinary.uploader.upload(dataUri, {
      folder: 'emazao/videos',
      resource_type: 'video',
      transformation: [{ quality: 'auto' }],
    })
    res.json({ success: true, data: { url: result.secure_url, thumbnailUrl: videoPoster(result.secure_url), publicId: result.public_id } })
  } catch (err) {
    console.error('[upload] failed:', uploadError(err))
    res.status(500).json({ success: false, message: uploadError(err) })
  }
})

export default router
