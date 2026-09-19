/**
 * Everything the demo dataset owns, found through its accounts.
 *
 * Demo data is exactly: the @emazao.demo accounts, and anything they created
 * or that only exists because of them. Nothing else is ever matched, so a
 * real user's account, listings, orders, messages and money are untouchable
 * here. Used both to remove the demo set and to clear the old one before
 * seeding a fresh copy.
 */
import mongoose from 'mongoose'

import User from '../models/User'
import SellerProfile from '../models/SellerProfile'
import Product from '../models/Product'
import Requirement from '../models/Requirement'
import Bid from '../models/Bid'
import Order from '../models/Order'
import Escrow from '../models/Escrow'
import Dispute from '../models/Dispute'
import Wallet from '../models/Wallet'
import Cart from '../models/Cart'
import Checkout from '../models/Checkout'
import Reel from '../models/Reel'
import Comment from '../models/Comment'
import Follow from '../models/Follow'
import Like from '../models/Like'
import Save from '../models/Save'
import Review from '../models/Review'
import Story from '../models/Story'
import StoryView from '../models/StoryView'
import Conversation from '../models/Conversation'
import Message from '../models/Message'
import Notification from '../models/Notification'
import LiveSession from '../models/LiveSession'
import Feedback from '../models/Feedback'
import CreatorScore from '../models/CreatorScore'
import ContentStats from '../models/ContentStats'
import InteractionEvent from '../models/InteractionEvent'
import FeedImpression from '../models/FeedImpression'
import UserInterest from '../models/UserInterest'
import RiskFlag from '../models/RiskFlag'
import VerificationProfile from '../models/VerificationProfile'
import AccountFingerprint from '../models/AccountFingerprint'
import LivenessChallenge from '../models/LivenessChallenge'

export const DEMO_EMAIL = /@emazao\.demo$/
type Id = mongoose.Types.ObjectId

export interface PurgeResult { accounts: string[]; counts: Array<{ label: string; n: number }>; total: number }

export async function purgeDemoData({ apply }: { apply: boolean }): Promise<PurgeResult> {
  const demoUsers = await User.find({ email: DEMO_EMAIL }).select('_id email').lean()
  const userIds = demoUsers.map(u => u._id as Id)
  if (!userIds.length) return { accounts: [], counts: [], total: 0 }

  // Content owned by demo users, collected first: a real user who liked,
  // saved or commented on demo content leaves rows that would dangle once the
  // content is gone, so those rows go too (the real user's account does not).
  const ids = async (model: mongoose.Model<any>, filter: object) =>
    (await model.find(filter).select('_id').lean()).map(d => d._id as Id)
  const productIds = await ids(Product, { sellerId: { $in: userIds } })
  const reelIds = await ids(Reel, { userId: { $in: userIds } })
  const storyIds = await ids(Story, { userId: { $in: userIds } })
  const requirementIds = await ids(Requirement, { buyerId: { $in: userIds } })
  const conversationIds = await ids(Conversation, { participants: { $in: userIds } })
  // Either side being a demo account makes an order demo data.
  const orderIds = await ids(Order, { $or: [{ buyerId: { $in: userIds } }, { sellerId: { $in: userIds } }] })
  const contentIds = [...productIds, ...reelIds]

  // Dependents before the rows they point at; users last.
  const plan: Array<{ label: string; model: mongoose.Model<any>; filter: Record<string, unknown> }> = [
    { label: 'Messages', model: Message, filter: { $or: [{ senderId: { $in: userIds } }, { conversationId: { $in: conversationIds } }] } },
    { label: 'Conversations', model: Conversation, filter: { _id: { $in: conversationIds } } },
    { label: 'Story views', model: StoryView, filter: { $or: [{ viewerId: { $in: userIds } }, { storyId: { $in: storyIds } }] } },
    { label: 'Stories', model: Story, filter: { _id: { $in: storyIds } } },
    { label: 'Comments', model: Comment, filter: { $or: [{ userId: { $in: userIds } }, { reelId: { $in: reelIds } }] } },
    { label: 'Likes', model: Like, filter: { $or: [{ userId: { $in: userIds } }, { targetId: { $in: contentIds } }] } },
    { label: 'Saves', model: Save, filter: { $or: [{ userId: { $in: userIds } }, { targetId: { $in: contentIds } }, { productId: { $in: productIds } }] } },
    { label: 'Follows', model: Follow, filter: { $or: [{ followerId: { $in: userIds } }, { followingId: { $in: userIds } }] } },
    { label: 'Reviews', model: Review, filter: { $or: [{ authorId: { $in: userIds } }, { targetId: { $in: userIds } }] } },
    { label: 'Notifications', model: Notification, filter: { userId: { $in: userIds } } },
    { label: 'Bids', model: Bid, filter: { $or: [{ farmerId: { $in: userIds } }, { requirementId: { $in: requirementIds } }] } },
    { label: 'Requirements', model: Requirement, filter: { _id: { $in: requirementIds } } },
    { label: 'Disputes', model: Dispute, filter: { orderId: { $in: orderIds } } },
    { label: 'Escrows', model: Escrow, filter: { orderId: { $in: orderIds } } },
    { label: 'Orders', model: Order, filter: { _id: { $in: orderIds } } },
    { label: 'Checkouts', model: Checkout, filter: { buyerId: { $in: userIds } } },
    // A real shopper's cart keeps its real items; only demo products leave it.
    { label: 'Carts', model: Cart, filter: { userId: { $in: userIds } } },
    { label: 'Live sessions', model: LiveSession, filter: { broadcasterId: { $in: userIds } } },
    { label: 'Feed signals', model: InteractionEvent, filter: { $or: [{ userId: { $in: userIds } }, { contentId: { $in: contentIds } }] } },
    { label: 'Feed impressions', model: FeedImpression, filter: { $or: [{ userId: { $in: userIds } }, { contentId: { $in: contentIds } }] } },
    { label: 'Content stats', model: ContentStats, filter: { $or: [{ creatorId: { $in: userIds } }, { contentId: { $in: contentIds } }] } },
    { label: 'Creator scores', model: CreatorScore, filter: { creatorId: { $in: userIds } } },
    { label: 'Interests', model: UserInterest, filter: { userId: { $in: userIds } } },
    { label: 'Feedback', model: Feedback, filter: { userId: { $in: userIds } } },
    { label: 'Risk flags', model: RiskFlag, filter: { userId: { $in: userIds } } },
    { label: 'Verification', model: VerificationProfile, filter: { userId: { $in: userIds } } },
    { label: 'Liveness checks', model: LivenessChallenge, filter: { userId: { $in: userIds } } },
    { label: 'Device fingerprints', model: AccountFingerprint, filter: { userId: { $in: userIds } } },
    { label: 'Reels', model: Reel, filter: { _id: { $in: reelIds } } },
    { label: 'Products', model: Product, filter: { _id: { $in: productIds } } },
    { label: 'Wallets', model: Wallet, filter: { userId: { $in: userIds } } },
    { label: 'Seller profiles', model: SellerProfile, filter: { userId: { $in: userIds } } },
    { label: 'Users', model: User, filter: { _id: { $in: userIds } } },
  ]

  const counts: PurgeResult['counts'] = []
  let total = 0
  for (const step of plan) {
    const n = apply
      ? (await step.model.deleteMany(step.filter)).deletedCount ?? 0
      : await step.model.countDocuments(step.filter)
    if (n) counts.push({ label: step.label, n })
    total += n
  }
  // Demo products that a real buyer had in their cart come out of it.
  if (apply && productIds.length) {
    await Cart.updateMany({ 'items.productId': { $in: productIds } }, { $pull: { items: { productId: { $in: productIds } } } })
  }
  return { accounts: demoUsers.map(u => u.email as string), counts, total }
}
