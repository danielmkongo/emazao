/**
 * Delete conversations that have fewer than two real participants.
 *
 *   npx ts-node src/config/repairConversations.ts          # report only
 *   npx ts-node src/config/repairConversations.ts --yes    # delete them
 *
 * These were created before sendMessage validated its recipient: an absent
 * recipientId arrived as null and was cast straight into the participants array,
 * so the row looked like [sender, null]. To the sender it appeared in the inbox
 * as a thread with their message in it, no name and no avatar — and no way to
 * reach anyone, because there was no second participant.
 *
 * The write path is fixed, so this only clears what was already written.
 */
import mongoose from 'mongoose'
import * as dotenv from 'dotenv'
dotenv.config()

import Conversation from '../models/Conversation'
import Message from '../models/Message'

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/emazao'
const APPLY = process.argv.includes('--yes')

async function main() {
  await mongoose.connect(MONGO_URI)
  console.log(`✅ Connected: ${mongoose.connection.host}/${mongoose.connection.name}`)

  const all = await Conversation.find().select('_id participants lastMessage').lean()

  // A null entry in the array still counts toward length, so check for real ids
  // rather than trusting participants.length.
  const broken = all.filter(c => (c.participants ?? []).filter(Boolean).length < 2)

  if (!broken.length) {
    console.log('No malformed conversations found.')
    await mongoose.disconnect()
    return
  }

  console.log(`\n${APPLY ? 'Deleting' : 'Would delete'} ${broken.length} malformed conversation(s):`)
  for (const c of broken) {
    console.log(`   ${String(c._id)}  participants=${(c.participants ?? []).map(String).join(', ')}  last=${JSON.stringify(c.lastMessage ?? '')}`)
  }

  const ids = broken.map(c => c._id)
  const orphanMessages = await Message.countDocuments({ conversationId: { $in: ids } })
  console.log(`\n${orphanMessages} message(s) belong to them and ${APPLY ? 'will be' : 'would be'} removed too.`)

  if (APPLY) {
    await Message.deleteMany({ conversationId: { $in: ids } })
    await Conversation.deleteMany({ _id: { $in: ids } })
    console.log('Done.')
  } else {
    console.log('Dry run — nothing was changed. Re-run with --yes to apply.')
  }

  await mongoose.disconnect()
}

main().catch(err => { console.error('❌ repair failed:', err); process.exit(1) })
