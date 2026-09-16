/**
 * Give every existing account a customer ID.
 *
 *   npx ts-node src/config/backfillCustomerIds.ts          # report only
 *   npx ts-node src/config/backfillCustomerIds.ts --yes    # assign them
 *
 * New signups get one automatically; accounts created before the field existed
 * do not, and a support reference that only some customers have is not usable
 * as a reference. Assigned in signup order so the numbering follows the order
 * people actually joined.
 */
import mongoose from 'mongoose'
import * as dotenv from 'dotenv'
dotenv.config()

import User from '../models/User'

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/emazao'
const APPLY = process.argv.includes('--yes')

async function main() {
  await mongoose.connect(MONGO_URI)
  console.log(`✅ Connected: ${mongoose.connection.host}/${mongoose.connection.name}`)

  const missing = await User.find({ $or: [{ customerId: { $exists: false } }, { customerId: null }] })
    .select('name email createdAt')
    .sort({ createdAt: 1 })
    .lean()

  if (!missing.length) {
    console.log('Every account already has a customer ID.')
    await mongoose.disconnect()
    return
  }

  // Continue from the highest existing number rather than from zero, so a
  // partially-run backfill never issues a duplicate.
  const last = await User.findOne({ customerId: { $exists: true, $ne: null } })
    .sort({ customerId: -1 })
    .select('customerId')
    .lean()
  let next = last?.customerId ? parseInt(String(last.customerId).replace(/\D/g, ''), 10) || 0 : 0

  console.log(`\n${APPLY ? 'Assigning' : 'Would assign'} IDs to ${missing.length} account(s), continuing from ${next}:`)
  for (const u of missing) {
    next += 1
    const id = `EMZ-${String(next).padStart(6, '0')}`
    console.log(`   ${id}  ${u.email}`)
    if (APPLY) await User.updateOne({ _id: u._id }, { customerId: id })
  }

  console.log(`\n${APPLY ? 'Done.' : 'Dry run — nothing was changed. Re-run with --yes to apply.'}`)
  await mongoose.disconnect()
}

main().catch(err => { console.error('❌ backfill failed:', err); process.exit(1) })
