import crypto from 'crypto'
import { env } from '../../config/env'
import type {
  PaymentProvider, CollectionRequest, CollectionResult,
  PayoutRequest, PayoutResult, WebhookEvent, CollectionStatus, PayoutStatus,
} from './types'

const BASE_URL = 'https://api.clickpesa.com/third-parties'

// ClickPesa's USSD-push collection endpoint accepts TZS only. Guarding here means
// a mis-priced order fails with a readable message instead of a provider 4xx.
const SUPPORTED_CURRENCIES = ['TZS'] as const

/**
 * Recursively sort object keys so a payload always serialises identically
 * regardless of the order we happened to build it in. ClickPesa hashes the
 * canonical form, so this must match their implementation exactly.
 */
function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(canonicalize)
  return Object.keys(value as Record<string, unknown>)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = canonicalize((value as Record<string, unknown>)[key])
      return acc
    }, {})
}

/**
 * HMAC-SHA256 over the canonical JSON. `checksum` and `checksumMethod` are
 * excluded — including them would make the hash depend on itself and never verify.
 */
function computeChecksum(key: string, payload: Record<string, unknown>): string {
  const { checksum: _c, checksumMethod: _m, ...rest } = payload
  return crypto
    .createHmac('sha256', key)
    .update(JSON.stringify(canonicalize(rest)))
    .digest('hex')
}

/** Digits only, no leading '+' — ClickPesa rejects anything else. */
function normalisePhone(raw: string): string {
  const digits = String(raw).replace(/\D/g, '')
  // Local Tanzanian format (0712…) → international (255712…)
  if (digits.startsWith('0')) return `255${digits.slice(1)}`
  return digits
}

class ClickPesaProvider implements PaymentProvider {
  readonly name = 'clickpesa'
  readonly supportedCurrencies = SUPPORTED_CURRENCIES

  // Tokens last an hour. Cache and refresh a minute early rather than paying a
  // round-trip on every single call.
  private token: string | null = null
  private tokenExpiresAt = 0

  private async getToken(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpiresAt) return this.token

    const res = await fetch(`${BASE_URL}/generate-token`, {
      method: 'POST',
      headers: {
        'client-id': env.CLICKPESA_CLIENT_ID,
        'api-key': env.CLICKPESA_API_KEY,
      },
    })

    if (!res.ok) {
      throw new Error(`ClickPesa auth failed (${res.status}). Check CLICKPESA_CLIENT_ID / CLICKPESA_API_KEY.`)
    }

    const body = (await res.json()) as { success?: boolean; token?: string }
    if (!body.token) throw new Error('ClickPesa auth returned no token')

    // The API already prefixes the value with "Bearer ".
    this.token = body.token.startsWith('Bearer ') ? body.token : `Bearer ${body.token}`
    this.tokenExpiresAt = Date.now() + 59 * 60 * 1000
    return this.token
  }

  private async request<T>(path: string, payload: Record<string, unknown>): Promise<T> {
    const signed = env.CLICKPESA_CHECKSUM_KEY
      ? { ...payload, checksum: computeChecksum(env.CLICKPESA_CHECKSUM_KEY, payload) }
      : payload

    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        Authorization: await this.getToken(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(signed),
    })

    const text = await res.text()
    if (!res.ok) {
      // Surface the provider's own message — its validation errors (bad number,
      // insufficient float, duplicate reference) are the useful ones.
      throw new Error(`ClickPesa ${path} failed (${res.status}): ${text.slice(0, 300)}`)
    }
    return JSON.parse(text) as T
  }

  async initiateCollection(req: CollectionRequest): Promise<CollectionResult> {
    if (!this.supportedCurrencies.includes(req.currency as 'TZS')) {
      throw new Error(`ClickPesa collects in ${this.supportedCurrencies.join(', ')} only — order is in ${req.currency}`)
    }

    const data = await this.request<{ id: string; status: CollectionStatus; channel?: string }>(
      '/payments/initiate-ussd-push-request',
      {
        amount: String(req.amount),
        currency: req.currency,
        orderReference: req.orderReference,
        phoneNumber: normalisePhone(req.phoneNumber),
      },
    )

    return { providerRef: data.id, status: data.status, channel: data.channel }
  }

  async createPayout(req: PayoutRequest): Promise<PayoutResult> {
    const data = await this.request<{
      id: string
      status: PayoutStatus
      fee?: string
      beneficiary?: { accountName?: string; accountNumber?: string }
    }>('/payouts/create-mobile-money-payout', {
      amount: req.amount,
      currency: req.currency,
      orderReference: req.orderReference,
      phoneNumber: normalisePhone(req.phoneNumber),
    })

    return {
      providerRef: data.id,
      status: data.status,
      fee: data.fee !== undefined ? Number(data.fee) : undefined,
      beneficiaryName: data.beneficiary?.accountName,
    }
  }

  verifyAndParseWebhook(body: unknown): WebhookEvent | null {
    if (!body || typeof body !== 'object') return null
    const payload = body as { event?: string; data?: Record<string, unknown>; checksum?: string }

    // When a checksum key is configured, an unsigned or mis-signed callback is
    // rejected outright — otherwise anyone who learns the URL could mark orders
    // paid. timingSafeEqual to avoid leaking the expected value byte by byte.
    if (env.CLICKPESA_CHECKSUM_KEY) {
      const received = payload.checksum
      if (!received) return null
      const expected = computeChecksum(env.CLICKPESA_CHECKSUM_KEY, payload as Record<string, unknown>)
      const a = Buffer.from(received)
      const b = Buffer.from(expected)
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
    }

    const data = payload.data ?? {}
    const orderReference = String(data['orderReference'] ?? '')
    const providerRef = String(data['id'] ?? '')
    // "PAYMENT RECEIVED", "payment_received" and "PAYMENT.RECEIVED" all normalise alike.
    const event = String(payload.event ?? '').toUpperCase().replace(/[\s.-]+/g, '_')

    if (!orderReference) return { kind: 'UNKNOWN' }

    switch (event) {
      case 'PAYMENT_RECEIVED':
        return {
          kind: 'COLLECTION_SUCCEEDED',
          orderReference,
          providerRef,
          amount: Number(data['collectedAmount'] ?? data['amount'] ?? 0),
          currency: String(data['collectedCurrency'] ?? data['currency'] ?? ''),
        }
      case 'PAYMENT_FAILED':
        return { kind: 'COLLECTION_FAILED', orderReference, providerRef }
      case 'PAYOUT_INITIATED':
        return { kind: 'PAYOUT_SUCCEEDED', orderReference, providerRef }
      case 'PAYOUT_REVERSED':
      case 'PAYOUT_REFUNDED':
        return { kind: 'PAYOUT_REVERSED', orderReference, providerRef }
      default:
        return { kind: 'UNKNOWN' }
    }
  }
}

export default new ClickPesaProvider()
