import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { formatDistanceToNow, format } from 'date-fns'

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))

export const formatCurrency = (amount: number, currency = 'USD'): string => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, notation: 'compact' }).format(amount)
}

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
