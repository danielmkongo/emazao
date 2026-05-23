import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Wallet, ArrowUpRight, ArrowDownLeft, TrendingUp, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, timeAgo } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'
import type { ApiResponse } from '@/types'

interface WalletData {
  _id: string
  balance: number
  pendingBalance: number
  currency: string
  updatedAt: string
}

interface Transaction {
  _id: string
  type: string
  amount: number
  description: string
  createdAt: string
}

export default function WalletPage() {
  const { user } = useAuthStore()
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [showWithdraw, setShowWithdraw] = useState(false)

  const { data: wallet, isLoading, refetch } = useQuery({
    queryKey: ['wallet', user?._id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<WalletData>>('/wallet')
      return res.data.data
    },
  })

  const { data: transactions } = useQuery({
    queryKey: ['wallet-transactions', user?._id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Transaction[]>>('/wallet/transactions')
      return res.data.data
    },
  })

  const withdrawMutation = useMutation({
    mutationFn: async (amount: number) => {
      await api.post('/wallet/withdraw', { amount, method: 'mobile_money' })
    },
    onSuccess: () => { setShowWithdraw(false); setWithdrawAmount(''); refetch() },
  })

  if (isLoading) return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
      <Skeleton className="h-48 rounded-3xl" />
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  )

  const txnPositive = (type: string) => ['CREDIT', 'ESCROW_RELEASE', 'REFUND', 'TOP_UP'].includes(type)

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Balance Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden bg-gradient-to-br from-brand-green to-brand-emerald rounded-3xl p-8 mb-6"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/3 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/5 rounded-full translate-y-1/3 -translate-x-1/3" />
        <Wallet className="h-8 w-8 text-white/80 mb-4 relative" />
        <p className="text-white/70 text-sm mb-1 relative">Available Balance</p>
        <p className="text-4xl font-bold text-white mb-2 relative" style={{ fontFamily: 'var(--font-mono)' }}>
          {formatCurrency(wallet?.balance ?? 0)}
        </p>
        {(wallet?.pendingBalance ?? 0) > 0 && (
          <p className="text-white/70 text-sm flex items-center gap-2 relative mb-4">
            <TrendingUp className="h-3.5 w-3.5" />
            {formatCurrency(wallet!.pendingBalance)} pending release
          </p>
        )}
        <div className="flex gap-3 mt-6 relative">
          <Button
            size="sm"
            className="bg-white text-brand-green hover:bg-white/90 font-semibold shadow-sm"
            onClick={() => setShowWithdraw(true)}
          >
            Withdraw
          </Button>
          <Button size="sm" variant="glass" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
      </motion.div>

      {/* Withdraw Form */}
      {showWithdraw && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[var(--c-card)] rounded-2xl border border-[var(--c-border)] p-5 mb-6"
        >
          <h3 className="font-semibold text-[var(--c-text)] mb-4">Withdraw Funds</h3>
          <div className="flex gap-3">
            <input
              type="number"
              value={withdrawAmount}
              onChange={e => setWithdrawAmount(e.target.value)}
              placeholder={`Max: ${formatCurrency(wallet?.balance ?? 0)}`}
              className="flex-1 bg-[var(--c-input)] border border-[var(--c-border)] rounded-xl px-4 py-2.5 text-[var(--c-text)] placeholder:text-[var(--c-text-4)] text-sm focus:outline-none focus:border-brand-green transition-all"
            />
            <Button
              onClick={() => withdrawMutation.mutate(parseFloat(withdrawAmount))}
              loading={withdrawMutation.isPending}
              disabled={!withdrawAmount || parseFloat(withdrawAmount) <= 0 || parseFloat(withdrawAmount) > (wallet?.balance ?? 0)}
            >
              Confirm
            </Button>
            <Button variant="ghost" onClick={() => setShowWithdraw(false)}>Cancel</Button>
          </div>
          {withdrawMutation.isError && (
            <p className="text-red-500 text-xs mt-2">
              {(withdrawMutation.error as any)?.response?.data?.message || 'Withdrawal failed'}
            </p>
          )}
        </motion.div>
      )}

      {/* Transactions */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-[var(--c-card)] rounded-2xl border border-[var(--c-border)] p-5"
      >
        <h3 className="font-semibold text-[var(--c-text)] mb-4">Recent Transactions</h3>
        {!transactions?.length ? (
          <div className="text-center py-10">
            <p className="text-[var(--c-text-3)] text-sm">No transactions yet</p>
            <p className="text-[var(--c-text-4)] text-xs mt-1">Completed orders will appear here</p>
          </div>
        ) : (
          <div className="space-y-1">
            {transactions.map((txn, i) => (
              <div
                key={txn._id ?? i}
                className="flex items-center gap-3 py-3 border-b border-[var(--c-border-sub)] last:border-0"
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                  txnPositive(txn.type) ? 'bg-brand-green/10' : 'bg-red-500/10'
                }`}>
                  {txnPositive(txn.type)
                    ? <ArrowDownLeft className="h-4 w-4 text-brand-green" />
                    : <ArrowUpRight className="h-4 w-4 text-red-500" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[var(--c-text)] text-sm font-medium truncate">{txn.description}</p>
                  <p className="text-[var(--c-text-4)] text-xs">{timeAgo(txn.createdAt)}</p>
                </div>
                <span className={`font-semibold font-mono text-sm flex-shrink-0 ${txnPositive(txn.type) ? 'text-brand-green' : 'text-red-500'}`}>
                  {txnPositive(txn.type) ? '+' : '-'}{formatCurrency(txn.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  )
}
