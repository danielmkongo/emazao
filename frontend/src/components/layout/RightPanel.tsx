import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck, ShoppingBag } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { CountBadge } from '@/components/layout/TopBar'
import { useAuthStore } from '@/store/authStore'
import { useCart } from '@/hooks/useCart'
import { ImageWithFallback } from '@/components/ui/image-with-fallback'
import { formatCurrency } from '@/lib/utils'
import api from '@/lib/api'
import type { ApiResponse, Product, User } from '@/types'

interface RankedFarmer { user: User; credibility?: number; rank?: number }

export const RightPanel = () => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const me = useAuthStore(s => s.user)
  const { cart } = useCart()

  const { data: farmers } = useQuery({
    queryKey: ['rp-top-farmers'],
    queryFn: async (): Promise<RankedFarmer[]> => {
      // Ranked by the recommendation engine's creator credibility…
      const res = await api.get<ApiResponse<{ user: User; credibility: number; rank: number }[]>>('/users/top-farmers?limit=15')
      let list: RankedFarmer[] = (res.data.data ?? []).filter(d => d.user).map(d => ({ user: d.user, credibility: d.credibility, rank: d.rank }))
      // …falling back to recent farmers before the scores have been computed.
      if (!list.length) {
        const f = await api.get<ApiResponse<User[]>>('/users?role=FARMER&limit=5')
        list = (f.data.data ?? []).map(u => ({ user: u }))
      }
      // Only people you do not already follow belong under "Suggested".
      const mine = useAuthStore.getState().user
      if (mine) {
        const f = await api.get<ApiResponse<User[]>>(`/users/${mine.username}/following`).catch(() => null)
        const followed = new Set((f?.data.data ?? []).map(u => u._id))
        list = list.filter(x => x.user._id !== mine._id && !followed.has(x.user._id))
      }
      return list.slice(0, 5)
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

  // The button label was hardcoded to "Follow", so pressing it changed nothing on
  // screen no matter what the server returned — the request succeeded silently
  // and the UI stayed identical, before and after a refresh. Track the result
  // per user id and render from it.
  const [followed, setFollowed] = useState<Record<string, boolean>>({})

  const followMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await api.post<ApiResponse<{ following: boolean }>>(`/users/${userId}/follow`)
      return { userId, following: res.data.data?.following ?? true }
    },
    onMutate: (userId: string) => {
      // Optimistic: the press should register immediately, not after a round trip.
      const previous = followed[userId] ?? false
      setFollowed(f => ({ ...f, [userId]: !previous }))
      return { userId, previous }
    },
    onError: (_err, _userId, ctx) => {
      if (ctx) setFollowed(f => ({ ...f, [ctx.userId]: ctx.previous }))
    },
    onSuccess: ({ userId, following }) => {
      setFollowed(f => ({ ...f, [userId]: following }))
      queryClient.invalidateQueries({ queryKey: ['rp-top-farmers'] })
    },
  })

  const topFarmers = farmers ?? []
  const products = hotProducts ?? []

  return (
    <aside className="hidden xl:flex flex-col fixed right-0 top-0 bottom-0 w-80 z-20 bg-[var(--c-bg)]">
      <div className="flex-1 overflow-y-auto no-scrollbar pt-9 pl-6 pr-7 pb-6">

        {/* You, with the cart as a quiet icon rather than another menu row */}
        {me && (
          <div className="flex items-center gap-3 mb-7">
            <Link to="/profile" className="flex items-center gap-3 flex-1 min-w-0 group">
              <Avatar src={me.avatar} name={me.name} size="lg" />
              <span className="min-w-0">
                <span className="block text-[14px] font-semibold text-[var(--c-text)] truncate group-hover:underline">{me.username}</span>
                <span className="block text-[13.5px] text-[var(--c-text-3)] truncate">{me.name}</span>
              </span>
            </Link>
            <Link to="/cart" aria-label={t('nav.cart')} title={t('nav.cart')}
              className="relative w-10 h-10 rounded-full flex items-center justify-center text-[var(--c-text)] hover:bg-[var(--c-raised)] transition-colors press">
              <ShoppingBag className="h-[22px] w-[22px]" strokeWidth={1.9} />
              <CountBadge count={cart.itemCount} className="bg-brand-green" />
            </Link>
          </div>
        )}

        {/* Suggested farmers, powered by the credibility ranking */}
        {topFarmers.length > 0 && (
          <section className="mb-7">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[14px] font-semibold text-[var(--c-text-3)]">{t('panel.suggested')}</h3>
              <Link to="/explore?tab=farmers" className="text-[12.5px] font-semibold text-[var(--c-text)] hover:text-[var(--c-text-3)]">{t('common.seeAll')}</Link>
            </div>
            {topFarmers.map(f => (
              <div key={f.user._id} className="flex items-center gap-3 py-2">
                <Link to={`/farm/${f.user.username}`} className="flex items-center gap-3 flex-1 min-w-0 group">
                  <Avatar src={f.user.avatar} name={f.user.name} size="md" />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1 text-[13.5px] font-semibold text-[var(--c-text)] group-hover:underline">
                      <span className="truncate">{f.user.name}</span>
                      {f.user.isVerified && <ShieldCheck className="h-3.5 w-3.5 text-brand-green flex-shrink-0" />}
                    </span>
                    <span className="block text-[12px] text-[var(--c-text-3)] truncate">
                      {f.credibility !== undefined ? t('panel.credibility', { value: f.credibility }) : (f.user.country ?? t('panel.farmer'))}
                    </span>
                  </span>
                </Link>
                <button
                  onClick={() => followMutation.mutate(f.user._id)}
                  className={`text-[12.5px] font-semibold flex-shrink-0 transition-colors ${followed[f.user._id] ? 'text-[var(--c-text)]' : 'text-brand-green hover:text-[var(--c-text)]'}`}>
                  {followed[f.user._id] ? t('common.following') : t('common.follow')}
                </button>
              </div>
            ))}
          </section>
        )}

        {/* Selling fast, by view velocity */}
        {products.length > 0 && (
          <section className="mb-7">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[14px] font-semibold text-[var(--c-text-3)]">{t('panel.sellingFast')}</h3>
              <Link to="/marketplace" className="text-[12.5px] font-semibold text-[var(--c-text)] hover:text-[var(--c-text-3)]">{t('common.seeAll')}</Link>
            </div>
            {products.slice(0, 4).map(product => (
              <Link key={product._id} to={`/marketplace/product/${product.slug || product._id}`} className="flex items-center gap-3 py-2 group">
                <div className="w-11 h-11 rounded-xl overflow-hidden bg-[var(--c-input)] flex-shrink-0">
                  <ImageWithFallback src={product.images?.[0]} alt="" className="w-full h-full object-cover" fallbackClassName="w-full h-full" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] text-[var(--c-text)] font-medium truncate group-hover:underline">{product.title}</p>
                  <p className="text-[12.5px] text-[var(--c-text-3)] tabular">{formatCurrency(product.price)} / {product.priceUnit}</p>
                </div>
              </Link>
            ))}
          </section>
        )}

        <p className="text-[var(--c-text-4)] text-[11.5px] leading-relaxed">
          <Link to="/feedback" className="hover:underline">{t('nav.feedback')}</Link> · <Link to="/nutrition" className="hover:underline">{t('nav.nutrition')}</Link> · <Link to="/requirements" className="hover:underline">{t('nav.requirements')}</Link>
          <br />© {new Date().getFullYear()} eMazao · Mazao Yako, Soko Lako
        </p>
      </div>
    </aside>
  )
}
