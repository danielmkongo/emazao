import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, TrendingUp, Sprout, Trophy, Flame, ShieldCheck } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatNumber } from '@/lib/utils'
import api from '@/lib/api'
import type { ApiResponse, Product, User } from '@/types'

const TRENDING_TAGS = ['organic', 'coffee', 'maize', 'cocoa', 'spices', 'moringa', 'teff', 'vanilla', 'export', 'avocado']

interface RankedFarmer { user: User; credibility?: number; rank?: number }

function PanelCard({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-[var(--c-card)] rounded-2xl border border-[var(--c-border)] p-4"
    >
      {children}
    </motion.div>
  )
}

export const RightPanel = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [q, setQ] = useState('')

  const { data: farmers } = useQuery({
    queryKey: ['rp-top-farmers'],
    queryFn: async (): Promise<RankedFarmer[]> => {
      // Ranked by the recommendation engine's creator credibility…
      const res = await api.get<ApiResponse<{ user: User; credibility: number; rank: number }[]>>('/users/top-farmers?limit=5')
      let list: RankedFarmer[] = (res.data.data ?? []).filter(d => d.user).map(d => ({ user: d.user, credibility: d.credibility, rank: d.rank }))
      // …falling back to recent farmers before the scores have been computed.
      if (!list.length) {
        const f = await api.get<ApiResponse<User[]>>('/users?role=FARMER&limit=5')
        list = (f.data.data ?? []).map(u => ({ user: u }))
      }
      return list
    },
    staleTime: 60_000,
  })

  const { data: hotProducts } = useQuery({
    queryKey: ['rp-trending-products'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Product[]>>('/search/trending')
      return res.data.data ?? []
    },
    staleTime: 60_000,
  })

  const followMutation = useMutation({
    mutationFn: (userId: string) => api.post(`/users/${userId}/follow`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rp-top-farmers'] }),
  })

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (q.trim()) navigate(`/explore?q=${encodeURIComponent(q.trim())}`)
  }

  const topFarmers = farmers ?? []
  const products = hotProducts ?? []

  return (
    <aside className="hidden xl:flex flex-col fixed right-0 top-0 bottom-0 w-80 z-20 border-l border-[var(--c-border)] bg-[var(--c-rail)] transition-colors duration-200">
      <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4">

        {/* Search */}
        <form onSubmit={submitSearch} className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--c-text-3)]" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search eMazao"
            aria-label="Search"
            className="w-full pl-10 pr-4 py-2.5 rounded-full bg-[var(--c-card)] border border-[var(--c-border)] text-sm text-[var(--c-text)] placeholder:text-[var(--c-text-3)] focus:outline-none focus:border-brand-green/50 focus:bg-[var(--c-card)] transition-colors"
          />
        </form>

        {/* Top Farmers — powered by the credibility ranking */}
        {topFarmers.length > 0 && (
          <PanelCard delay={0.05}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-gold" />
                <h3 className="font-bold text-[var(--c-text)] text-sm" style={{ fontFamily: 'var(--font-display)' }}>Top Farmers</h3>
              </div>
              <Link to="/explore?tab=farmers" className="text-xs text-brand-green hover:underline">See all</Link>
            </div>
            <div className="space-y-1">
              {topFarmers.map((f, i) => (
                <Link key={f.user._id} to={`/farm/${f.user.username}`}>
                  <div className="flex items-center gap-3 hover:bg-[var(--c-raised)] rounded-xl p-2 -mx-2 transition-colors group">
                    <span className={`w-4 text-center text-xs font-bold flex-shrink-0 ${i === 0 ? 'text-gold' : 'text-[var(--c-text-4)]'}`}>{i + 1}</span>
                    <Avatar src={f.user.avatar} name={f.user.name} size="sm" verified={f.user.isVerified} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[var(--c-text)] text-xs group-hover:text-brand-green transition-colors truncate">{f.user.name}</p>
                      {f.credibility !== undefined ? (
                        <p className="flex items-center gap-1 text-[var(--c-text-4)] text-[11px]">
                          <ShieldCheck className="h-3 w-3 text-brand-green" /> {f.credibility}% credibility
                        </p>
                      ) : (
                        <p className="text-[var(--c-text-4)] text-[11px] truncate">{f.user.country ?? 'Verified farmer'}</p>
                      )}
                    </div>
                    <Button size="xs" variant="outline" className="text-xs flex-shrink-0"
                      onClick={e => { e.preventDefault(); followMutation.mutate(f.user._id) }}>
                      Follow
                    </Button>
                  </div>
                </Link>
              ))}
            </div>
          </PanelCard>
        )}

        {/* Trending tags */}
        <PanelCard delay={0.1}>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-brand-green" />
            <h3 className="font-bold text-[var(--c-text)] text-sm" style={{ fontFamily: 'var(--font-display)' }}>Trending</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {TRENDING_TAGS.map(tag => (
              <Link key={tag} to={`/explore?q=${tag}`}>
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--c-raised)] text-[var(--c-text-2)] hover:bg-brand-green/12 hover:text-brand-green transition-all border border-[var(--c-border)] cursor-pointer">
                  #{tag}
                </span>
              </Link>
            ))}
          </div>
        </PanelCard>

        {/* Hot products — by view velocity */}
        {products.length > 0 && (
          <PanelCard delay={0.15}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-gold" />
                <h3 className="font-bold text-[var(--c-text)] text-sm" style={{ fontFamily: 'var(--font-display)' }}>Hot Products</h3>
              </div>
              <Link to="/marketplace" className="text-xs text-brand-green hover:underline">Browse</Link>
            </div>
            <div className="space-y-1">
              {products.slice(0, 5).map(product => (
                <Link key={product._id} to={`/marketplace/product/${product.slug || product._id}`}>
                  <div className="flex items-center gap-3 p-2 -mx-2 rounded-xl hover:bg-[var(--c-raised)] transition-colors group">
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-[var(--c-input)] flex-shrink-0">
                      {product.images?.[0]
                        ? <img src={product.images[0]} alt="" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center bg-brand-green/10"><Sprout className="h-4 w-4 text-brand-green/50" /></div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[var(--c-text)] text-xs font-medium truncate group-hover:text-brand-green transition-colors">{product.title}</p>
                      <p className="text-brand-green text-xs font-semibold font-mono">{formatCurrency(product.price)}<span className="text-[var(--c-text-4)] font-normal"> {product.priceUnit}</span></p>
                    </div>
                    {typeof product.viewCount === 'number' && (
                      <span className="text-[10px] text-[var(--c-text-4)] flex-shrink-0">{formatNumber(product.viewCount)} views</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </PanelCard>
        )}

        <p className="text-[var(--c-text-4)] text-[11px] px-1 leading-relaxed">
          eMazao · Agricultural Commerce<br />© {new Date().getFullYear()} · All rights reserved
        </p>
      </div>
    </aside>
  )
}
