/**
 * Create (or promote) a real admin account.
 *
 *   npx ts-node src/config/createAdmin.ts you@example.com "Your Name" 'password'
 *
 * Exists because the only admin on this platform is a demo seed account
 * (admin@emazao.demo), which purgeDemo.ts deletes — running that purge without
 * a real admin first locks you out of the admin panel entirely.
 *
 * Promotes an existing account rather than failing if the email is already
 * registered, so you can raise your own everyday login to SUPER_ADMIN instead
 * of maintaining a second one.
 */
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import * as dotenv from 'dotenv'
dotenv.config()

import User from '../models/User'

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/emazao'

const [email, name, password] = process.argv.slice(2)

function usage(msg: string): never {
  console.error(`❌ ${msg}`)
  console.error('\nUsage:')
  console.error("  npx ts-node src/config/createAdmin.ts <email> <name> <password>")
  console.error("\nExample:")
  console.error("  npx ts-node src/config/createAdmin.ts daniel@emazao.com 'Daniel Mkongo' 'a-long-passphrase'")
  process.exit(1)
}

async function main() {
  if (!email || !email.includes('@')) usage('A valid email is required.')
  if (!name) usage('A display name is required.')
  // This account can suspend sellers, resolve disputes and change commission.
  // A weak password here is the whole platform's problem, not just this user's.
  if (!password || password.length < 12) usage('Password must be at least 12 characters.')

  await mongoose.connect(MONGO_URI)
  console.log(`✅ Connected: ${mongoose.connection.host}/${mongoose.connection.name}`)

  const normalisedEmail = email.toLowerCase().trim()
  const passwordHash = await bcrypt.hash(password, 12)

  const existing = await User.findOne({ email: normalisedEmail })

  if (existing) {
    existing.role = 'SUPER_ADMIN'
    existing.passwordHash = passwordHash
    existing.isVerified = true
    existing.isSuspended = false
    await existing.save()
    console.log(`✅ Promoted existing account ${normalisedEmail} to SUPER_ADMIN (password reset).`)
  } else {
    // Username must be unique; derive one from the email and add a numeric
    // suffix rather than failing on a collision.
    const base = normalisedEmail.split('@')[0]!.replace(/[^a-z0-9_]/g, '') || 'admin'
    let username = base
    for (let i = 1; await User.exists({ username }); i++) username = `${base}${i}`

    await User.create({
      name,
      email: normalisedEmail,
      username,
      passwordHash,
      role: 'SUPER_ADMIN',
      isVerified: true,
    })
    console.log(`✅ Created SUPER_ADMIN ${normalisedEmail} (username: ${username}).`)
  }

  console.log('\nSign in at /login, then open /admin.')
  console.log('Clear this command from your shell history — it contains the password:')
  console.log('  history -d $(history 1)')

  await mongoose.disconnect()
}

main().catch(err => { console.error('❌ createAdmin failed:', err); process.exit(1) })
