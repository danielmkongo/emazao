import { describe, it, expect } from 'vitest'
import jwt from 'jsonwebtoken'
import { verifyAccessToken, signAccessToken, requestClaims } from '../src/utils/tokens'

describe('login tokens', () => {
  it('still accepts tokens issued before keys were prepared once', () => {
    // Exactly how auth.controller signed them until now: the secret as a string.
    // Everyone already signed in holds one of these; they must keep working.
    const old = jwt.sign({ id: 'u1', role: 'BUYER', email: 'a@b.c' }, process.env.JWT_SECRET!, { expiresIn: '1h' })
    expect(verifyAccessToken(old)).toMatchObject({ id: 'u1', role: 'BUYER' })
  })

  it('issues tokens the old way of checking would also accept', () => {
    const fresh = signAccessToken({ id: 'u2', role: 'FARMER', email: 'f@b.c' })
    expect((jwt.verify(fresh, process.env.JWT_SECRET!) as any).id).toBe('u2')
  })

  it('refuses a token with no signature at all', () => {
    const unsigned = jwt.sign({ id: 'admin', role: 'SUPER_ADMIN', email: 'x@y.z' }, '', { algorithm: 'none' as any })
    expect(() => verifyAccessToken(unsigned)).toThrow()
  })

  it('refuses a token signed with someone else’s secret', () => {
    const forged = jwt.sign({ id: 'u3', role: 'ADMIN', email: 'z@y.x' }, 'not-our-secret')
    expect(() => verifyAccessToken(forged)).toThrow()
  })

  it('checks a request once, however many times it is asked', () => {
    const token = signAccessToken({ id: 'u4', role: 'BUYER', email: 'b@b.c' })
    const req: any = { headers: { authorization: `Bearer ${token}` } }
    const first = requestClaims(req)
    // Same object back, not a second verification.
    expect(requestClaims(req)).toBe(first)
    expect(first?.id).toBe('u4')
    expect(requestClaims({ headers: {} } as any)).toBeNull()
  })
})
