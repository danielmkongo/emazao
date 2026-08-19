import { describe, it, expect } from 'vitest'
import mongoose from 'mongoose'
import Wallet from '../src/models/Wallet'

// Exercises the exact atomic-guard pattern requestWithdrawal relies on
// (wallet.controller.ts) — a findOneAndUpdate with the balance check baked
// into the filter, so two concurrent debits can't both pass a stale
// read-then-write check and drive the balance negative.
async function attemptDebit(userId: mongoose.Types.ObjectId, amount: number) {
  return Wallet.findOneAndUpdate(
    { userId, balance: { $gte: amount } },
    { $inc: { balance: -amount } },
    { new: true },
  )
}

describe('wallet withdrawal — concurrency safety', () => {
  it('never lets the balance go negative under concurrent withdrawals', async () => {
    const userId = new mongoose.Types.ObjectId()
    await Wallet.create({ userId, balance: 100, pendingBalance: 0, currency: 'TZS' })

    // Ten concurrent attempts to withdraw 30 each — only 3 can succeed (90 of 100).
    const results = await Promise.all(
      Array.from({ length: 10 }, () => attemptDebit(userId, 30)),
    )
    const succeeded = results.filter(r => r !== null)

    const wallet = await Wallet.findOne({ userId })
    expect(wallet!.balance).toBeGreaterThanOrEqual(0)
    expect(succeeded.length).toBeLessThanOrEqual(3)
    expect(wallet!.balance).toBe(100 - succeeded.length * 30)
  })

  it('rejects a withdrawal larger than the current balance', async () => {
    const userId = new mongoose.Types.ObjectId()
    await Wallet.create({ userId, balance: 10, pendingBalance: 0, currency: 'TZS' })

    const result = await attemptDebit(userId, 50)

    expect(result).toBeNull()
    const wallet = await Wallet.findOne({ userId })
    expect(wallet!.balance).toBe(10)
  })
})
