import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import Wallet from '../models/Wallet'
import User from '../models/User'
import { getPaymentProvider } from '../services/payments'
import { checkPayoutEligibility } from '../services/verification/tiers'
import { recordPayoutIdentity } from './verification.controller'
import { normaliseTzPhone } from './payment.controller'

const MIN_WITHDRAWAL = 1000

export const getWallet = async (req: AuthRequest, res: Response) => {
  try {
    let wallet = await Wallet.findOne({ userId: req.user!.id })
    if (!wallet) {
      wallet = await Wallet.create({ userId: req.user!.id, balance: 0, pendingBalance: 0, currency: 'TZS' })
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
  const userId = req.user!.id
  // Unique per attempt so the provider rejects an accidental duplicate submission,
  // and so the reversal webhook can find exactly this transaction again.
  const reference = `PO${userId}${Date.now().toString(36)}`

  try {
    // A number, in whole shillings, and worth the provider's fee to send.
    const amount = Math.floor(Number(req.body?.amount))
    if (!Number.isFinite(amount) || amount < MIN_WITHDRAWAL) {
      return res.status(400).json({ success: false, message: `The minimum withdrawal is TZS ${MIN_WITHDRAWAL.toLocaleString()}` })
    }
    const { phoneNumber } = req.body

    // Fall back to the account's registered number so a seller can cash out
    // without re-typing it, but let them override per withdrawal.
    const user = await User.findById(userId).select('phone')
    const destination = normaliseTzPhone(phoneNumber || user?.phone)
    if (!destination) {
      return res.status(400).json({
        success: false,
        message: 'Enter a Tanzanian mobile money number to withdraw to, e.g. 0712 345 678',
      })
    }

    // The verification gate. Money leaving the platform is the only thing a
    // launderer actually wants, so this — not signup — is where identity and risk
    // are enforced. Covers tier limits, open AML flags and suspended accounts.
    const eligibility = await checkPayoutEligibility(userId, amount)
    if (!eligibility.allowed) {
      return res.status(403).json({
        success: false,
        message: eligibility.reason,
        data: {
          currentTier: eligibility.currentTier,
          requiredTier: eligibility.requiredTier,
          remainingAtThisTier: eligibility.remainingAtThisTier,
        },
      })
    }

    // Atomic guarded update: the balance check and the debit happen as one
    // operation, so two concurrent withdrawal requests can't both pass a
    // read-then-write balance check and drive the balance negative. Debiting
    // before calling the provider also means a slow payout can't be spent twice.
    const wallet = await Wallet.findOneAndUpdate(
      { userId, balance: { $gte: amount } },
      {
        $inc: { balance: -amount },
        $push: {
          transactions: {
            type: 'WITHDRAWAL',
            amount,
            description: `Withdrawal to ${destination}`,
            reference,
            status: 'pending',
            createdAt: new Date(),
          },
        },
      },
      { new: true },
    )

    if (!wallet) {
      const exists = await Wallet.exists({ userId })
      return res.status(exists ? 400 : 404).json({
        success: false,
        message: exists ? 'Insufficient balance' : 'Wallet not found',
      })
    }

    // Actually push the money to their phone. Previously this endpoint debited the
    // balance, marked the transaction 'completed' and sent nothing — the seller's
    // wallet went down and no cash ever arrived.
    try {
      const provider = getPaymentProvider()
      const payout = await provider.createPayout({
        orderReference: reference,
        amount,
        currency: wallet.currency,
        phoneNumber: destination,
      })

      await Wallet.updateOne(
        { userId, 'transactions.reference': reference },
        {
          $set: {
            'transactions.$.status': payout.status === 'SUCCESS' ? 'completed' : 'pending',
            'transactions.$.description': `Withdrawal to ${destination} (${payout.providerRef})`,
          },
        },
      )

      // The identity anchor. Tanzanian SIMs are registered against NIDA by law,
      // so the name the provider holds for this wallet is already
      // government-verified — matching it against the declared name is stronger
      // evidence than any selfie, and it costs nothing. Also advances the
      // seller's lifetime payout total, which drives their tier.
      await recordPayoutIdentity(userId, destination, payout.beneficiaryName, amount).catch(e =>
        console.error('[verification] recordPayoutIdentity failed:', e.message),
      )

      return res.json({
        success: true,
        message: payout.status === 'SUCCESS' ? 'Withdrawal sent' : 'Withdrawal is being processed',
        data: { amount, phoneNumber: destination, status: payout.status, reference },
      })
    } catch (payoutErr: any) {
      // Provider refused it — give the money straight back rather than leaving the
      // seller short with nothing on the way.
      await Wallet.updateOne(
        { userId, 'transactions.reference': reference },
        {
          $inc: { balance: amount },
          $set: { 'transactions.$.status': 'failed', 'transactions.$.description': `Withdrawal failed: ${payoutErr.message}` },
        },
      )
      return res.status(502).json({
        success: false,
        message: `Withdrawal could not be sent: ${payoutErr.message}. Your balance is unchanged.`,
      })
    }
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}
