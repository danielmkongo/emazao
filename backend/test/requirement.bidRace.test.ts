import { describe, it, expect } from 'vitest'
import User from '../src/models/User'
import Requirement from '../src/models/Requirement'
import Bid from '../src/models/Bid'
import { updateBidStatus } from '../src/controllers/requirement.controller'
import { mockReq, mockRes } from './helpers'

describe('updateBidStatus — double-accept race', () => {
  it('only lets one of two concurrently-accepted bids actually win', async () => {
    const buyer = await User.create({ name: 'Buyer', email: 'buyer@test.com', username: 'reqbuyer', role: 'BUYER' })
    const farmerA = await User.create({ name: 'Farmer A', email: 'fa@test.com', username: 'farmera', role: 'FARMER' })
    const farmerB = await User.create({ name: 'Farmer B', email: 'fb@test.com', username: 'farmerb', role: 'FARMER' })

    const requirement = await Requirement.create({
      buyerId: buyer._id,
      title: 'Need maize',
      description: 'test',
      productType: 'maize',
      quantityAmount: 100,
      quantityUnit: 'kg',
      deliveryLocation: 'Dar',
      status: 'OPEN',
    })

    const bidA = await Bid.create({
      requirementId: requirement._id, farmerId: farmerA._id,
      pricePerUnit: 1, totalPrice: 100, deliveryTimeline: '3 days', message: 'x',
    })
    const bidB = await Bid.create({
      requirementId: requirement._id, farmerId: farmerB._id,
      pricePerUnit: 1, totalPrice: 100, deliveryTimeline: '3 days', message: 'x',
    })

    const call = (bidId: string) => {
      const req = mockReq({
        user: { id: buyer._id.toString(), role: 'BUYER', email: buyer.email },
        params: { bidId },
        body: { status: 'ACCEPTED' },
      })
      const res = mockRes()
      return updateBidStatus(req, res).then(() => res)
    }

    const [resA, resB] = await Promise.all([call(bidA._id.toString()), call(bidB._id.toString())])
    const statuses = [resA, resB].map(r => (r.status as any).mock.calls[0]?.[0])

    // Exactly one of the two should have been rejected with 409 (already awarded).
    expect(statuses.filter(s => s === 409).length).toBe(1)

    const freshA = await Bid.findById(bidA._id)
    const freshB = await Bid.findById(bidB._id)
    const acceptedCount = [freshA, freshB].filter(b => b!.status === 'ACCEPTED').length
    expect(acceptedCount).toBe(1)

    const freshReq = await Requirement.findById(requirement._id)
    expect(freshReq!.status).toBe('AWARDED')
  })
})
