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
    const { amount, method, accountDetails } = req.body
    const wallet = await Wallet.findOne({ userId: req.user!.id })
    if (!wallet) return res.status(404).json({ success: false, message: 'Wallet not found' })
    if (wallet.balance < amount) {
      return res.status(400).json({ success: false, message: 'Insufficient balance' })
    }

    wallet.balance -= amount
    await wallet.save()

    res.json({ success: true, message: 'Withdrawal request submitted', data: { amount, method, status: 'PENDING' } })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}
