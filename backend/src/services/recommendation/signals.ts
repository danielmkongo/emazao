import mongoose from 'mongoose'
import InteractionEvent, { ContentType, EventType, EventSource } from '../../models/InteractionEvent'
import ContentStats from '../../models/ContentStats'
import UserInterest from '../../models/UserInterest'

/**
 * Signal ingestion — the write side of the recommendation engine.
 *
 * recordInteraction() is intentionally cheap (a few upserts) and is called
 * fire-and-forget from hot paths. At scale this push moves behind a queue
 * (BullMQ/Kafka) and these upserts become a batched consumer — the function
 * signature stays identical.
 */

export interface InteractionInput {
  userId: string
  contentId: string
  contentType: ContentType
  creatorId?: string
  event: EventType
  watchMs?: number
  pctWatched?: number
  source?: EventSource
  sessionId?: string
}

// How much each signal contributes to a user's interest affinity & content engagement.
// Negative signals (skip) actively push interest DOWN.
const SIGNAL_WEIGHT: Record<EventType, number> = {
  impression: 0, view_start: 0.5, watch: 0, complete: 5, rewatch: 4,
  like: 2, unlike: -2, save: 6, unsave: -3, share: 8, comment: 4,
  skip: -3, swipe: 0.2, profile_visit: 3, follow: 10,
}

// Decay applied to interest weights per hour since last update (recency bias).
const INTEREST_DECAY_PER_HOUR = 0.995          // ~0.89/day, ~0.30/week
const LEARNING_RATE = 0.15                      // how fast new signals move affinity
const MAX_AFFINITY = 25                         // clamp so no single topic dominates

/** Maps an event to the ContentStats $inc payload (lifetime + rolling window). */
function statsInc(event: EventType, watchMs = 0): Record<string, number> {
  const inc: Record<string, number> = {}
  const bump = (k: string, v = 1) => { inc[k] = (inc[k] ?? 0) + v }
  switch (event) {
    case 'impression':  bump('impressions'); bump('window.impressions'); break
    case 'view_start':  bump('viewStarts'); break
    case 'complete':    bump('completes'); bump('window.completes'); break
    case 'rewatch':     bump('rewatches'); break
    case 'skip':        bump('skips'); break
    case 'like':        bump('likes'); break
    case 'unlike':      bump('likes', -1); break
    case 'save':        bump('saves'); bump('window.saves'); break
    case 'unsave':      bump('saves', -1); break
    case 'share':       bump('shares'); bump('window.shares'); break
    case 'comment':     bump('comments'); break
    case 'profile_visit': bump('profileVisits'); break
    case 'follow':      bump('followsGenerated'); bump('window.follows'); break
    default: break
  }
  if (watchMs > 0) bump('totalWatchMs', watchMs)
  return inc
}

/** Create the ContentStats row when content is published (cold-start at TEST stage). */
export async function initContentStats(params: {
  contentId: string
  contentType: ContentType
  creatorId: string
  topics?: string[]
  contentCreatedAt?: Date
}): Promise<void> {
  await ContentStats.findOneAndUpdate(
    { contentId: params.contentId },
    {
      $setOnInsert: {
        contentId: params.contentId,
        contentType: params.contentType,
        creatorId: params.creatorId,
        topics: params.topics ?? [],
        contentCreatedAt: params.contentCreatedAt ?? new Date(),
        stage: 'TEST',
      },
    },
    { upsert: true }
  )
}

/** Apply recency decay to an affinity map in place and return it as a plain object. */
function decayMap(map: Map<string, number> | undefined, hours: number): Record<string, number> {
  const factor = Math.pow(INTEREST_DECAY_PER_HOUR, Math.max(0, hours))
  const out: Record<string, number> = {}
  if (map) for (const [k, v] of map.entries()) {
    const decayed = v * factor
    if (decayed > 0.01) out[k] = decayed       // prune negligible weights
  }
  return out
}

async function updateUserInterest(input: InteractionInput, topics: string[]) {
  const weight = SIGNAL_WEIGHT[input.event] ?? 0
  if (weight === 0 && input.pctWatched === undefined) return

  const ui = await UserInterest.findOne({ userId: input.userId })
  const now = new Date()
  const hours = ui ? (now.getTime() - ui.lastDecayAt.getTime()) / 3_600_000 : 0

  const topicMap = decayMap(ui?.topics, hours)
  const creatorMap = decayMap(ui?.creators, hours)

  // Watch percentage is itself a graded positive signal
  const graded = weight + (input.pctWatched !== undefined ? (input.pctWatched - 0.4) * 6 : 0)
  const delta = LEARNING_RATE * graded

  for (const t of topics) {
    topicMap[t] = Math.max(-MAX_AFFINITY, Math.min(MAX_AFFINITY, (topicMap[t] ?? 0) + delta))
  }
  if (input.creatorId) {
    creatorMap[input.creatorId] = Math.max(-MAX_AFFINITY, Math.min(MAX_AFFINITY, (creatorMap[input.creatorId] ?? 0) + delta))
  }

  const watchInc = input.pctWatched !== undefined ? 1 : 0
  await UserInterest.findOneAndUpdate(
    { userId: input.userId },
    {
      $set: { topics: topicMap, creators: creatorMap, lastDecayAt: now },
      $inc: {
        events: 1,
        watchSamples: watchInc,
        // running mean of watch pct (approx): handled in $set below if sampled
      },
    },
    { upsert: true, new: true }
  )

  if (input.pctWatched !== undefined && ui) {
    const n = ui.watchSamples + 1
    const avg = (ui.avgWatchPct * ui.watchSamples + input.pctWatched) / n
    await UserInterest.updateOne({ userId: input.userId }, { $set: { avgWatchPct: avg } })
  }
}

/** Main entry point — ingest one interaction. Safe to call fire-and-forget. */
export async function recordInteraction(input: InteractionInput): Promise<void> {
  try {
    // 1) Raw event log (append-only, TTL'd)
    await InteractionEvent.create({
      userId: input.userId,
      contentId: input.contentId,
      contentType: input.contentType,
      creatorId: input.creatorId,
      event: input.event,
      watchMs: input.watchMs,
      pctWatched: input.pctWatched,
      source: input.source,
      sessionId: input.sessionId,
    })

    // 2) Roll into ContentStats; returns the doc so we can use its topics
    const inc = statsInc(input.event, input.watchMs)
    const stats = await ContentStats.findOneAndUpdate(
      { contentId: input.contentId },
      {
        $inc: inc,
        $set: { lastEventAt: new Date() },
        $setOnInsert: {
          contentId: input.contentId,
          contentType: input.contentType,
          creatorId: input.creatorId ?? new mongoose.Types.ObjectId(),
          contentCreatedAt: new Date(),
          stage: 'TEST',
        },
      },
      { upsert: true, new: true }
    )

    // 3) Update the user's evolving interest profile
    await updateUserInterest(input, stats?.topics ?? [])
  } catch {
    // Signal loss is non-fatal — never break the user action that triggered it
  }
}

/** Batch ingestion for the client event API. */
export async function recordInteractions(events: InteractionInput[]): Promise<void> {
  for (const e of events) await recordInteraction(e)
}

export { SIGNAL_WEIGHT }
