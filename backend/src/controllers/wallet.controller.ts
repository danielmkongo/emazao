import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import Wallet from '../models/Wallet'

export const getWallet = async (req: AuthRequest, res: Response) => {
  try {
    let wallet = await Wallet.findOne({ userId: req.user!.id })
    if (!wallet) {
      wallet = await Wallet.create({ userId: req.user!.id, balance: 0, pendingBalance: 0, currency: 'USD' })
    }
    res.json({ success: true, data: wallet })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

export const getTransactions = async (req: AuthRequest, res: Response) => {
  try {
    const wallet = await Wallet.findOne({ userId: req.user!.id })
    if (!wallet) return res.json({ success: true, data: [] })
    const txns = (wallet as any).transactions || []
    res.json({ success: true, data: txns.slice(-50).reverse() })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

export const requestWithdrawal = async (req: AuthRequest, res: Response) => {
  try {
    const { amount, method } = req.body
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' })
    }

    // Atomic guarded update: the balance check and the debit happen as one
    // operation, so two concurrent withdrawal requests can't both pass a
    // read-then-write balance check and drive the balance negative.
    const wallet = await Wallet.findOneAndUpdate(
      { userId: req.user!.id, balance: { $gte: amount } },
      {
        $inc: { balance: -amount },
        $push: {
          transactions: {
            type: 'WITHDRAWAL',
            amount,
            description: `Withdrawal via ${method || 'mobile_money'}`,
            status: 'completed',
            createdAt: new Date(),
          },
        },
      },
      { new: true }
    )

    if (!wallet) {
      const exists = await Wallet.exists({ userId: req.user!.id })
      return res.status(exists ? 400 : 404).json({
        success: false,
        message: exists ? 'Insufficient balance' : 'Wallet not found',
      })
    }

    res.json({ success: true, message: 'Withdrawal request submitted', data: { amount, method, status: 'PENDING' } })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}
