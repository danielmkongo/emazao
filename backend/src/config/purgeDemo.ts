/**
 * Remove the demo dataset, or report what it holds.
 *
 *   npm run seed:status    # count what demo data exists, change nothing
 *   npm run seed:remove    # delete it
 *
 * Only @emazao.demo accounts and what they own are touched (see demoData.ts).
 * Real users, their listings, orders, messages and wallets are never matched.
 */
import mongoose from 'mongoose'
import * as dotenv from 'dotenv'
dotenv.config()
import { purgeDemoData } from './demoData'

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/emazao'
const APPLY = process.argv.includes('--yes')

async function main() {
  await mongoose.connect(MONGO_URI)
  console.log(`Connected: ${mongoose.connection.host}/${mongoose.connection.name}`)
  const result = await purgeDemoData({ apply: APPLY })
  if (!result.accounts.length) {
    console.log('No demo data here (no @emazao.demo accounts).')
  } else {
    console.log(`\n${result.accounts.length} demo account(s): ${result.accounts.join(', ')}`)
    console.log(`\n${APPLY ? 'Deleted' : 'Demo data present'}:`)
    for (const c of result.counts) console.log(`   ${String(c.n).padStart(6)}  ${c.label}`)
    console.log(`\n${APPLY ? 'Removed' : 'Total'} ${result.total} document(s). Real data was not touched.`)
    if (!APPLY) console.log('To remove it: npm run seed:remove')
  }
  await mongoose.disconnect()
}

main().catch(err => { console.error('Purge error:', err); process.exit(1) })
