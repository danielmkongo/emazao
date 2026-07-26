import { loadStripe } from '@stripe/stripe-js'

// Singleton — loadStripe() fetches Stripe.js once and caches the promise, same
// pattern as getSocket() in ./socket.ts.
export const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
