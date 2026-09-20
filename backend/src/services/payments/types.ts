// Provider-agnostic payment contract.
//
// eMazao's money flow is escrow-shaped: collect the buyer's funds into the
// platform account, hold them, then pay the seller out on delivery confirmation.
// Every provider we use has to express exactly those two movements plus a
// trustworthy webhook, so that is all this interface asks for. Swapping ClickPesa
// for AzamPay/Selcom later should mean adding one file, not touching controllers.

export type CollectionStatus = 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'SETTLED'
export type PayoutStatus = 'AUTHORIZED' | 'SUCCESS' | 'REVERSED' | 'FAILED'

export interface CollectionRequest {
  /** Our own id for the payment. Must survive a round-trip through the provider. */
  orderReference: string
  amount: number
  currency: string
  /** Payer's mobile money number, country code first, no '+'. e.g. 255712345678 */
  phoneNumber: string
}

export interface CollectionResult {
  providerRef: string
  status: CollectionStatus
  /** Which wallet actually took the payment, e.g. M-PESA / TIGO-PESA. */
  channel?: string
}

export interface PayoutRequest {
  orderReference: string
  amount: number
  currency: string
  phoneNumber: string
}

export interface PayoutResult {
  providerRef: string
  status: PayoutStatus
  /** Provider's own fee for this payout, when it reports one. */
  fee?: number
  /**
   * Name registered against the destination wallet, when the provider returns it.
   * Doubles as an identity signal: mobile money accounts in Tanzania are
   * registered against NIDA by law, so this name is already government-anchored.
   */
  beneficiaryName?: string
}

/**
 * Normalised webhook. Providers each have their own event vocabulary; controllers
 * only ever see these four outcomes plus UNKNOWN (which we acknowledge and ignore,
 * so an unrecognised event never wedges the provider's retry queue).
 */
export type WebhookEvent =
  | { kind: 'COLLECTION_SUCCEEDED'; orderReference: string; providerRef: string; amount: number; currency: string }
  | { kind: 'COLLECTION_FAILED'; orderReference: string; providerRef?: string }
  | { kind: 'PAYOUT_SUCCEEDED'; orderReference: string; providerRef: string }
  | { kind: 'PAYOUT_REVERSED'; orderReference: string; providerRef: string }
  | { kind: 'UNKNOWN' }

/**
 * A hosted checkout page, for rails that cannot be driven from our own UI.
 *
 * Mobile money is a push to a phone: we send the number and the buyer approves
 * on their handset, so the whole thing happens behind our own screen. A card
 * cannot work that way — taking a PAN on our own form would put eMazao inside
 * PCI scope for no benefit — so the buyer goes to the provider's page and
 * comes back. Same escrow either way: the money lands in the platform account
 * and is released on delivery.
 */
export interface CheckoutRequest {
  orderReference: string
  amount: number
  currency: string
  description?: string
  /** Where the buyer lands once they are done, successful or not. */
  redirectUrl: string
  /** Where the provider should post events for this payment. */
  webhookUrl?: string
  customer?: { name?: string; phone?: string; email?: string }
  /** Which rails the page should offer. Defaults to card. */
  methods?: ('card' | 'mobile_money')[]
}

export interface CheckoutResult {
  /** The provider's own id for the session, which is how it is looked up later. */
  providerRef: string
  checkoutUrl: string
  expiresAt?: string
}

/**
 * Everything a webhook carries besides its parsed body.
 *
 * Providers that sign the raw bytes need exactly those bytes: re-serialising
 * the JSON reorders keys and changes whitespace, and the signature no longer
 * matches. ClickPesa hashes a canonical form and ignores this entirely.
 */
export interface WebhookContext {
  rawBody?: Buffer | string
  headers?: Record<string, string | string[] | undefined>
}

/** What the provider itself says happened to a collection, asked directly. */
export interface CollectionLookup {
  status: CollectionStatus | 'PENDING'
  amount: number
  currency: string
  providerRef?: string
}

/** What the provider says happened to a payout. */
export interface PayoutLookup {
  status: PayoutStatus | 'PENDING' | 'PROCESSING'
  providerRef?: string
}

export interface PaymentProvider {
  readonly name: string
  /** Currencies this provider can actually collect in. Used to fail early with a clear message. */
  readonly supportedCurrencies: readonly string[]

  initiateCollection(req: CollectionRequest): Promise<CollectionResult>
  createPayout(req: PayoutRequest): Promise<PayoutResult>

  /** Returns null when the payload fails authenticity checks — treat as a 401, never process. */
  verifyAndParseWebhook(body: unknown, ctx?: WebhookContext): WebhookEvent | null

  /**
   * Open a hosted checkout page. Only implemented by providers that have one;
   * callers check for it rather than assuming, so a provider without cards
   * simply means the card option is not offered.
   */
  createCheckout?(req: CheckoutRequest): Promise<CheckoutResult>

  /** Look a collection up by the provider's own reference rather than ours. */
  queryCollectionByRef?(providerRef: string): Promise<CollectionLookup | null>

  /**
   * Ask the provider directly what happened to a collection. The source of
   * truth when a webhook is missing, late or cannot be verified: the answer
   * comes over our own authenticated connection, so nobody can forge it.
   * Returns null when the provider has no record of the reference.
   */
  queryCollection(orderReference: string): Promise<CollectionLookup | null>

  /** Same, for a payout. */
  queryPayout(orderReference: string): Promise<PayoutLookup | null>

  /** The reference a (possibly unsigned) webhook body is about, if it has one. */
  referenceFromWebhook(body: unknown): string | null
}
