import crypto from 'crypto'
import { env } from '../../config/env'
import type {
  PaymentProvider, CollectionRequest, CollectionResult,
  PayoutRequest, PayoutResult, WebhookEvent, WebhookContext,
  CheckoutRequest, CheckoutResult, CollectionLookup, PayoutLookup,
} from './types'

/**
 * Snippe — Tanzanian PSP (https://snippe.sh), used here for Visa/Mastercard.
 *
 * Cards are the reason this exists. A card cannot be pushed to a handset the
 * way mobile money can, and accepting a card number on our own form would drag
 * eMazao inside PCI DSS scope for nothing, so the buyer is sent to Snippe's
 * hosted checkout and returns to the order page. The money still lands in the
 * platform account and is still released to the seller on delivery: escrow does
 * not care which rail brought it in.
 *
 * Snippe also does mobile money and payouts. Those stay with ClickPesa for now
 * because that integration is live and reconciled; the methods below exist so
 * the provider satisfies the same contract and could take over if you ever
 * wanted one provider for everything.
 *
 * API: 2026-01-25. Amounts are whole units of the currency (TZS has no minor
 * unit in practice), minimum 500.
 */

const MIN_AMOUNT = 500
const SUPPORTED_CURRENCIES = ['TZS'] as const
/** Snippe's own guidance: refuse anything older, so a captured call cannot be replayed. */
const REPLAY_TOLERANCE_MS = 5 * 60_000

/** Digits only, country code first — the checkout pre-fills from this. */
function normalisePhone(raw?: string): string | undefined {
  if (!raw) return undefined
  const digits = String(raw).replace(/\D/g, '')
  if (!digits) return undefined
  return digits.startsWith('0') ? `255${digits.slice(1)}` : digits
}

function headerValue(headers: WebhookContext['headers'], name: string): string | undefined {
  if (!headers) return undefined
  const v = headers[name] ?? headers[name.toLowerCase()]
  return Array.isArray(v) ? v[0] : v
}

type SnippeSession = {
  reference?: string
  checkout_url?: string
  status?: string
  expires_at?: string
  amount?: number | { value?: number; currency?: string }
  currency?: string
  metadata?: Record<string, unknown>
}

/** Snippe reports a session's life cycle; we care about the three outcomes. */
function mapStatus(status?: string): CollectionLookup['status'] {
  switch ((status ?? '').toLowerCase()) {
    case 'completed': return 'SUCCESS'
    case 'settled': return 'SETTLED'
    case 'failed':
    case 'voided':
    case 'cancelled':
    case 'expired': return 'FAILED'
    default: return 'PENDING'
  }
}

/** Amount comes back either flat or as { value, currency } depending on the shape. */
function amountOf(session: SnippeSession): { amount: number; currency: string } {
  if (session.amount && typeof session.amount === 'object') {
    return { amount: Number(session.amount.value ?? 0), currency: String(session.amount.currency ?? 'TZS') }
  }
  return { amount: Number(session.amount ?? 0), currency: String(session.currency ?? 'TZS') }
}

class SnippeProvider implements PaymentProvider {
  readonly name = 'snippe'
  readonly supportedCurrencies = SUPPORTED_CURRENCIES

  /** False when no API key is set, which is how the card option stays hidden. */
  get configured(): boolean {
    return Boolean(env.SNIPPE_API_KEY)
  }

  private async call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
    if (!this.configured) throw new Error('Snippe is not configured (SNIPPE_API_KEY is unset)')
    const res = await fetch(`${env.SNIPPE_BASE_URL}${path}`, {
      method: init.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${env.SNIPPE_API_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      ...(init.body ? { body: JSON.stringify(init.body) } : {}),
    })
    const text = await res.text()
    let parsed: any
    try { parsed = text ? JSON.parse(text) : {} } catch { parsed = { raw: text } }
    if (!res.ok) {
      // Surface Snippe's own words: "amount below minimum" is worth seeing in
      // the log, "502 Bad Gateway" is not.
      throw new Error(parsed?.message || parsed?.error || `Snippe ${res.status}`)
    }
    // Their responses are sometimes bare, sometimes wrapped in { data }.
    return (parsed?.data ?? parsed) as T
  }

  /**
   * Open a hosted checkout. Our own reference travels in metadata, because
   * that is what comes back on the webhook — the session reference is Snippe's
   * id, not ours, and the two have to be tied together to settle an order.
   */
  async createCheckout(req: CheckoutRequest): Promise<CheckoutResult> {
    const amount = Math.round(req.amount)
    if (amount < MIN_AMOUNT) {
      throw new Error(`Card payments start at ${MIN_AMOUNT} ${req.currency}`)
    }
    const phone = normalisePhone(req.customer?.phone)
    const session = await this.call<SnippeSession>('/api/v1/sessions', {
      method: 'POST',
      body: {
        amount,
        currency: req.currency,
        allowed_methods: req.methods ?? ['card'],
        description: req.description?.slice(0, 500),
        redirect_url: req.redirectUrl,
        ...(req.webhookUrl ? { webhook_url: req.webhookUrl } : {}),
        ...(req.customer ? {
          customer: {
            ...(req.customer.name ? { name: req.customer.name } : {}),
            ...(phone ? { phone } : {}),
            ...(req.customer.email ? { email: req.customer.email } : {}),
          },
        } : {}),
        metadata: { order_reference: req.orderReference },
        // A buyer who wanders off should not leave a payable page open all day
        // against an order we will expire anyway.
        expires_in: 1800,
      },
    })
    if (!session.reference || !session.checkout_url) {
      throw new Error('Snippe did not return a checkout session')
    }
    return { providerRef: session.reference, checkoutUrl: session.checkout_url, expiresAt: session.expires_at }
  }

  /** By Snippe's session reference, which is what we store against the order. */
  async queryCollectionByRef(providerRef: string): Promise<CollectionLookup | null> {
    try {
      const session = await this.call<SnippeSession>(`/api/v1/sessions/${encodeURIComponent(providerRef)}`)
      if (!session?.reference) return null
      const { amount, currency } = amountOf(session)
      return { status: mapStatus(session.status), amount, currency, providerRef: session.reference }
    } catch {
      return null
    }
  }

  /**
   * Snippe indexes sessions by its own reference, not ours, so there is no way
   * to look one up from an order reference alone. The caller holds the session
   * reference and uses queryCollectionByRef; this exists to satisfy the
   * interface and is deliberately honest about knowing nothing.
   */
  async queryCollection(): Promise<CollectionLookup | null> {
    return null
  }

  async queryPayout(): Promise<PayoutLookup | null> {
    return null
  }

  /**
   * Verify against the raw bytes, exactly as received.
   *
   * The signed string is `{timestamp}.{body}`, HMAC-SHA256, hex. Parsing the
   * JSON and re-encoding it changes key order and whitespace, and the
   * signature stops matching — so the controller keeps the original buffer and
   * hands it over here.
   */
  verifyAndParseWebhook(body: unknown, ctx?: WebhookContext): WebhookEvent | null {
    const secret = env.SNIPPE_WEBHOOK_SECRET
    const signature = headerValue(ctx?.headers, 'x-webhook-signature')
    const timestamp = headerValue(ctx?.headers, 'x-webhook-timestamp')
    if (!secret || !signature || !timestamp || !ctx?.rawBody) return null

    // Replay protection. Without it a callback captured once could be posted
    // back for ever, and each replay would look perfectly authentic.
    const sentAt = Number(timestamp) * (String(timestamp).length > 11 ? 1 : 1000)
    if (!Number.isFinite(sentAt) || Math.abs(Date.now() - sentAt) > REPLAY_TOLERANCE_MS) return null

    const raw = Buffer.isBuffer(ctx.rawBody) ? ctx.rawBody.toString('utf8') : String(ctx.rawBody)
    const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${raw}`).digest('hex')
    const given = Buffer.from(signature.replace(/^sha256=/, ''), 'utf8')
    const mine = Buffer.from(expected, 'utf8')
    // Length check first: timingSafeEqual throws on a mismatch rather than
    // returning false, and a wrong-length signature is a failure either way.
    if (given.length !== mine.length || !crypto.timingSafeEqual(given, mine)) return null

    return this.parse(body)
  }

  /** Map Snippe's event vocabulary onto the four outcomes the app knows. */
  private parse(body: unknown): WebhookEvent {
    const b = (body ?? {}) as any
    const data = b.data ?? {}
    const reference = String(data?.metadata?.order_reference ?? b?.metadata?.order_reference ?? '')
    const providerRef = String(data?.session_reference ?? data?.reference ?? '')
    const { amount, currency } = amountOf(data)

    switch (String(b.type ?? '')) {
      case 'payment.completed':
        // Without our reference there is nothing to settle against; treat it as
        // unknown so the controller falls back to looking the session up.
        if (!reference) return { kind: 'UNKNOWN' }
        return { kind: 'COLLECTION_SUCCEEDED', orderReference: reference, providerRef, amount, currency }
      case 'payment.failed':
      case 'payment.voided':
      case 'payment.expired':
        if (!reference) return { kind: 'UNKNOWN' }
        return { kind: 'COLLECTION_FAILED', orderReference: reference, providerRef }
      case 'payout.completed':
        if (!reference) return { kind: 'UNKNOWN' }
        return { kind: 'PAYOUT_SUCCEEDED', orderReference: reference, providerRef }
      case 'payout.failed':
      case 'payout.reversed':
        if (!reference) return { kind: 'UNKNOWN' }
        return { kind: 'PAYOUT_REVERSED', orderReference: reference, providerRef }
      default:
        return { kind: 'UNKNOWN' }
    }
  }

  /** The reference an unverified callback claims to be about. */
  referenceFromWebhook(body: unknown): string | null {
    const b = (body ?? {}) as any
    const ref = b?.data?.metadata?.order_reference ?? b?.metadata?.order_reference
    return typeof ref === 'string' && ref ? ref : null
  }

  /** The session reference an unverified callback claims, for a direct lookup. */
  sessionFromWebhook(body: unknown): string | null {
    const b = (body ?? {}) as any
    const ref = b?.data?.session_reference ?? b?.data?.reference
    return typeof ref === 'string' && ref ? ref : null
  }

  /**
   * Mobile money through Snippe, so the provider satisfies the full contract.
   * Unused today: collections run on ClickPesa, which is live and reconciled.
   */
  async initiateCollection(req: CollectionRequest): Promise<CollectionResult> {
    const session = await this.createCheckout({
      orderReference: req.orderReference,
      amount: req.amount,
      currency: req.currency,
      redirectUrl: env.CLIENT_URL,
      customer: { phone: req.phoneNumber },
      methods: ['mobile_money'],
    })
    return { providerRef: session.providerRef, status: 'PROCESSING', channel: 'SNIPPE' }
  }

  async createPayout(_req: PayoutRequest): Promise<PayoutResult> {
    throw new Error('Payouts run through ClickPesa; Snippe payouts are not enabled')
  }
}

export default new SnippeProvider()
