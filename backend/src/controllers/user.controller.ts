import { Request, Response } from 'express'
import User from '../models/User'
import SellerProfile from '../models/SellerProfile'
import Follow from '../models/Follow'
import { AuthRequest } from '../middleware/auth.middleware'
import slugify from 'slugify'

// GET /api/users/me
export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user!.id).select('-passwordHash -refreshToken -otp -otpExpiry')
    if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return }
    res.json({ success: true, data: user })
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message })
  }
}

// PUT /api/users/me
export const updateMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const allowed = ['name', 'bio', 'avatar', 'coverImage', 'location', 'country', 'region', 'currency', 'onboardingDone']
    const updates: Record<string, unknown> = {}
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key]
    }
    const user = await User.findByIdAndUpdate(req.user!.id, updates, { new: true })
      .select('-passwordHash -refreshToken -otp -otpExpiry')
    res.json({ success: true, data: user })
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message })
  }
}

// GET /api/users/:username
export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findOne({ username: String(req.params['username'] ?? '').toLowerCase() })
      .select('-passwordHash -refreshToken -otp -otpExpiry -refreshToken')
    if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return }

    let sellerProfile = null
    if (user.role === 'FARMER') {
      sellerProfile = await SellerProfile.findOne({ userId: user._id })
    }

    res.json({ success: true, data: { user, sellerProfile } })
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message })
  }
}

// POST /api/users/:userId/follow
export const toggleFollow = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const followingId = String(req.params['userId'] ?? '')
    const followerId = req.user!.id
    if (followerId === followingId) {
      res.status(400).json({ success: false, message: 'Cannot follow yourself' }); return
    }

    const exists = await Follow.findOne({ followerId, followingId })
    if (exists) {
      await Follow.deleteOne({ followerId, followingId })
      await User.findByIdAndUpdate(followerId, { $inc: { followingCount: -1 } })
      await User.findByIdAndUpdate(followingId, { $inc: { followersCount: -1 } })
      res.json({ success: true, data: { following: false } })
    } else {
      await Follow.create({ followerId, followingId })
      await User.findByIdAndUpdate(followerId, { $inc: { followingCount: 1 } })
      await User.findByIdAndUpdate(followingId, { $inc: { followersCount: 1 } })
      res.json({ success: true, data: { following: true } })
    }
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message })
  }
}

// PUT /api/users/me/seller-profile
export const upsertSellerProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { farmName, farmDescription, farmSize, farmLocation, specializations, deliveryRadius, certifications } = req.body as {
      farmName: string; farmDescription?: string; farmSize?: number; farmLocation?: string
      specializations?: string[]; deliveryRadius?: number; certifications?: string[]
    }

    const storeSlug = slugify(farmName + '-' + (req.user!.id as string).slice(-4), { lower: true, strict: true })

    const profile = await SellerProfile.findOneAndUpdate(
      { userId: req.user!.id },
      { farmName, farmDescription, farmSize, farmLocation, specializations, deliveryRadius, certifications, storeSlug },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )

    // Also update role to FARMER
    await User.findByIdAndUpdate(req.user!.id, { role: 'FARMER' })

    res.json({ success: true, data: profile })
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message })
  }
}

// GET /api/users/:username/followers
export const getFollowers = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findOne({ username: String(req.params['username'] ?? '').toLowerCase() })
    if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return }
    const follows = await Follow.find({ followingId: user._id }).populate('followerId', 'name username avatar isVerified')
    res.json({ success: true, data: follows.map(f => f.followerId) })
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message })
  }
}

// GET /api/users/:username/following
export const getFollowing = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findOne({ username: String(req.params['username'] ?? '').toLowerCase() })
    if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return }
    const follows = await Follow.find({ followerId: user._id }).populate('followingId', 'name username avatar isVerified')
    res.json({ success: true, data: follows.map(f => f.followingId) })
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message })
  }
}
