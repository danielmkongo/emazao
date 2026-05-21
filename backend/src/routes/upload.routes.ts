import { Router, Response } from 'express'
import { upload } from '../middleware/upload.middleware'
import { protect } from '../middleware/auth.middleware'
import { AuthRequest } from '../middleware/auth.middleware'
import cloudinary from '../config/cloudinary'

const router = Router()

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
    res.status(500).json({ success: false, message: (err as Error).message })
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
    res.json({ success: true, data: { url: result.secure_url, thumbnailUrl: result.secure_url.replace('.mp4', '.jpg'), publicId: result.public_id } })
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message })
  }
})

export default router
