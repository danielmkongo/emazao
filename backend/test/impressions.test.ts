import { describe, it, expect } from 'vitest'
import mongoose from 'mongoose'
import ContentStats from '../src/models/ContentStats'
import FeedImpression from '../src/models/FeedImpression'
import InteractionEvent from '../src/models/InteractionEvent'
import { queueImpressions, flushImpressions } from '../src/services/recommendation/signals'

const id = () => new mongoose.Types.ObjectId().toString()

describe('batched feed impressions', () => {
  it('records the same rows the per-request version did, in one flush', async () => {
    const reel = id(), product = id(), creator = id()
    const alice = id(), bob = id()

    queueImpressions(alice, [
      { contentId: reel, contentType: 'REEL', creatorId: creator },
      { contentId: product, contentType: 'PRODUCT', creatorId: creator },
    ])
    queueImpressions(bob, [{ contentId: reel, contentType: 'REEL', creatorId: creator }])
    // Alice sees the reel again: a second event, but still one "seen" row.
    queueImpressions(alice, [{ contentId: reel, contentType: 'REEL', creatorId: creator }])
    await flushImpressions()

    // One "seen" row per (viewer, item).
    expect(await FeedImpression.countDocuments({ contentId: reel })).toBe(2)
    expect(await FeedImpression.countDocuments({ userId: alice })).toBe(2)
    // Every showing is an event.
    expect(await InteractionEvent.countDocuments({ event: 'impression' })).toBe(4)
    // Counters add up across viewers, in a single stats row per item.
    const stats = await ContentStats.findOne({ contentId: reel }).lean()
    expect(stats?.impressions).toBe(3)
    expect((stats as any)?.window?.impressions).toBe(3)
    expect(await ContentStats.countDocuments({ contentId: reel })).toBe(1)
    expect((await ContentStats.findOne({ contentId: product }).lean())?.impressions).toBe(1)
  })

  it('adds to existing counters rather than replacing them', async () => {
    const reel = id()
    await ContentStats.create({ contentId: reel, contentType: 'REEL', creatorId: id(), contentCreatedAt: new Date(), impressions: 10 })
    queueImpressions(id(), [{ contentId: reel, contentType: 'REEL' }])
    await flushImpressions()
    expect((await ContentStats.findOne({ contentId: reel }).lean())?.impressions).toBe(11)
  })

  it('does nothing when there is nothing to write', async () => {
    await flushImpressions()
    expect(await InteractionEvent.countDocuments()).toBe(0)
  })
})
