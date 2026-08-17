import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { formatDistanceToNow, format } from 'date-fns'

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))

/** Platform default. ClickPesa collects in TZS only, so everything is denominated in it. */
export const DEFAULT_CURRENCY = 'TZS'

/**
 * Zero-decimal currencies. The Tanzanian shilling has a nominal 100-senti
 * subunit, but senti are long out of circulation and no one quotes them —
 * "TSh 19,500.00" reads as a mistake to a Tanzanian buyer.
 */
const ZERO_DECIMAL = new Set(['TZS', 'UGX', 'RWF', 'KES'])

export const formatCurrency = (amount: number, currency = DEFAULT_CURRENCY): string => {
  const zeroDecimal = ZERO_DECIMAL.has(currency)
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency,
    // Never compact: prices in TZS run to five or six digits, and "TSh 20K" on a
    // listing hides the difference between 19,500 and 24,400. Money the user is
    // about to pay is always shown in full.
    minimumFractionDigits: zeroDecimal ? 0 : 2,
    maximumFractionDigits: zeroDecimal ? 0 : 2,
  }).format(amount)
}

/** Compact form for dashboard tiles and charts, where the exact figure isn't the point. */
export const formatCurrencyCompact = (amount: number, currency = DEFAULT_CURRENCY): string =>
  new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount)

export const formatNumber = (n: number): string => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toString()
}

export const timeAgo = (date: string | Date): string =>
  formatDistanceToNow(new Date(date), { addSuffix: true })

export const formatDate = (date: string | Date, fmt = 'MMM d, yyyy'): string =>
  format(new Date(date), fmt)

export const slugify = (str: string): string =>
  str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

export const truncate = (str: string, n: number): string =>
  str.length > n ? str.slice(0, n - 3) + '...' : str

/**
 * Human label for a User.verifiedType enum value.
 *
 * These were rendered raw, so profiles displayed a literal "FARM_VERIFIED" badge.
 * The wording is also deliberately specific: "Verified" alone implies more than
 * was actually checked, and the badge sits next to a farmer's name where buyers
 * read it as a guarantee.
 */
export const VERIFIED_TYPE_LABELS: Record<string, string> = {
  ID_VERIFIED: 'ID verified',
  FARM_VERIFIED: 'Farm verified',
  BUSINESS_VERIFIED: 'Business verified',
}

export const verifiedLabel = (type?: string | null): string =>
  (type && VERIFIED_TYPE_LABELS[type]) ||
  // Unknown/legacy values become a readable phrase rather than SHOUTING_SNAKE_CASE.
  (type ? type.toLowerCase().replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase()) : 'Verified')
