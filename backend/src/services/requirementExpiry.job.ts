import Requirement from '../models/Requirement'

const INTERVAL_MS = 15 * 60 * 1000 // 15 minutes — mirrors recommendation/jobs.ts's in-process interval pattern

async function expireOverdueRequirements(): Promise<void> {
  try {
    await Requirement.updateMany(
      { status: 'OPEN', expiresAt: { $lt: new Date() } },
      { status: 'EXPIRED' }
    )
  } catch (err) {
    console.error('[requirementExpiry] failed to expire overdue requirements', err)
  }
}

export function startRequirementExpiryJob(): void {
  void expireOverdueRequirements()
  setInterval(expireOverdueRequirements, INTERVAL_MS)
}
