import { vi } from 'vitest'
import type { Response } from 'express'

// Minimal Express Response mock — captures status()/json() calls so a test can
// assert on what a controller sent back, without spinning up a real HTTP server.
export function mockRes() {
  const res = {} as Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> }
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  return res
}

export function mockReq(overrides: Record<string, unknown> = {}) {
  return {
    body: {},
    params: {},
    query: {},
    get: () => undefined,
    ip: '127.0.0.1',
    ...overrides,
  } as any
}
