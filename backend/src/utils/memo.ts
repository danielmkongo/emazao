/**
 * Keep the answer to an expensive, everyone-sees-the-same question for a
 * short while.
 *
 * Built for endpoints like trending products, top farmers and categories:
 * identical for every visitor, so running the query once per visitor is pure
 * waste. When an entry expires, requests that arrive during the refresh wait
 * on the same promise rather than each querying — otherwise the moment the
 * cache empties under load is the moment the database gets hit hardest. If a
 * refresh fails, the last good answer is served rather than an error.
 *
 * In-process: with several processes each keeps its own copy, which is fine
 * for data that is allowed to be a few seconds stale.
 */
type Entry<T> = { value?: T; expires: number; pending?: Promise<T> }
const store = new Map<string, Entry<unknown>>()

export async function memo<T>(key: string, ttlMs: number, load: () => PromiseLike<T>): Promise<T> {
  const entry = store.get(key) as Entry<T> | undefined
  if (entry && entry.value !== undefined && entry.expires > Date.now()) return entry.value
  if (entry?.pending) return entry.pending

  // Promise.resolve turns whatever `load` returns into one real promise. A
  // Mongoose query is only thenable: every `await` on it runs it again, so
  // requests sharing a pending rebuild each re-ran the same query and Mongoose
  // refused ("Query was already executed") — every one of them got a 500.
  const pending = Promise.resolve().then(load)
  store.set(key, { value: entry?.value, expires: entry?.expires ?? 0, pending })
  try {
    const value = await pending
    store.set(key, { value, expires: Date.now() + ttlMs })
    return value
  } catch (err) {
    store.set(key, { value: entry?.value, expires: entry?.expires ?? 0 })
    if (entry?.value !== undefined) return entry.value
    throw err
  }
}

/** Drop a cached answer, e.g. after an admin edits categories. */
export function forget(key: string) {
  store.delete(key)
}
