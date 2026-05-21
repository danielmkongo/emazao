import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Wallet, ArrowUpRight, ArrowDownLeft, TrendingUp, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, timeAgo } from '@/lib/utils'
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
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [showWithdraw, setShowWithdraw] = useState(false)

  const { data: wallet, isLoading, refetch } = useQuery({
    queryKey: ['wallet'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<WalletData>>('/wallet')
      return res.data.data
    },
  })

  const { data: transactions } = useQuery({
    queryKey: ['wallet-transactions'],
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

  const txnIcon = (type: string) => {
    if (['CREDIT', 'ESCROW_RELEASE', 'REFUND'].includes(type)) return <ArrowDownLeft className="h-4 w-4 text-brand-green" />
    return <ArrowUpRight className="h-4 w-4 text-red-400" />
  }
  const txnPositive = (type: string) => ['CREDIT', 'ESCROW_RELEASE', 'REFUND'].includes(type)

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Balance Card */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden bg-gradient-to-br from-brand-green to-brand-emerald rounded-3xl p-8 mb-6">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <Wallet className="h-8 w-8 text-white/80 mb-4" />
        <p className="text-white/70 text-sm mb-1">Available Balance</p>
        <p className="text-4xl font-bold text-white mb-4">{formatCurrency(wallet?.balance ?? 0)}</p>
        {(wallet?.pendingBalance ?? 0) > 0 && (
          <p className="text-white/70 text-sm flex items-center gap-2">
            <TrendingUp className="h-3.5 w-3.5" />
            {formatCurrency(wallet!.pendingBalance)} pending release
          </p>
        )}
        <div className="flex gap-3 mt-6">
          <Button size="sm" className="bg-white text-brand-green hover:bg-white/90 font-semibold"
            onClick={() => setShowWithdraw(true)}>
            Withdraw
          </Button>
          <Button size="sm" variant="glass" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
      </motion.div>

      {/* Withdraw Form */}
      {showWithdraw && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-brand-800 rounded-2xl border border-white/[0.06] p-5 mb-6">
          <h3 className="font-medium text-white mb-4">Withdraw Funds</h3>
          <div className="flex gap-3">
            <input
              type="number"
              value={withdrawAmount}
              onChange={e => setWithdrawAmount(e.target.value)}
              placeholder={`Max: ${formatCurrency(wallet?.balance ?? 0)}`}
              className="flex-1 bg-brand-700 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-brand-green"
            />
            <Button onClick={() => withdrawMutation.mutate(parseFloat(withdrawAmount))}
              loading={withdrawMutation.isPending}
              disabled={!withdrawAmount || parseFloat(withdrawAmount) <= 0 || parseFloat(withdrawAmount) > (wallet?.balance ?? 0)}>
              Confirm
            </Button>
            <Button variant="ghost" onClick={() => setShowWithdraw(false)}>Cancel</Button>
          </div>
          {withdrawMutation.isError && (
            <p className="text-red-400 text-xs mt-2">{(withdrawMutation.error as any)?.response?.data?.message}</p>
          )}
        </motion.div>
      )}

      {/* Transactions */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="bg-brand-800 rounded-2xl border border-white/[0.06] p-5">
        <h3 className="font-medium text-white mb-4">Recent Transactions</h3>
        {!transactions?.length ? (
          <div className="text-center py-8">
            <p className="text-white/30 text-sm">No transactions yet</p>
          </div>
        ) : (
          <div className="space-y-1">
            {transactions.map((txn) => (
              <div key={txn._id} className="flex items-center gap-3 py-3 border-b border-white/[0.04] last:border-0">
                <div className="w-8 h-8 rounded-full bg-brand-700 flex items-center justify-center flex-shrink-0">
                  {txnIcon(txn.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium">{txn.description}</p>
                  <p className="text-white/30 text-xs">{timeAgo(txn.createdAt)}</p>
                </div>
                <span className={`font-semibold font-mono text-sm ${txnPositive(txn.type) ? 'text-brand-green' : 'text-red-400'}`}>
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
