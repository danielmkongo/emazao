import { Request, Response } from 'express'
import LiveSession from '../models/LiveSession'

export const getLiveSessions = async (_req: Request, res: Response): Promise<void> => {
  try {
    const sessions = await LiveSession.find()
      .populate('broadcasterId', 'name username avatar isVerified')
      .sort({ startedAt: -1 })
      .limit(20)
    res.json({ success: true, data: sessions })
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message })
  }
}
