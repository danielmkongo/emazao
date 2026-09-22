import { Request, Response, NextFunction } from 'express'
import User from '../models/User'
import { requestClaims } from '../utils/tokens'

export interface AuthRequest extends Request {
  user?: {
    id: string
    role: string
    email: string
  }
}

export const optionalProtect = async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const claims = requestClaims(req)
    if (claims) req.user = { id: claims.id, role: claims.role, email: claims.email }
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

    const decoded = requestClaims(req)
    if (!decoded) {
      res.status(401).json({ success: false, message: 'Token invalid or expired' })
      return
    }
    // Two fields and a plain object: this runs on every signed-in request, and
    // turning a whole user document into a Mongoose object only to read
    // `isSuspended` was a measurable share of the server's CPU.
    const user = await User.findById(decoded.id).select('isSuspended lastSeenAt').lean()
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
