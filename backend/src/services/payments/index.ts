import { env } from '../../config/env'
import type { PaymentProvider } from './types'
import clickpesa from './clickpesa'
import snippe from './snippe'

// Add a provider by implementing PaymentProvider and registering it here — the
// controllers never name a provider directly, so switching rails (AzamPay,
// Selcom, Flutterwave for West Africa) is a config change, not a refactor.
const providers: Record<string, PaymentProvider> = {
  clickpesa,
  snippe,
}

export function getPaymentProvider(): PaymentProvider {
  const provider = providers[env.PAYMENT_PROVIDER]
  if (!provider) {
    throw new Error(
      `Unknown PAYMENT_PROVIDER '${env.PAYMENT_PROVIDER}'. Available: ${Object.keys(providers).join(', ')}`,
    )
  }
  return provider
}

/**
 * The provider that takes cards, or null when none is configured.
 *
 * Two rails run at once rather than one: mobile money is what almost everyone
 * in Tanzania actually pays with and is already live on ClickPesa, while cards
 * matter for the buyers abroad who have no M-Pesa wallet. Returning null when
 * the key is unset is deliberate — the card option simply is not offered, and
 * a missing key can never take mobile money down with it.
 */
export function getCardProvider(): PaymentProvider | null {
  const provider = providers[env.CARD_PAYMENT_PROVIDER]
  if (!provider || typeof provider.createCheckout !== 'function') return null
  // `configured` is Snippe's own "do I have an API key" flag.
  if ('configured' in provider && !(provider as { configured?: boolean }).configured) return null
  return provider
}

export * from './types'
