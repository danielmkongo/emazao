import { queryClient } from '@/lib/queryClient'

type Patch = Record<string, unknown> | ((reel: Record<string, any>) => Record<string, unknown>)

/**
 * Apply a change to one reel in every cached copy of it.
 *
 * The same reel lives in several caches at once: the Reels feed, the home
 * feed, profile grids, the single-reel lookup. Changing only the card on
 * screen meant that swiping away and back, or returning to the feed, rebuilt
 * it from a stale copy, so a comment or like you had just made seemed to
 * vanish until the next background refresh brought it back.
 */
export function patchReelEverywhere(reelId: string, patch: Patch) {
  const apply = (reel: Record<string, any>) => ({ ...reel, ...(typeof patch === 'function' ? patch(reel) : patch) })

  const walk = (node: unknown, depth: number): unknown => {
    if (depth > 6 || node === null || typeof node !== 'object') return node
    if (Array.isArray(node)) {
      let changed = false
      const out = node.map(n => { const r = walk(n, depth + 1); if (r !== n) changed = true; return r })
      return changed ? out : node
    }
    const obj = node as Record<string, any>
    // A reel is recognisable by its id and its video.
    if (obj._id === reelId && typeof obj.videoUrl === 'string') return apply(obj)
    let changed = false
    const out: Record<string, any> = {}
    for (const k of Object.keys(obj)) {
      const r = walk(obj[k], depth + 1)
      if (r !== obj[k]) changed = true
      out[k] = r
    }
    return changed ? out : node
  }

  for (const query of queryClient.getQueryCache().getAll()) {
    const data = query.state.data
    if (data === undefined) continue
    const next = walk(data, 0)
    if (next !== data) queryClient.setQueryData(query.queryKey, next)
  }
}
