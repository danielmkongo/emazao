import { Router, Request, Response } from 'express'
import { buildFeed } from '../services/recommendation/feed'
import { AuthRequest, optionalProtect } from '../middleware/auth.middleware'

const router = Router()

// optionalProtect populates req.user when a token is present so the feed personalizes
router.get('/', optionalProtect, async (req: Request, res: Response) => {
  try {
    const { cursor, limit, sort } = req.query
    const userId = (req as AuthRequest).user?.id
    const lim = parseInt(limit as string) || 20
    const offset = parseInt(cursor as string) || 0
    const feed = await buildFeed(userId, cursor as string | undefined, lim, sort as string)
    // Offset cursor: if we filled the page there are probably more
    const nextCursor = feed.length === lim ? String(offset + lim) : null
    res.json({ success: true, data: feed, nextCursor })
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message })
  }
})

export default router
