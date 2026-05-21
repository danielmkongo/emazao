import mongoose, { Schema, Document } from 'mongoose'

export type TransactionType =
  | 'CREDIT'
  | 'DEBIT'
  | 'ESCROW_HOLD'
  | 'ESCROW_RELEASE'
  | 'REFUND'
  | 'WITHDRAWAL'
  | 'TOP_UP'

export interface IWalletTransaction {
  type: TransactionType
  amount: number
  description: string
  reference?: string
  status: string
  createdAt: Date
}

export interface IWallet extends Document {
  userId: mongoose.Types.ObjectId
  balance: number
  pendingBalance: number
  currency: string
  transactions: IWalletTransaction[]
  createdAt: Date
  updatedAt: Date
}

const WalletSchema = new Schema<IWallet>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    balance: { type: Number, default: 0 },
    pendingBalance: { type: Number, default: 0 },
    currency: { type: String, default: 'USD' },
    transactions: [
      {
        type: { type: String, enum: ['CREDIT', 'DEBIT', 'ESCROW_HOLD', 'ESCROW_RELEASE', 'REFUND', 'WITHDRAWAL', 'TOP_UP'] },
        amount: Number,
        description: String,
        reference: String,
        status: { type: String, default: 'completed' },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
)

export default mongoose.model<IWallet>('Wallet', WalletSchema)
