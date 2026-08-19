import { describe, it, expect } from 'vitest'
import mongoose from 'mongoose'
import User from '../src/models/User'
import Product from '../src/models/Product'
import Order from '../src/models/Order'
import { createOrder } from '../src/controllers/order.controller'
import { mockReq, mockRes } from './helpers'

describe('createOrder — price integrity', () => {
  it('ignores a client-submitted price and recomputes it from the real Product', async () => {
    const seller = await User.create({ name: 'Seller', email: 's@test.com', username: 'seller1', role: 'FARMER' })
    const buyer = await User.create({ name: 'Buyer', email: 'b@test.com', username: 'buyer1', role: 'BUYER' })
    const product = await Product.create({
      sellerId: seller._id,
      categoryId: new mongoose.Types.ObjectId(),
      title: 'Real Coffee',
      slug: 'real-coffee-price-test',
      description: 'test',
      price: 100, // real price: 100 per unit
      priceUnit: 'per kg',
      status: 'ACTIVE',
    })

    const req = mockReq({
      user: { id: buyer._id.toString(), role: 'BUYER', email: buyer.email },
      body: {
        items: [
          {
            productId: product._id.toString(),
            quantity: 2,
            // Attacker-controlled fields — a malicious client naming its own price.
            unitPrice: 0.01,
            totalPrice: 0.02,
          },
        ],
        deliveryAddress: { street: '1 Main St', city: 'Dar', country: 'Tanzania' },
      },
    })
    const res = mockRes()

    await createOrder(req, res)

    expect(res.status).not.toHaveBeenCalledWith(400)
    const created = await Order.findOne({ buyerId: buyer._id })
    expect(created).not.toBeNull()
    // 2 units * real price 100 = 200, not the attacker's 0.02.
    expect(created!.items[0]!.unitPrice).toBe(100)
    expect(created!.items[0]!.totalPrice).toBe(200)
    expect(created!.subtotal).toBe(200)
    expect(created!.sellerId.toString()).toBe(seller._id.toString())
  })

  it('rejects an order mixing items from two different sellers', async () => {
    const sellerA = await User.create({ name: 'A', email: 'a@test.com', username: 'sellera', role: 'FARMER' })
    const sellerB = await User.create({ name: 'B', email: 'b2@test.com', username: 'sellerb', role: 'FARMER' })
    const buyer = await User.create({ name: 'Buyer2', email: 'b3@test.com', username: 'buyer2', role: 'BUYER' })
    const catId = new mongoose.Types.ObjectId()
    const productA = await Product.create({ sellerId: sellerA._id, categoryId: catId, title: 'A', slug: 'prod-a-multiseller', description: 'x', price: 10, priceUnit: 'per kg', status: 'ACTIVE' })
    const productB = await Product.create({ sellerId: sellerB._id, categoryId: catId, title: 'B', slug: 'prod-b-multiseller', description: 'x', price: 10, priceUnit: 'per kg', status: 'ACTIVE' })

    const req = mockReq({
      user: { id: buyer._id.toString(), role: 'BUYER', email: buyer.email },
      body: {
        items: [
          { productId: productA._id.toString(), quantity: 1 },
          { productId: productB._id.toString(), quantity: 1 },
        ],
        deliveryAddress: { street: '1 Main St', city: 'Dar', country: 'Tanzania' },
      },
    })
    const res = mockRes()

    await createOrder(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    const created = await Order.findOne({ buyerId: buyer._id })
    expect(created).toBeNull()
  })

  it('rejects an order for a product that does not exist', async () => {
    const buyer = await User.create({ name: 'Buyer3', email: 'b4@test.com', username: 'buyer3', role: 'BUYER' })
    const req = mockReq({
      user: { id: buyer._id.toString(), role: 'BUYER', email: buyer.email },
      body: {
        items: [{ productId: new mongoose.Types.ObjectId().toString(), quantity: 1 }],
        deliveryAddress: { street: '1 Main St', city: 'Dar', country: 'Tanzania' },
      },
    })
    const res = mockRes()

    await createOrder(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
  })
})
