import { describe, it, expect } from 'vitest'
import Category from '../src/models/Category'
import { memo } from '../src/utils/memo'

describe('memo', () => {
  it('lets many concurrent callers share one pending Mongoose query', async () => {
    await Category.create({ name: 'Grains', slug: 'grains' })
    let runs = 0
    const load = () => { runs++; return Category.find().lean() }
    // Fifty requests arriving while the first is still loading: all must get
    // the answer, and the database must be asked once.
    const results = await Promise.all(Array.from({ length: 50 }, () => memo('t:concurrent', 60_000, load)))
    expect(results.every(r => r.length === 1)).toBe(true)
    expect(runs).toBe(1)
  })

  it('serves the last good answer if a refresh fails', async () => {
    let fail = false
    const load = async () => { if (fail) throw new Error('db down'); return 'fresh' }
    expect(await memo('t:fallback', 0, load)).toBe('fresh')
    fail = true
    expect(await memo('t:fallback', 0, load)).toBe('fresh')
  })
})
