import { describe, it, expect, vi } from 'vitest'
import crypto from 'crypto'

// config/env reads process.env once, when it is first imported, so these have
// to be set before the adapter is loaded — hence vi.hoisted rather than a
// beforeEach, which would run long after the import has been evaluated.
const { SECRET } = vi.hoisted(() => {
  const SECRET = 'whsec_test_key'
  process.env['SNIPPE_WEBHOOK_SECRET'] = SECRET
  process.env['SNIPPE_API_KEY'] = 'sk_test_key'
  return { SECRET }
})

const { default: snippe } = await import('../src/services/payments/snippe')

/** Sign exactly as Snippe documents it: HMAC-SHA256 over `{timestamp}.{raw}`. */
function signed(body: unknown, opts: { secret?: string; at?: number } = {}) {
  const raw = JSON.stringify(body)
  const timestamp = String(Math.floor((opts.at ?? Date.now()) / 1000))
  const signature = crypto.createHmac('sha256', opts.secret ?? SECRET)
    .update(`${timestamp}.${raw}`).digest('hex')
  return { raw, headers: { 'x-webhook-signature': signature, 'x-webhook-timestamp': timestamp } }
}

const completed = {
  id: 'evt_1',
  type: 'payment.completed',
  api_version: '2026-01-25',
  data: {
    reference: 'pi_xyz789',
    session_reference: 'sess_abc123',
    status: 'completed',
    amount: { value: 50000, currency: 'TZS' },
    payment_method: 'card',
    metadata: { order_reference: '64b7f0c2e1a2b3c4d5e6f701' },
  },
}

describe('Snippe webhook verification', () => {
  it('accepts a correctly signed payment and pulls out our own reference', () => {
    const { raw, headers } = signed(completed)
    const event = snippe.verifyAndParseWebhook(completed, { rawBody: raw, headers })

    expect(event).toEqual({
      kind: 'COLLECTION_SUCCEEDED',
      orderReference: '64b7f0c2e1a2b3c4d5e6f701',
      providerRef: 'sess_abc123',
      amount: 50000,
      currency: 'TZS',
    })
  })

  it('rejects a body that was altered after signing', () => {
    const { raw, headers } = signed(completed)
    // The classic attack: keep the signature, change the amount.
    const tampered = { ...completed, data: { ...completed.data, amount: { value: 1, currency: 'TZS' } } }
    expect(snippe.verifyAndParseWebhook(tampered, { rawBody: JSON.stringify(tampered), headers })).toBeNull()
    // The original bytes still verify, so the rejection is about the change.
    expect(snippe.verifyAndParseWebhook(completed, { rawBody: raw, headers })).not.toBeNull()
  })

  it('rejects a signature made with someone else’s key', () => {
    const { raw, headers } = signed(completed, { secret: 'not-our-key' })
    expect(snippe.verifyAndParseWebhook(completed, { rawBody: raw, headers })).toBeNull()
  })

  it('rejects a replay of a call captured an hour ago', () => {
    const { raw, headers } = signed(completed, { at: Date.now() - 60 * 60_000 })
    expect(snippe.verifyAndParseWebhook(completed, { rawBody: raw, headers })).toBeNull()
  })

  it('rejects a call with no signature at all', () => {
    expect(snippe.verifyAndParseWebhook(completed, { rawBody: JSON.stringify(completed), headers: {} })).toBeNull()
  })

  it('refuses to verify without the raw bytes, since re-serialising breaks the hash', () => {
    const { headers } = signed(completed)
    expect(snippe.verifyAndParseWebhook(completed, { headers })).toBeNull()
  })

  it('maps the failure events onto a failed collection', () => {
    for (const type of ['payment.failed', 'payment.voided', 'payment.expired']) {
      const body = { ...completed, type }
      const { raw, headers } = signed(body)
      expect(snippe.verifyAndParseWebhook(body, { rawBody: raw, headers })).toMatchObject({
        kind: 'COLLECTION_FAILED',
        orderReference: '64b7f0c2e1a2b3c4d5e6f701',
      })
    }
  })

  it('treats a payment carrying no reference of ours as unknown, not as settled', () => {
    const orphan = { ...completed, data: { ...completed.data, metadata: {} } }
    const { raw, headers } = signed(orphan)
    expect(snippe.verifyAndParseWebhook(orphan, { rawBody: raw, headers })).toEqual({ kind: 'UNKNOWN' })
  })
})

describe('Snippe configuration', () => {
  it('counts itself configured once an API key is present', () => {
    // getCardProvider() reads this, and returns null when it is false — which
    // is what keeps the card option off the payment screen on a server that
    // has no Snippe credentials.
    expect(snippe.configured).toBe(true)
  })
})
