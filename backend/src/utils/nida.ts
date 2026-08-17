import crypto from 'crypto'

/**
 * Tanzanian NIDA numbers are 20 digits, conventionally written in four groups:
 *   YYYYMMDD-XXXXX-XXXXX-XX
 * The first eight digits are the holder's date of birth, which gives us a real
 * (if partial) consistency check without any registry access.
 *
 * IMPORTANT: nothing here proves the number was actually issued. NIDA exposes no
 * public verification API — third parties need an individual access agreement —
 * so a well-formed number is *unverified user input*, not a verified identity.
 * Treat it as a claim to be corroborated (see the payout name match), never as
 * proof on its own.
 */

export interface NidaParseResult {
  valid: boolean
  reason?: string
  /** Normalised to bare digits. */
  normalised?: string
  dateOfBirth?: Date
  age?: number
}

const MIN_AGE = 18
const MAX_AGE = 120

export function parseNida(raw: string): NidaParseResult {
  const normalised = String(raw ?? '').replace(/\D/g, '')

  if (normalised.length !== 20) {
    return { valid: false, reason: 'A NIDA number must be 20 digits' }
  }

  const year = Number(normalised.slice(0, 4))
  const month = Number(normalised.slice(4, 6))
  const day = Number(normalised.slice(6, 8))

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return { valid: false, reason: 'The first 8 digits are not a valid date of birth' }
  }

  const dateOfBirth = new Date(Date.UTC(year, month - 1, day))
  // Rejects impossible calendar dates that survive the range check above
  // (31 February rolls forward to March, so the parts stop matching).
  if (
    dateOfBirth.getUTCFullYear() !== year ||
    dateOfBirth.getUTCMonth() !== month - 1 ||
    dateOfBirth.getUTCDate() !== day
  ) {
    return { valid: false, reason: 'The first 8 digits are not a valid date of birth' }
  }

  const now = new Date()
  let age = now.getUTCFullYear() - year
  const hadBirthday =
    now.getUTCMonth() > month - 1 || (now.getUTCMonth() === month - 1 && now.getUTCDate() >= day)
  if (!hadBirthday) age -= 1

  if (age > MAX_AGE || age < 0) {
    return { valid: false, reason: 'The date of birth in this number is not plausible' }
  }
  if (age < MIN_AGE) {
    return { valid: false, reason: `Sellers must be at least ${MIN_AGE} years old` }
  }

  return { valid: true, normalised, dateOfBirth, age }
}

/**
 * We never store the NIDA number itself. A national ID is a lifelong identifier
 * that can't be reissued after a breach, and under Tanzania's Personal Data
 * Protection Act 2022 it is sensitive personal data. Storing a keyed hash still
 * lets us detect the same ID being reused across accounts — which is the only
 * thing we actually need it for — without holding the number itself.
 *
 * Keyed (HMAC) rather than plain SHA-256 because the search space is small
 * enough to brute-force: an attacker who knows a date of birth only needs to try
 * the remaining 12 digits.
 */
export function hashNida(normalised: string, key: string): string {
  return crypto.createHmac('sha256', key).update(normalised).digest('hex')
}

/** Last 4 digits, for support staff to confirm a document against without exposing the number. */
export function nidaLast4(normalised: string): string {
  return normalised.slice(-4)
}

/**
 * Loose name comparison for matching a declared name against the name registered
 * on a mobile money wallet. Real people transpose names, drop middle names, and
 * telcos store them inconsistently ("JOHN P MWANGI" vs "John Peter Mwangi"), so
 * an exact match would reject far more honest sellers than fraudsters.
 *
 * Returns the share of the shorter name's tokens found in the longer one.
 */
export function nameMatchScore(a: string, b: string): number {
  const tokens = (s: string) =>
    String(s ?? '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 1) // drop initials — they match too eagerly

  const ta = tokens(a)
  const tb = tokens(b)
  if (!ta.length || !tb.length) return 0

  const [shorter, longer] = ta.length <= tb.length ? [ta, tb] : [tb, ta]
  const longerSet = new Set(longer)
  const hits = shorter.filter(t => longerSet.has(t)).length

  return hits / shorter.length
}
