import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Wallet, TrendingUp, ArrowUpRight, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, timeAgo } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'
import type { ApiResponse } from '@/types'

interface WalletData {
  balance: number
  pendingBalance: number
  currency: string
}

export default function DashboardWallet() {
  const { user } = useAuthStore()

  const { data: wallet, isLoading, refetch } = useQuery({
    queryKey: ['dashboard-wallet', user?._id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<WalletData>>('/wallet')
      return res.data.data
    },
  })

  const { data: transactions } = useQuery({
    queryKey: ['dashboard-wallet-txns', user?._id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<any[]>>('/wallet/transactions')
      return res.data.data
    },
  })

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-[var(--c-text)] mb-6">Earnings Wallet</h1>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-48 rounded-3xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      ) : (
        <>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden bg-gradient-to-br from-brand-green to-brand-emerald rounded-3xl p-8 mb-6">
            <Wallet className="h-8 w-8 text-white/80 mb-4" />
            <p className="text-white/70 text-sm mb-1">Available to Withdraw</p>
            <p className="text-4xl font-bold text-white mb-2">{formatCurrency(wallet?.balance ?? 0)}</p>
            {(wallet?.pendingBalance ?? 0) > 0 && (
              <p className="text-white/70 text-sm flex items-center gap-1.5 mb-4">
                <TrendingUp className="h-3.5 w-3.5" />{formatCurrency(wallet!.pendingBalance)} pending from escrow
              </p>
            )}
            <div className="flex gap-3">
              <Link to="/wallet">
                <Button size="sm" className="bg-white text-brand-green hover:bg-white/90 font-semibold">
                  <ArrowUpRight className="h-3.5 w-3.5" /> Withdraw
                </Button>
              </Link>
              <Button size="sm" variant="glass" onClick={() => refetch()}>
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-[var(--c-card)] rounded-2xl border border-[var(--c-border)] p-5">
            <h2 className="font-semibold text-[var(--c-text)] mb-4">Recent Earnings</h2>
            {!transactions?.length ? (
              <p className="text-[var(--c-text-4)] text-sm text-center py-6">No transactions yet. Complete orders to earn.</p>
            ) : (
              <div className="space-y-1">
                {transactions.slice(0, 10).map((txn: any) => (
                  <div key={txn._id} className="flex items-center gap-3 py-3 border-b border-[var(--c-border-sub)] last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-[var(--c-text)] text-sm font-medium">{txn.description}</p>
                      <p className="text-[var(--c-text-3)] text-xs">{timeAgo(txn.createdAt)}</p>
                    </div>
                    <span className="font-semibold text-brand-green font-mono text-sm">+{formatCurrency(txn.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </>
      )}
    </div>
  )
}
