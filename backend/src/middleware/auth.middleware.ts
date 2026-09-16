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

export const optionalProtect = async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1]
      if (token) {
        const decoded = jwt.verify(token, env.JWT_SECRET) as { id: string; role: string; email: string }
        req.user = { id: decoded.id, role: decoded.role, email: decoded.email }
      }
    }
  } catch {}
  next()
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
    if (user.isSuspended) {
      res.status(403).json({ success: false, message: 'Account suspended' })
      return
    }

    req.user = { id: decoded.id, role: decoded.role, email: decoded.email }

    // Activity stamp, throttled to once every 5 minutes per account. Writing on
    // every authenticated request would add a database write to each call for a
    // figure that only needs to be accurate to the hour; the admin console uses
    // it to separate active accounts from ones that have gone quiet and should
    // be contacted. Deliberately not awaited — response time should not depend
    // on bookkeeping.
    const FIVE_MIN = 5 * 60 * 1000
    if (!user.lastSeenAt || Date.now() - user.lastSeenAt.getTime() > FIVE_MIN) {
      User.updateOne({ _id: user._id }, { lastSeenAt: new Date() }).catch(() => {})
    }

    next()
  } catch {
    res.status(401).json({ success: false, message: 'Token invalid or expired' })
  }
}
