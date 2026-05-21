import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Package, Eye, ShoppingBag, Video } from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatNumber } from '@/lib/utils'
import api from '@/lib/api'
import type { ApiResponse } from '@/types'

interface OverviewData {
  totalRevenue: number
  revenueThisMonth: number
  revenueLastMonth: number
  revenueGrowth: number
  totalProducts: number
  totalReels: number
  totalOrders: number
  totalViews: number
}

interface RevenuePoint { month: string; revenue: number; orders: number }
interface ProductStat { _id: string; title: string; viewCount: number; likeCount: number; orderCount: number }

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-brand-800 border border-white/10 rounded-xl px-4 py-3 text-sm">
      <p className="text-white/50 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-semibold">
          {p.name === 'revenue' ? formatCurrency(p.value) : p.value}
        </p>
      ))}
    </div>
  )
}

export default function Analytics() {
  const { data: overview, isLoading } = useQuery({
    queryKey: ['analytics-overview'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<OverviewData>>('/analytics/overview')
      return res.data.data
    },
  })

  const { data: revenueData } = useQuery({
    queryKey: ['analytics-revenue'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<RevenuePoint[]>>('/analytics/revenue')
      return res.data.data
    },
  })

  const { data: products } = useQuery({
    queryKey: ['analytics-products'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<ProductStat[]>>('/analytics/products')
      return res.data.data
    },
  })

  const metrics = overview ? [
    { label: 'Revenue This Month', value: formatCurrency(overview.revenueThisMonth), icon: TrendingUp, color: 'text-brand-green',
      sub: `${overview.revenueGrowth > 0 ? '+' : ''}${overview.revenueGrowth}% vs last month`,
      positive: overview.revenueGrowth >= 0 },
    { label: 'Total Revenue', value: formatCurrency(overview.totalRevenue), icon: TrendingUp, color: 'text-gold', sub: 'All time' },
    { label: 'Total Orders', value: formatNumber(overview.totalOrders), icon: ShoppingBag, color: 'text-blue-400', sub: 'Completed & pending' },
    { label: 'Product Views', value: formatNumber(overview.totalViews), icon: Eye, color: 'text-purple-400', sub: 'Across all listings' },
    { label: 'Active Products', value: formatNumber(overview.totalProducts), icon: Package, color: 'text-orange-400', sub: 'Live listings' },
    { label: 'Reels', value: formatNumber(overview.totalReels), icon: Video, color: 'text-pink-400', sub: 'Published videos' },
  ] : []

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-white mb-8">Analytics</h1>

      {/* Metric Cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          {metrics.map((m, i) => (
            <motion.div key={m.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="bg-brand-800 rounded-2xl border border-white/[0.06] p-5">
              <m.icon className={`h-5 w-5 ${m.color} mb-3`} />
              <p className="text-2xl font-bold text-white mb-1">{m.value}</p>
              <p className="text-xs text-white/40">{m.label}</p>
              {m.sub && (
                <p className={`text-xs mt-1 ${m.positive === false ? 'text-red-400' : m.positive ? 'text-brand-green' : 'text-white/30'}`}>
                  {m.sub}
                </p>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Revenue Chart */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="bg-brand-800 rounded-2xl border border-white/[0.06] p-6 mb-6">
        <h2 className="font-semibold text-white mb-6">Revenue Trend</h2>
        {!revenueData ? (
          <Skeleton className="h-48" />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#16A34A" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#16A34A" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="month" stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 12 }} />
              <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 12 }} tickFormatter={v => `$${v}`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="revenue" stroke="#16A34A" fill="url(#revenueGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </motion.div>

      {/* Orders Chart */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
        className="bg-brand-800 rounded-2xl border border-white/[0.06] p-6 mb-6">
        <h2 className="font-semibold text-white mb-6">Orders per Month</h2>
        {!revenueData ? (
          <Skeleton className="h-40" />
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="month" stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 12 }} />
              <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="orders" fill="#F59E0B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </motion.div>

      {/* Top Products */}
      {products && products.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="bg-brand-800 rounded-2xl border border-white/[0.06] p-6">
          <h2 className="font-semibold text-white mb-4">Top Products by Views</h2>
          <div className="space-y-3">
            {products.map((p, i) => (
              <div key={p._id} className="flex items-center gap-4">
                <span className="text-white/20 font-mono text-sm w-4">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{p.title}</p>
                  <div className="flex items-center gap-3 text-xs text-white/30 mt-0.5">
                    <span><Eye className="h-3 w-3 inline mr-0.5" />{formatNumber(p.viewCount)}</span>
                    <span><ShoppingBag className="h-3 w-3 inline mr-0.5" />{p.orderCount} orders</span>
                  </div>
                </div>
                <div className="w-24 bg-brand-700 rounded-full h-1.5">
                  <div className="bg-brand-green h-1.5 rounded-full"
                    style={{ width: `${Math.min(100, (p.viewCount / (products[0]?.viewCount || 1)) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  )
}
