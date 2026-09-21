import { Router, Response } from 'express'
import { upload } from '../middleware/upload.middleware'
import { protect } from '../middleware/auth.middleware'
import { AuthRequest } from '../middleware/auth.middleware'
import cloudinary from '../config/cloudinary'

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
