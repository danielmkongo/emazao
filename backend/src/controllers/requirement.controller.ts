import { Request, Response } from 'express'
import Requirement from '../models/Requirement'
import Bid from '../models/Bid'
import User from '../models/User'
import { AuthRequest } from '../middleware/auth.middleware'

// GET /api/requirements
export const getRequirements = async (req: Request, res: Response): Promise<void> => {
  try {
    const { location, productType, minBudget, maxBudget, urgent, page = '1', limit = '20' } = req.query
    const filter: Record<string, unknown> = { status: 'OPEN' }
    if (location) filter['deliveryLocation'] = new RegExp(location as string, 'i')
    if (productType) filter['productType'] = new RegExp(productType as string, 'i')
    if (urgent === 'true') filter['isUrgent'] = true
    if (minBudget) filter['budgetMax'] = { $gte: parseFloat(minBudget as string) }
    if (maxBudget) filter['budgetMin'] = { $lte: parseFloat(maxBudget as string) }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string)
    const [requirements, total] = await Promise.all([
      Requirement.find(filter)
        .populate('buyerId', 'name username avatar isVerified accountType')
        .sort({ isUrgent: -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit as string)),
      Requirement.countDocuments(filter),
    ])
    res.json({ success: true, data: requirements, pagination: { page: parseInt(page as string), total } })
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message })
  }
}

// POST /api/requirements
export const createRequirement = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const body = req.body as {
      title: string; description: string; productType: string; quantityAmount: number; quantityUnit: string
      deliveryLocation: string; deliveryFrequency?: string; budgetMin?: number; budgetMax?: number
      budgetCurrency?: string; preferredQuality?: string; deadline?: string; isUrgent?: boolean
      images?: string[]; videoUrl?: string
    }

    const requirement = await Requirement.create({
      ...body,
      buyerId: req.user!.id,
      deadline: body.deadline ? new Date(body.deadline) : undefined,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    })
    res.status(201).json({ success: true, data: requirement })
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message })
  }
}

// GET /api/requirements/:id  — with ranked bids
export const getRequirement = async (req: Request, res: Response): Promise<void> => {
  try {
    const requirement = await Requirement.findById(req.params['id'])
      .populate('buyerId', 'name username avatar isVerified country')
    if (!requirement) { res.status(404).json({ success: false, message: 'Requirement not found' }); return }

    await Requirement.findByIdAndUpdate(requirement._id, { $inc: { viewCount: 1 } })

    const bids = await Bid.find({ requirementId: requirement._id })
      .populate('farmerId', 'name username avatar isVerified country')
      .sort({ score: -1, createdAt: 1 })

    res.json({ success: true, data: { requirement, bids } })
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message })
  }
}

// POST /api/requirements/:id/bids
export const submitBid = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const requirementId = String(req.params['id'] ?? '')
    const requirement = await Requirement.findById(requirementId)
    if (!requirement || requirement.status !== 'OPEN') {
      res.status(400).json({ success: false, message: 'Requirement not open for bids' }); return
    }

    const farmer = await User.findById(req.user!.id)
    if (!farmer || (farmer.role !== 'FARMER' && farmer.role !== 'BUSINESS_BUYER')) {
      res.status(403).json({ success: false, message: 'Only farmers can submit bids' }); return
    }

    const body = req.body as {
      pricePerUnit: number; totalPrice: number; currency?: string
      deliveryTimeline: string; deliveryNotes?: string; message: string
      certifications?: string[]; sampleAvailable?: boolean
    }

    // Compute a score (0-1) based on price fit, farmer rating, verification
    const priceScore = requirement.budgetMax
      ? Math.max(0, 1 - body.pricePerUnit / requirement.budgetMax)
      : 0.5
    const verificationScore = farmer.isVerified ? 0.3 : 0
    const score = priceScore * 0.7 + verificationScore

    const bid = await Bid.create({
      requirementId,
      farmerId: req.user!.id,
      ...body,
      score,
    })

    await Requirement.findByIdAndUpdate(requirementId, { $inc: { bidCount: 1 } })
    res.status(201).json({ success: true, data: bid })
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      res.status(409).json({ success: false, message: 'You already submitted a bid for this requirement' })
      return
    }
    res.status(500).json({ success: false, message: (err as Error).message })
  }
}

// PUT /api/requirements/bids/:bidId  — accept or reject
export const updateBidStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const bid = await Bid.findById(req.params['bidId']).populate('requirementId')
    if (!bid) { res.status(404).json({ success: false, message: 'Bid not found' }); return }

    const requirement = await Requirement.findById(bid.requirementId)
    if (!requirement || requirement.buyerId.toString() !== req.user!.id) {
      res.status(403).json({ success: false, message: 'Not authorized' }); return
    }

    const { status } = req.body as { status: 'ACCEPTED' | 'REJECTED' | 'SHORTLISTED' }
    bid.status = status
    await bid.save()

    if (status === 'ACCEPTED') {
      await Requirement.findByIdAndUpdate(requirement._id, { status: 'AWARDED' })
    }

    res.json({ success: true, data: bid })
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message })
  }
}

// GET /api/requirements/my/bids
export const getMyBids = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const bids = await Bid.find({ farmerId: req.user!.id })
      .populate('requirementId')
      .sort({ createdAt: -1 })
    res.json({ success: true, data: bids })
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message })
  }
}
