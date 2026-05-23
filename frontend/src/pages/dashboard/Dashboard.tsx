import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { TrendingUp, Eye, ShoppingBag, DollarSign, Package, ArrowUpRight, Zap, Video, Store } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'

interface AnalyticsOverview {
  totalRevenue: number
  revenueThisMonth: number
  revenueGrowth: number
  totalOrders: number
  totalViews: number
  totalProducts: number
  totalReels: number
}

const MetricCard = ({ icon: Icon, label, value, growth, color }: {
  icon: React.ElementType; label: string; value: string; growth?: number; color: string
}) => (
  <motion.div
    whileHover={{ y: -2, scale: 1.01 }}
    className="bg-[var(--c-card)] rounded-2xl border border-[var(--c-border)] p-5"
  >
    <div className="flex items-center justify-between mb-4">
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      {growth !== undefined && (
        <span className={`text-xs font-medium flex items-center gap-1 ${growth >= 0 ? 'text-brand-lime' : 'text-red-400'}`}>
          <TrendingUp className="h-3 w-3" />
          {growth >= 0 ? '+' : ''}{growth}%
        </span>
      )}
    </div>
    <p className="text-2xl font-bold text-[var(--c-text)] mb-1" style={{ fontFamily: 'var(--font-mono)' }}>
      {value}
    </p>
    <p className="text-sm text-[var(--c-text-3)]">{label}</p>
  </motion.div>
)

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  if (h < 21) return 'Good evening'
  return 'Good night'
}

function deriveInsights(data: AnalyticsOverview) {
  const insights: { icon: string; text: string }[] = []

  if (data.revenueGrowth > 0) {
    insights.push({ icon: '📈', text: `Revenue grew ${data.revenueGrowth}% this month vs last. Your farm is trending upward.` })
  } else if (data.revenueGrowth < 0) {
    insights.push({ icon: '📊', text: `Revenue is down ${Math.abs(data.revenueGrowth)}% from last month. Consider promoting your top products.` })
  }

  if (data.totalViews > 0 && data.totalOrders > 0) {
    const convRate = ((data.totalOrders / data.totalViews) * 100).toFixed(1)
    insights.push({ icon: '🎯', text: `Conversion rate: ${convRate}% of product views lead to orders. Add quality photos to improve this.` })
  }

  if (data.totalProducts === 0) {
    insights.push({ icon: '🌾', text: 'Add your first product to start selling. Listings with photos get 3× more views.' })
  } else if (data.totalProducts < 3) {
    insights.push({ icon: '🏪', text: `You have ${data.totalProducts} product${data.totalProducts !== 1 ? 's' : ''}. Farms with 5+ listings earn 40% more on average.` })
  } else {
    insights.push({ icon: '🔥', text: `${data.totalProducts} active products with ${data.totalViews.toLocaleString()} total views. Keep your stock updated.` })
  }

  if (data.totalReels === 0) {
    insights.push({ icon: '🎬', text: 'Farmers who post reels get 5× more profile visits. Upload your first farm video today.' })
  } else {
    insights.push({ icon: '⏰', text: 'Post new products between 6–8 AM for maximum visibility in buyer feeds.' })
  }

  return insights.slice(0, 3)
}

export default function Dashboard() {
  const { user } = useAuthStore()

  const { data, isLoading } = useQuery({
    queryKey: ['analytics-overview'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: AnalyticsOverview }>('/analytics/overview')
      return res.data.data
    },
    placeholderData: {
      totalRevenue: 0,
      revenueThisMonth: 0,
      revenueGrowth: 0,
      totalOrders: 0,
      totalViews: 0,
      totalProducts: 0,
      totalReels: 0,
    },
  })

  const metrics = [
    { icon: DollarSign, label: 'This Month', value: formatCurrency(data?.revenueThisMonth ?? 0), growth: data?.revenueGrowth, color: 'bg-brand-green/15 text-brand-green' },
    { icon: ShoppingBag, label: 'Total Orders', value: formatNumber(data?.totalOrders ?? 0), color: 'bg-gold/15 text-gold' },
    { icon: Eye, label: 'Product Views', value: formatNumber(data?.totalViews ?? 0), color: 'bg-brand-lime/15 text-brand-lime' },
    { icon: Package, label: 'Active Products', value: formatNumber(data?.totalProducts ?? 0), color: 'bg-purple-500/15 text-purple-400' },
  ]

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-8"
      >
        <div>
          <h1 className="text-2xl font-bold text-[var(--c-text)]" style={{ fontFamily: 'var(--font-display)' }}>
            {getGreeting()}, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-[var(--c-text-3)] text-sm mt-1">Here's how your farm is performing</p>
        </div>
        <div className="flex gap-3">
          <Link to="/dashboard/products/new">
            <Button><Package className="h-4 w-4" /> Add Product</Button>
          </Link>
        </div>
      </motion.div>

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {metrics.map((m) => (
            <MetricCard key={m.label} {...m} />
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-[var(--c-text)] flex items-center gap-2">
              <Zap className="h-5 w-5 text-gold" /> AI Insights
            </h2>
            <Link to="/dashboard/analytics">
              <Button variant="ghost" size="xs">
                Full Analytics <ArrowUpRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
          <div className="space-y-3">
            {(data ? deriveInsights(data) : []).map((insight, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex items-start gap-4 bg-[var(--c-card)] rounded-xl border border-[var(--c-border)] p-4"
              >
                <span className="text-2xl flex-shrink-0">{insight.icon}</span>
                <p className="text-sm text-[var(--c-text-2)] leading-relaxed">{insight.text}</p>
              </motion.div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="font-semibold text-[var(--c-text)] mb-4">Quick Actions</h2>
          <div className="space-y-2">
            {[
              { label: 'Manage Products', href: '/dashboard/products', icon: Package, color: 'text-brand-green' },
              { label: 'My Reels', href: '/dashboard/reels', icon: Video, color: 'text-pink-400' },
              { label: 'Storefront', href: '/dashboard/storefront', icon: Store, color: 'text-blue-400' },
              { label: 'View Orders', href: '/dashboard/orders', icon: ShoppingBag, color: 'text-gold' },
              { label: 'Check Bids', href: '/dashboard/bids', icon: TrendingUp, color: 'text-brand-lime' },
              { label: 'Full Analytics', href: '/dashboard/analytics', icon: Eye, color: 'text-purple-400' },
            ].map(({ label, href, icon: Icon, color }) => (
              <Link key={href} to={href}>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--c-card)] border border-[var(--c-border)] hover:border-brand-green/40 transition-all group">
                  <Icon className={`h-5 w-5 ${color}`} />
                  <span className="text-sm text-[var(--c-text-2)] group-hover:text-[var(--c-text)] transition-colors">{label}</span>
                  <ArrowUpRight className="h-4 w-4 text-[var(--c-text-4)] ml-auto group-hover:text-[var(--c-text-3)] transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
