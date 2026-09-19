/**
 * Remove the demo dataset — dry run by default:
 *
 *   npx ts-node src/config/purgeDemo.ts          # report only, changes nothing
 *   npx ts-node src/config/purgeDemo.ts --yes    # actually delete
 *
 * Deliberately NOT the inverse of demoSeed.ts. That script clears the decks with
 * Product.deleteMany({}), Order.deleteMany({}) and so on, which is fine before a
 * seed but catastrophic afterwards: on a live database it would take every real
 * seller's listing and every real order with it. Here nothing is deleted unless
 * it is owned by, or attached to, an @emazao.demo account.
 */
import mongoose from 'mongoose'
import * as dotenv from 'dotenv'
dotenv.config()

import User from '../models/User'
import SellerProfile from '../models/SellerProfile'
import Product from '../models/Product'
import Requirement from '../models/Requirement'
import Bid from '../models/Bid'
import Order from '../models/Order'
import Wallet from '../models/Wallet'
import Reel from '../models/Reel'
import Comment from '../models/Comment'
import Follow from '../models/Follow'
import Like from '../models/Like'
import Save from '../models/Save'
import Review from '../models/Review'
import Conversation from '../models/Conversation'
import Message from '../models/Message'
import Notification from '../models/Notification'

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/emazao'
const DEMO_EMAIL = /@emazao\.demo$/
const APPLY = process.argv.includes('--yes')

type Id = mongoose.Types.ObjectId

async function main() {
  await mongoose.connect(MONGO_URI)
  console.log(`✅ Connected: ${mongoose.connection.host}/${mongoose.connection.name}`)

  const demoUsers = await User.find({ email: DEMO_EMAIL }).select('_id email').lean()
  const userIds = demoUsers.map(u => u._id as Id)

  if (!userIds.length) {
    console.log('No @emazao.demo accounts found — nothing to purge.')
    await mongoose.disconnect()
    return
  }

  console.log(`\nFound ${userIds.length} demo account(s):`)
  for (const u of demoUsers) console.log(`   ${u.email}`)

  // Content owned by demo users. Collected first because engagement rows below
  // are matched against these ids: a real user who liked or commented on a demo
  // reel leaves a row that would otherwise dangle once the reel is gone.
  const productIds = (await Product.find({ sellerId: { $in: userIds } }).select('_id').lean()).map(d => d._id as Id)
  const reelIds = (await Reel.find({ userId: { $in: userIds } }).select('_id').lean()).map(d => d._id as Id)
  const requirementIds = (await Requirement.find({ buyerId: { $in: userIds } }).select('_id').lean()).map(d => d._id as Id)
  const conversationIds = (await Conversation.find({ participants: { $in: userIds } }).select('_id').lean()).map(d => d._id as Id)

  // Ordered so dependents go before the rows they point at, and users last.
  const plan: Array<{ label: string; model: mongoose.Model<any>; filter: Record<string, unknown> }> = [
    { label: 'Messages', model: Message, filter: { $or: [{ senderId: { $in: userIds } }, { conversationId: { $in: conversationIds } }] } },
    { label: 'Conversations', model: Conversation, filter: { _id: { $in: conversationIds } } },
    { label: 'Comments', model: Comment, filter: { $or: [{ userId: { $in: userIds } }, { reelId: { $in: reelIds } }] } },
    { label: 'Likes', model: Like, filter: { $or: [{ userId: { $in: userIds } }, { targetId: { $in: [...reelIds, ...productIds] } }] } },
    { label: 'Saves', model: Save, filter: { $or: [{ userId: { $in: userIds } }, { targetId: { $in: [...productIds, ...reelIds] } }, { productId: { $in: productIds } }] } },
    { label: 'Follows', model: Follow, filter: { $or: [{ followerId: { $in: userIds } }, { followingId: { $in: userIds } }] } },
    { label: 'Reviews', model: Review, filter: { $or: [{ authorId: { $in: userIds } }, { targetId: { $in: userIds } }] } },
    { label: 'Notifications', model: Notification, filter: { userId: { $in: userIds } } },
    { label: 'Bids', model: Bid, filter: { $or: [{ farmerId: { $in: userIds } }, { requirementId: { $in: requirementIds } }] } },
    { label: 'Requirements', model: Requirement, filter: { _id: { $in: requirementIds } } },
    // Either side being a demo account makes the order demo data. A real buyer's
    // order against a demo seller is not a real transaction worth keeping.
    { label: 'Orders', model: Order, filter: { $or: [{ buyerId: { $in: userIds } }, { sellerId: { $in: userIds } }] } },
    { label: 'Reels', model: Reel, filter: { _id: { $in: reelIds } } },
    { label: 'Products', model: Product, filter: { _id: { $in: productIds } } },
    { label: 'Wallets', model: Wallet, filter: { userId: { $in: userIds } } },
    { label: 'Seller profiles', model: SellerProfile, filter: { userId: { $in: userIds } } },
    { label: 'Users', model: User, filter: { _id: { $in: userIds } } },
  ]

  console.log(`\n${APPLY ? 'Deleting' : 'Would delete'}:`)
  let total = 0
  for (const step of plan) {
    const n = APPLY
      ? (await step.model.deleteMany(step.filter)).deletedCount ?? 0
      : await step.model.countDocuments(step.filter)
    total += n
    if (n) console.log(`   ${String(n).padStart(6)}  ${step.label}`)
  }

  console.log(`\n${APPLY ? 'Deleted' : 'Would delete'} ${total} document(s) in total.`)
  if (!APPLY) console.log('Dry run — nothing was changed. Re-run with --yes to apply.')

  // Categories are intentionally left alone: seedCategories() recreates them on
  // every boot and real listings reference them.
  await mongoose.disconnect()
}

main().catch(err => { console.error('❌ Purge error:', err); process.exit(1) })
