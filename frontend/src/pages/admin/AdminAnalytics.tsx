import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Users, ShoppingBag, TrendingUp, Package } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatNumber } from '@/lib/utils'
import api from '@/lib/api'
import type { ApiResponse } from '@/types'

interface PlatformStats {
  totalUsers: number
  totalFarmers: number
  totalBuyers: number
  totalProducts: number
  totalOrders: number
  totalRevenue: number
  activeDisputes: number
}

export default function AdminAnalytics() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-analytics'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PlatformStats>>('/admin/analytics/platform')
      return res.data.data
    },
  })

  const metrics = data ? [
    { label: 'Total Users', value: formatNumber(data.totalUsers), icon: Users, color: 'text-blue-400' },
    { label: 'Farmers', value: formatNumber(data.totalFarmers), icon: Users, color: 'text-brand-green' },
    { label: 'Buyers', value: formatNumber(data.totalBuyers), icon: Users, color: 'text-purple-400' },
    { label: 'Total Products', value: formatNumber(data.totalProducts), icon: Package, color: 'text-orange-400' },
    { label: 'Total Orders', value: formatNumber(data.totalOrders), icon: ShoppingBag, color: 'text-gold' },
    { label: 'Platform Revenue', value: formatCurrency(data.totalRevenue), icon: TrendingUp, color: 'text-brand-green' },
  ] : []

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-white mb-6">Platform Analytics</h1>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {metrics.map((m, i) => (
            <motion.div key={m.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="bg-brand-800 rounded-2xl border border-white/[0.06] p-5">
              <m.icon className={`h-5 w-5 ${m.color} mb-3`} />
              <p className="text-2xl font-bold text-white mb-1">{m.value}</p>
              <p className="text-xs text-white/40">{m.label}</p>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
