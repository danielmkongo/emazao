import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import Feedback from '../models/Feedback'
import { recordAudit } from '../services/audit.service'

const CATEGORIES = ['BUG', 'SUGGESTION', 'COMPLAINT', 'PRAISE', 'OTHER']

/**
 * POST /api/feedback — anyone can tell us something.
 *
 * Deliberately open to signed-out visitors: someone who cannot complete signup
 * is exactly the person whose report is most worth having, and requiring an
 * account would filter out the feedback that matters most.
 */
export const submitFeedback = async (req: AuthRequest, res: Response) => {
  try {
    const { category, message, rating, page, name, email } = req.body as {
      category?: string; message?: string; rating?: number; page?: string; name?: string; email?: string
    }

    if (!message?.trim()) {
      return res.status(400).json({ success: false, message: 'Please write your message' })
    }
    if (message.trim().length > 4000) {
      return res.status(400).json({ success: false, message: 'Message is too long (4000 characters maximum)' })
    }
    if (category && !CATEGORIES.includes(category)) {
      return res.status(400).json({ success: false, message: 'Unknown category' })
    }

    const entry = await Feedback.create({
      userId: req.user?.id,
      // Fall back to what a signed-out visitor typed, so there is some way to
      // reply to them.
      name: req.user ? undefined : name?.trim(),
      email: req.user?.email ?? email?.trim(),
      category: (category ?? 'SUGGESTION') as 'BUG' | 'SUGGESTION' | 'COMPLAINT' | 'PRAISE' | 'OTHER',
      message: message.trim(),
      rating: rating && rating >= 1 && rating <= 5 ? rating : undefined,
      page: page?.trim().slice(0, 200),
    })

    res.status(201).json({ success: true, data: { _id: entry._id } })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

/** GET /api/feedback — admin inbox. */
export const listFeedback = async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query['page'] ?? '1')) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query['limit'] ?? '25')) || 25))
    const { status, category } = req.query as Record<string, string | undefined>

    const filter: Record<string, unknown> = {}
    if (status && status !== 'ALL') filter['status'] = status
    if (category && category !== 'ALL') filter['category'] = category

    const [rows, total, byStatus] = await Promise.all([
      Feedback.find(filter)
        .populate('userId', 'name email username customerId')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Feedback.countDocuments(filter),
      Feedback.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    ])

    res.json({
      success: true,
      data: {
        rows, total, page, pages: Math.ceil(total / limit),
        counts: Object.fromEntries(byStatus.map(s => [s._id, s.count])),
      },
    })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

/** PUT /api/feedback/:id — triage. */
export const updateFeedback = async (req: AuthRequest, res: Response) => {
  try {
    const { status, adminNote } = req.body as { status?: string; adminNote?: string }
    const ALLOWED = ['NEW', 'REVIEWING', 'RESOLVED', 'DISMISSED']
    if (status && !ALLOWED.includes(status)) {
      return res.status(400).json({ success: false, message: 'Unknown status' })
    }

    const entry = await Feedback.findById(req.params['id'])
    if (!entry) return res.status(404).json({ success: false, message: 'Feedback not found' })

    if (status) entry.status = status as typeof entry.status
    if (adminNote !== undefined) entry.adminNote = adminNote.trim()
    entry.handledBy = req.user!.id as any
    await entry.save()

    await recordAudit(req, {
      action: 'FEEDBACK_TRIAGE',
      targetType: 'Feedback',
      targetId: String(entry._id),
      summary: `Marked feedback ${status ?? entry.status}${adminNote ? ' with a note' : ''}`,
    })

    res.json({ success: true, data: entry })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}
