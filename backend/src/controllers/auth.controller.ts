import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { nanoid } from 'nanoid'
import { env } from '../config/env'
import User from '../models/User'
import Wallet from '../models/Wallet'
import { AuthRequest } from '../middleware/auth.middleware'
import { sendOtpEmail } from '../services/email.service'

const signAccess = (id: string, role: string, email: string) =>
  jwt.sign({ id, role, email }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions)

const signRefresh = (id: string) =>
  jwt.sign({ id }, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN } as jwt.SignOptions)

// POST /api/auth/register
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, phone, password, role = 'BUYER' } = req.body as {
      name: string; email: string; phone?: string; password: string; role?: string
    }

    if (!name || !email || !password) {
      res.status(400).json({ success: false, message: 'Name, email and password are required' })
      return
    }

    const exists = await User.findOne({ email: email.toLowerCase() })
    if (exists) {
      res.status(409).json({ success: false, message: 'Email already registered' })
      return
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const username = `${name.toLowerCase().replace(/\s+/g, '_')}_${nanoid(4)}`

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      phone,
      username,
      passwordHash,
      role: role as any,
    })

    // Create wallet for every user
    await Wallet.create({ userId: user._id })

    const accessToken = signAccess(user.id as string, user.role, user.email)
    const refreshToken = signRefresh(user.id as string)
    user.refreshToken = refreshToken
    await user.save()

    const userObj = user.toObject() as unknown as Record<string, unknown>
    delete userObj.passwordHash
    delete userObj.refreshToken
    delete userObj.otp
    delete userObj.otpExpiry

    res.status(201).json({
      success: true,
      data: { accessToken, refreshToken, user: userObj },
    })
  } catch (err) {
    const error = err as Error
    res.status(500).json({ success: false, message: error.message })
  }
}

// POST /api/auth/login
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body as { email: string; password: string }
    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Email and password required' })
      return
    }

    const user = await User.findOne({ email: email.toLowerCase() })
    if (!user || !user.passwordHash) {
      res.status(401).json({ success: false, message: 'Invalid credentials' })
      return
    }

    const match = await bcrypt.compare(password, user.passwordHash)
    if (!match) {
      res.status(401).json({ success: false, message: 'Invalid credentials' })
      return
    }

    const accessToken = signAccess(user.id as string, user.role, user.email)
    const refreshToken = signRefresh(user.id as string)
    user.refreshToken = refreshToken
    await user.save()

    const userObj = user.toObject() as unknown as Record<string, unknown>
    delete userObj.passwordHash
    delete userObj.refreshToken
    delete userObj.otp
    delete userObj.otpExpiry

    res.json({
      success: true,
      data: { accessToken, refreshToken, user: userObj },
    })
  } catch (err) {
    const error = err as Error
    res.status(500).json({ success: false, message: error.message })
  }
}

// POST /api/auth/refresh
export const refresh = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body as { refreshToken: string }
    if (!refreshToken) {
      res.status(400).json({ success: false, message: 'Refresh token required' })
      return
    }

    const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as { id: string }
    const user = await User.findById(decoded.id)
    if (!user || user.refreshToken !== refreshToken) {
      res.status(401).json({ success: false, message: 'Invalid refresh token' })
      return
    }

    const accessToken = signAccess(user.id as string, user.role, user.email)
    res.json({ success: true, data: { accessToken } })
  } catch {
    res.status(401).json({ success: false, message: 'Refresh token invalid or expired' })
  }
}

// POST /api/auth/logout
export const logout = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.user) {
      await User.findByIdAndUpdate(req.user.id, { refreshToken: undefined })
    }
    res.json({ success: true, message: 'Logged out' })
  } catch (err) {
    const error = err as Error
    res.status(500).json({ success: false, message: error.message })
  }
}

// POST /api/auth/send-otp
export const sendOtp = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000) // 10 min

    await User.findByIdAndUpdate(req.user!.id, { otp, otpExpiry })

    await sendOtpEmail(req.user!.email, otp)

    res.json({ success: true, message: 'OTP sent' })
  } catch (err) {
    const error = err as Error
    res.status(500).json({ success: false, message: error.message })
  }
}

// POST /api/auth/verify-otp
export const verifyOtp = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { otp } = req.body as { otp: string }
    const user = await User.findById(req.user!.id)
    if (!user || user.otp !== otp || !user.otpExpiry || user.otpExpiry < new Date()) {
      res.status(400).json({ success: false, message: 'Invalid or expired OTP' })
      return
    }

    user.isVerified = true
    user.otp = undefined
    user.otpExpiry = undefined
    await user.save()

    res.json({ success: true, message: 'Account verified' })
  } catch (err) {
    const error = err as Error
    res.status(500).json({ success: false, message: error.message })
  }
}
