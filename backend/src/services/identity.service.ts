import BanEntry from '../models/BanEntry'
import User from '../models/User'

/**
 * Sequential, human-quotable account reference: EMZ-000001.
 *
 * Derived from the highest existing number rather than a document count, so
 * deleting an account never causes the next signup to reuse a retired
 * reference — two different people sharing one customer ID would quietly
 * corrupt every record that cites it.
 */
export async function nextCustomerId(): Promise<string> {
  const last = await User.findOne({ customerId: { $exists: true, $ne: null } })
    .sort({ customerId: -1 })
    .select('customerId')
    .lean()

  const lastNumber = last?.customerId ? parseInt(String(last.customerId).replace(/\D/g, ''), 10) : 0
  const next = (Number.isFinite(lastNumber) ? lastNumber : 0) + 1
  return `EMZ-${String(next).padStart(6, '0')}`
}

/**
 * Is this phone number or national ID currently banned?
 *
 * Checked at signup, because suspending an account does nothing to stop the
 * same person returning with a new email an hour later.
 */
export async function findActiveBan(params: { phone?: string; nidaHash?: string }) {
  const or: Record<string, unknown>[] = []
  if (params.phone) or.push({ phone: params.phone.trim() })
  if (params.nidaHash) or.push({ nidaHash: params.nidaHash })
  if (!or.length) return null

  // liftedAt: null covers both "never lifted" and documents written before the
  // field existed.
  return BanEntry.findOne({ $or: or, liftedAt: null }).lean()
}
