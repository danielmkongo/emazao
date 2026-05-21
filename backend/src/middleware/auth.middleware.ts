import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env'
import User from '../models/User'

export interface AuthRequest extends Request {
  user?: {
    id: string
    role: string
    email: string
  }
}

export const protect = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, message: 'Not authorized — no token' })
      return
    }

    const token = authHeader.split(' ')[1]
    if (!token) {
      res.status(401).json({ success: false, message: 'Not authorized — token missing' })
      return
    }

    const decoded = jwt.verify(token, env.JWT_SECRET) as { id: string; role: string; email: string }
    const user = await User.findById(decoded.id).select('-passwordHash -refreshToken -otp -otpExpiry')
    if (!user) {
      res.status(401).json({ success: false, message: 'User no longer exists' })
      return
    }

    req.user = { id: decoded.id, role: decoded.role, email: decoded.email }
    next()
  } catch {
    res.status(401).json({ success: false, message: 'Token invalid or expired' })
  }
}
