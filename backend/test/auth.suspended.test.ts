import { describe, it, expect, vi } from 'vitest'
import jwt from 'jsonwebtoken'
import User from '../src/models/User'
import { protect } from '../src/middleware/auth.middleware'
import { mockReq, mockRes } from './helpers'

describe('protect middleware — suspended accounts', () => {
  it('rejects a valid token belonging to a suspended user', async () => {
    const user = await User.create({
      name: 'Suspended', email: 'suspended@test.com', username: 'suspendeduser',
      role: 'BUYER', isSuspended: true,
    })
    const token = jwt.sign({ id: user._id.toString(), role: user.role, email: user.email }, process.env.JWT_SECRET!)

    const req = mockReq({ headers: { authorization: `Bearer ${token}` } })
    const res = mockRes()
    const next = vi.fn()

    await protect(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(403)
  })

  it('allows a valid token for a non-suspended user through', async () => {
    const user = await User.create({
      name: 'Active', email: 'active@test.com', username: 'activeuser',
      role: 'BUYER', isSuspended: false,
    })
    const token = jwt.sign({ id: user._id.toString(), role: user.role, email: user.email }, process.env.JWT_SECRET!)

    const req = mockReq({ headers: { authorization: `Bearer ${token}` } })
    const res = mockRes()
    const next = vi.fn()

    await protect(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
    expect(req.user.id).toBe(user._id.toString())
  })
})
