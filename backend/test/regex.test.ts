import { describe, it, expect } from 'vitest'
import { literal } from '../src/utils/regex'

describe('search text as a literal pattern', () => {
  it('matches exactly what was typed, special characters included', () => {
    for (const s of ['a.b', '[x]', 'price (TZS)', 'a+b', 'C:\path', '$5', 'mangoes?']) {
      expect(new RegExp(literal(s)).test(s)).toBe(true)
    }
    // A dot no longer means "any character".
    expect(new RegExp(literal('a.b')).test('axb')).toBe(false)
  })

  it('defuses a catastrophic-backtracking pattern', () => {
    const evil = '(a+)+$'
    const start = Date.now()
    expect(new RegExp(literal(evil)).test('a'.repeat(40) + '!')).toBe(false)
    expect(Date.now() - start).toBeLessThan(50)
  })

  it('caps the length', () => {
    expect(literal('x'.repeat(500)).length).toBe(80)
  })
})
