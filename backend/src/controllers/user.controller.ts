import { Request, Response } from 'express'
import User from '../models/User'
import SellerProfile from '../models/SellerProfile'
import Follow from '../models/Follow'
import CreatorScore from '../models/CreatorScore'
import { AuthRequest } from '../middleware/auth.middleware'
import { sendNotification } from '../services/notification.service'
import slugify from 'slugify'

// GET /api/users/top-farmers — leaderboard ranked by measured credibility
export const getTopFarmers = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(parseInt(String(req.query['limit'] ?? '20')) || 20, 50)
    const scores = await CreatorScore.find()
      .sort({ credibility: -1 })
      .limit(limit)
      .populate('creatorId', 'name username avatar isVerified country bio')
      .lean()

    const data = scores
      .filter((s: any) => s.creatorId)
      .map((s: any, i: number) => ({
        rank: i + 1,
        user: s.creatorId,
        credibility: Math.round(s.credibility * 100),       // 0..100 for display
        completionRate: Math.round(s.avgCompletionRate * 100),
        engagementRate: Math.round(s.avgEngagementRate * 100),
        reach: s.totalReach,
        followsGenerated: s.followsGenerated,
        rating: s.rating,
        salesCount: s.salesCount,
      }))
    res.json({ success: true, data })
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message })
  }
}

// GET /api/users?role=FARMER|ALL&q=...&limit=20
export const listUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { role = 'FARMER', q, limit = '20' } = req.query
    const filter: Record<string, unknown> = {}
    if (role !== 'ALL') filter.role = role
    if (q) filter['$or'] = [
      { name: { $regex: q, $options: 'i' } },
      { username: { $regex: q, $options: 'i' } },
      { bio: { $regex: q, $options: 'i' } },
      { country: { $regex: q, $options: 'i' } },
    ]
    const users = await User.find(filter)
      .select('-passwordHash -refreshToken -otp -otpExpiry')
      .sort({ followersCount: -1 })
      .limit(parseInt(limit as string))
    res.json({ success: true, data: users })
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message })
  }
}

// GET /api/users/by-id/:userId
export const getUserById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.params.userId).select('name username avatar isVerified role country bio')
    if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return }
    res.json({ success: true, data: user })
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message })
  }
}

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
    const user = await User.findByIdAndUpdate(req.user!.id, updates, { returnDocument: 'after' })
      .select('-passwordHash -refreshToken -otp -otpExpiry')
    res.json({ success: true, data: user })
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message })
  }
}

// GET /api/users/:username
export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest
    const user = await User.findOne({ username: String(req.params['username'] ?? '').toLowerCase() })
      .select('-passwordHash -refreshToken -otp -otpExpiry -refreshToken')
    if (!user) { res.status(404).json({ success: false, message: 'User not found' }); return }

    let sellerProfile = null
    if (user.role === 'FARMER') {
      sellerProfile = await SellerProfile.findOne({ userId: user._id })
    }

    let isFollowing = false
    if (authReq.user?.id && authReq.user.id !== user._id.toString()) {
      isFollowing = !!(await Follow.findOne({ followerId: authReq.user.id, followingId: user._id }))
    }

    res.json({ success: true, data: { user, sellerProfile, isFollowing } })
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

      const follower = await User.findById(followerId).select('name username')
      if (follower) {
        await sendNotification({
          userId: followingId,
          type: 'FOLLOW',
          title: 'New follower',
          body: `${follower.name} started following you.`,
          link: `/profile/${follower.username}`,
        })
      }

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
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    )

    // Completing the seller profile counts as finishing onboarding
    await User.findByIdAndUpdate(req.user!.id, { role: 'FARMER', onboardingDone: true })

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
