import { describe, it, expect, vi } from 'vitest'

/**
 * The card option is drawn from whether a provider is configured, so the two
 * states are worth pinning down: an unset key must mean "no cards offered",
 * never a button that fails when someone presses it.
 */
describe('choosing a card provider', () => {
  it('offers none when Snippe has no API key', async () => {
    vi.resetModules()
    process.env['SNIPPE_API_KEY'] = ''
    const { getCardProvider } = await import('../src/services/payments')
    expect(getCardProvider()).toBeNull()
  })

  it('offers Snippe once a key is set', async () => {
    vi.resetModules()
    process.env['SNIPPE_API_KEY'] = 'sk_test_key'
    const { getCardProvider } = await import('../src/services/payments')
    const provider = getCardProvider()
    expect(provider?.name).toBe('snippe')
    expect(typeof provider?.createCheckout).toBe('function')
  })

  it('offers none when pointed at a provider that has no hosted checkout', async () => {
    vi.resetModules()
    process.env['SNIPPE_API_KEY'] = 'sk_test_key'
    process.env['CARD_PAYMENT_PROVIDER'] = 'clickpesa'
    const { getCardProvider } = await import('../src/services/payments')
    expect(getCardProvider()).toBeNull()
    process.env['CARD_PAYMENT_PROVIDER'] = 'snippe'
  })

  it('leaves mobile money alone whatever the card setting is', async () => {
    vi.resetModules()
    process.env['SNIPPE_API_KEY'] = ''
    const { getPaymentProvider } = await import('../src/services/payments')
    expect(getPaymentProvider().name).toBe('clickpesa')
  })
})
