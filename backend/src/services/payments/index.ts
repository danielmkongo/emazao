import { env } from '../../config/env'
import type { PaymentProvider } from './types'
import clickpesa from './clickpesa'

// Add a provider by implementing PaymentProvider and registering it here — the
// controllers never name a provider directly, so switching rails (AzamPay,
// Selcom, Flutterwave for West Africa) is a config change, not a refactor.
const providers: Record<string, PaymentProvider> = {
  clickpesa,
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

export * from './types'
