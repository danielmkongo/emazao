import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import { recordInteractions, InteractionInput } from '../services/recommendation/signals'
import type { ContentType, EventType, EventSource } from '../models/InteractionEvent'

const VALID_EVENTS = new Set<EventType>([
  'impression', 'view_start', 'watch', 'complete', 'rewatch', 'like', 'unlike',
  'save', 'unsave', 'share', 'comment', 'skip', 'swipe', 'profile_visit', 'follow',
])
const VALID_TYPES = new Set<ContentType>(['REEL', 'PRODUCT'])

interface RawEvent {
  contentId?: string
  contentType?: ContentType
  creatorId?: string
  event?: EventType
  watchMs?: number
  pctWatched?: number
  source?: EventSource
  sessionId?: string
}

// POST /api/events  { events: [...] }  — batched client telemetry
export const ingestEvents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id
    const raw = (req.body?.events ?? []) as RawEvent[]
    if (!Array.isArray(raw) || raw.length === 0) {
      res.json({ success: true, accepted: 0 }); return
    }

    const clean: InteractionInput[] = []
    for (const e of raw.slice(0, 200)) {        // cap batch size
      if (!e.contentId || !e.event || !e.contentType) continue
      if (!VALID_EVENTS.has(e.event) || !VALID_TYPES.has(e.contentType)) continue
      clean.push({
        userId,
        contentId: e.contentId,
        contentType: e.contentType,
        creatorId: e.creatorId,
        event: e.event,
        watchMs: typeof e.watchMs === 'number' ? e.watchMs : undefined,
        pctWatched: typeof e.pctWatched === 'number' ? Math.max(0, Math.min(1, e.pctWatched)) : undefined,
        source: e.source,
        sessionId: e.sessionId,
      })
    }

    // Fire-and-forget: acknowledge fast, ingest async
    void recordInteractions(clean)
    res.json({ success: true, accepted: clean.length })
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message })
  }
}
