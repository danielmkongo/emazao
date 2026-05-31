import RankingConfig, { IRankingConfig } from '../../models/RankingConfig'

// In-process cache so feed requests never block on a config read.
// Invalidated every CACHE_TTL or explicitly when an admin edits weights.
let cached: IRankingConfig | null = null
let cachedAt = 0
const CACHE_TTL = 60_000

export async function getRankingConfig(): Promise<IRankingConfig> {
  const now = Date.now()
  if (cached && now - cachedAt < CACHE_TTL) return cached
  let cfg = await RankingConfig.findOne({ key: 'default' })
  if (!cfg) cfg = await RankingConfig.create({ key: 'default' })   // seed defaults
  cached = cfg
  cachedAt = now
  return cfg
}

export function invalidateRankingConfig(): void {
  cached = null
  cachedAt = 0
}

/**
 * Deterministic A/B bucketing: hash userId → [0,1). Lets us route a fraction
 * of users to a variant config without per-request randomness (stable cohorts).
 */
export function abBucket(userId: string, salt = 'rank'): number {
  let h = 2166136261
  const s = userId + salt
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 10000) / 10000
}
