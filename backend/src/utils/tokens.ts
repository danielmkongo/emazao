import crypto, { KeyObject } from 'crypto'
import jwt from 'jsonwebtoken'
import type { Request } from 'express'
import { env } from '../config/env'

/**
 * Signing and checking login tokens, in one place.
 *
 * Handed a plain string, jsonwebtoken tries to parse it as a public-key
 * certificate first, fails, catches the error and only then treats it as a
 * shared secret — on every call. That detour cost 2.5 ms of CPU per check
 * against 0.06 ms with the key prepared once, and each request was checked
 * three times (twice by the rate limiter, once by `protect`). It capped the
 * whole server at roughly 130 signed-in requests a second per core.
 *
 * Keys are built once, on first use (not at import, so tests can set the
 * secret first), and a request's token is checked at most once however many
 * middlewares ask. The algorithm is pinned, so a token claiming any other
 * algorithm is refused rather than negotiated.
 */

export interface AccessClaims { id: string; role: string; email: string }

let accessKey: KeyObject | null = null
let refreshKey: KeyObject | null = null
const access = () => (accessKey ??= crypto.createSecretKey(Buffer.from(env.JWT_SECRET)))
const refresh = () => (refreshKey ??= crypto.createSecretKey(Buffer.from(env.JWT_REFRESH_SECRET)))
const ALGORITHMS: jwt.Algorithm[] = ['HS256']

export const signAccessToken = (claims: AccessClaims) =>
  jwt.sign(claims, access(), { algorithm: 'HS256', expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions)

export const signRefreshToken = (id: string) =>
  jwt.sign({ id }, refresh(), { algorithm: 'HS256', expiresIn: env.JWT_REFRESH_EXPIRES_IN } as jwt.SignOptions)

/** Throws when the token is invalid or expired, like jwt.verify. */
export const verifyAccessToken = (token: string) =>
  jwt.verify(token, access(), { algorithms: ALGORITHMS }) as AccessClaims

export const verifyRefreshToken = (token: string) =>
  jwt.verify(token, refresh(), { algorithms: ALGORITHMS }) as { id: string }

const seen = new WeakMap<object, AccessClaims | null>()

/** The verified claims behind a request's bearer token, or null — worked out once per request. */
export function requestClaims(req: Request): AccessClaims | null {
  if (seen.has(req)) return seen.get(req)!
  let claims: AccessClaims | null = null
  const header = req.headers.authorization
  if (header?.startsWith('Bearer ')) {
    try { claims = verifyAccessToken(header.slice(7)) } catch { claims = null }
  }
  seen.set(req, claims)
  return claims
}
