import multer from 'multer'
import path from 'path'

const storage = multer.memoryStorage()

// Type or extension may be blank depending on the phone (iPhones often send
// HEIC with no type), so either one matching is enough.
const allowed = /jpeg|jpg|png|gif|webp|heic|heif|mp4|mov|avi|webm|m4v|3gp|quicktime/
const fileFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = allowed.test(path.extname(file.originalname).toLowerCase())
  const mime = /^(image|video)\//.test(file.mimetype) && allowed.test(file.mimetype)
  if (ext || mime) cb(null, true)
  else cb(new Error('Only photos and videos can be uploaded'))
}

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
})
