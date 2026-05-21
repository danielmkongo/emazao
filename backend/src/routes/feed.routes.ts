import { Router } from 'express'
import { Request, Response } from 'express'
import { buildFeed } from '../services/feed.service'
import { AuthRequest } from '../middleware/auth.middleware'
import { protect } from '../middleware/auth.middleware'

const router = Router()

router.get('/', async (req: Request, res: Response) => {
  try {
    const { cursor, limit } = req.query
    const userId = (req as AuthRequest).user?.id
    const feed = await buildFeed(userId, cursor as string | undefined, parseInt(limit as string) || 20)
    const nextCursor = feed.length > 0 ? feed[feed.length - 1]!.createdAt.toISOString() : null
    res.json({ success: true, data: feed, nextCursor })
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message })
  }
})

export default router
