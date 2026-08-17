import VerificationProfile, { type VerificationTier } from '../../models/VerificationProfile'
import { hasBlockingFlags } from '../risk/rules'

/**
 * Risk-based verification tiers.
 *
 * The gate is on *money leaving the platform*, not on signing up or listing.
 * Escrow already holds every shilling until delivery is confirmed, so an
 * unverified seller can accumulate orders but cannot extract value — which is
 * the only thing a launderer actually wants. Gating at payout therefore costs
 * nothing in real risk while avoiding a signup wall that rural farmers on poor
 * connections would simply abandon.
 *
 * Limits are cumulative lifetime payout value, in the seller's wallet currency.
 */
export interface TierPolicy {
  tier: VerificationTier
  /** Cumulative payout ceiling before the next tier's requirements apply. */
  payoutCeiling: number
  label: string
  requirements: string[]
}

export const TIER_POLICIES: TierPolicy[] = [
  {
    tier: 0,
    payoutCeiling: 0,
    label: 'Unverified',
    requirements: ['Confirm your phone number'],
  },
  {
    tier: 1,
    payoutCeiling: 500_000,
    label: 'Phone verified',
    requirements: [
      'Confirm your phone number',
      'Mobile money wallet name matches your account name',
    ],
  },
  {
    tier: 2,
    payoutCeiling: 5_000_000,
    label: 'ID verified',
    requirements: [
      'National ID (NIDA) number',
      'Photo of your National ID',
      'Liveness check (selfie with actions)',
    ],
  },
  {
    tier: 3,
    payoutCeiling: Number.POSITIVE_INFINITY,
    label: 'Business verified',
    requirements: ['Business registration certificate', 'Manual review by our compliance team'],
  },
]

export function policyFor(tier: VerificationTier): TierPolicy {
  return TIER_POLICIES.find(p => p.tier === tier) ?? TIER_POLICIES[0]
}

/** The lowest tier whose ceiling covers this cumulative payout value. */
export function requiredTierFor(lifetimeValue: number): VerificationTier {
  for (const policy of TIER_POLICIES) {
    if (lifetimeValue <= policy.payoutCeiling) return policy.tier
  }
  return 3
}

export interface PayoutEligibility {
  allowed: boolean
  reason?: string
  currentTier: VerificationTier
  requiredTier: VerificationTier
  remainingAtThisTier: number
}

/**
 * Single decision point for "may this seller take money out right now".
 * Called by the withdrawal endpoint — never bypass it.
 */
export async function checkPayoutEligibility(
  userId: string,
  amount: number,
): Promise<PayoutEligibility> {
  const profile = await VerificationProfile.findOne({ userId }).lean()
  const currentTier = (profile?.tier ?? 0) as VerificationTier
  const lifetime = profile?.lifetimePayoutValue ?? 0
  const projected = lifetime + amount
  const requiredTier = requiredTierFor(projected)
  const ceiling = policyFor(currentTier).payoutCeiling
  const remaining = Math.max(0, ceiling - lifetime)

  const base = { currentTier, requiredTier, remainingAtThisTier: remaining }

  if (profile?.status === 'SUSPENDED' || profile?.status === 'REJECTED') {
    return { ...base, allowed: false, reason: 'Your account is under review. Please contact support.' }
  }

  // An open flag that blocks payout freezes withdrawals regardless of tier —
  // this is what stops a fully verified launderer, which tiers alone never would.
  if (await hasBlockingFlags(userId)) {
    return {
      ...base,
      allowed: false,
      reason: 'Withdrawals are temporarily on hold while we review recent activity on your account.',
    }
  }

  // Bootstrap exception. Tier 0's ceiling is 0, and Tier 1 is only ever granted
  // *inside* a successful payout once the destination wallet's registered name is
  // known (see recordPayoutIdentity). Enforcing the ceiling before that first
  // payout ever runs would mean no seller could ever withdraw anything — Tier 1
  // could never be reached because reaching it requires a payout the gate itself
  // forbids. So a seller's very first attempt is let through, capped at Tier 1's
  // ceiling, purely to observe the wallet identity signal; every attempt after
  // that is judged by the tier it actually earned.
  const neverPaidOut = !profile?.payoutPhone
  if (currentTier === 0 && neverPaidOut) {
    const bootstrapCeiling = policyFor(1).payoutCeiling
    if (amount > bootstrapCeiling) {
      return {
        ...base,
        allowed: false,
        reason: `Your first withdrawal is limited to ${bootstrapCeiling.toLocaleString()} while we confirm your mobile money wallet.`,
      }
    }
    return { ...base, allowed: true }
  }

  if (currentTier < requiredTier) {
    return {
      ...base,
      allowed: false,
      reason:
        remaining > 0
          ? `This withdrawal would take you past your ${ceiling.toLocaleString()} limit. You can withdraw up to ${remaining.toLocaleString()} now, or verify to raise the limit.`
          : `You've reached the ${ceiling.toLocaleString()} limit for ${policyFor(currentTier).label.toLowerCase()} accounts. Verify to continue.`,
    }
  }

  return { ...base, allowed: true }
}
