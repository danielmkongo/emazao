import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Baby, HeartPulse, Milk, UserRound, Stethoscope, Info } from 'lucide-react'
import { FeedProductCard } from '@/components/feed/FeedProductCard'
import { Skeleton } from '@/components/ui/skeleton'
import api from '@/lib/api'
import type { ApiResponse, Product } from '@/types'

/**
 * Produce suited to people with particular nutritional needs.
 *
 * The groups are chosen because they are where food matters most and mistakes
 * cost most: young children, pregnant women, nursing mothers, the sick and the
 * elderly. Sellers tag their own produce, so every page carries a plain note
 * that this is the farmer's description, not medical advice.
 */
const GROUPS = [
  { key: 'CHILDREN', icon: Baby, en: 'Children', sw: 'Watoto',
    enDesc: 'Iron, protein and energy for growing bodies.', swDesc: 'Madini ya chuma, protini na nishati kwa ukuaji.' },
  { key: 'PREGNANT', icon: HeartPulse, en: 'Pregnant women', sw: 'Wajawazito',
    enDesc: 'Folate, iron and calcium during pregnancy.', swDesc: 'Foliki, chuma na kalsiamu wakati wa ujauzito.' },
  { key: 'NURSING', icon: Milk, en: 'Nursing mothers', sw: 'Wamama wanaonyonyesha',
    enDesc: 'Fluids, protein and energy while breastfeeding.', swDesc: 'Maji, protini na nishati wakati wa kunyonyesha.' },
  { key: 'PATIENTS', icon: Stethoscope, en: 'The sick', sw: 'Wagonjwa',
    enDesc: 'Easy to digest, nourishing food for recovery.', swDesc: 'Chakula chepesi kumeng’enya na chenye lishe kwa kupona.' },
  { key: 'ELDERLY', icon: UserRound, en: 'The elderly', sw: 'Wazee',
    enDesc: 'Soft, fibre-rich produce for older adults.', swDesc: 'Mazao laini yenye nyuzinyuzi kwa wazee.' },
] as const

export default function Nutrition() {
  const { i18n } = useTranslation()
  const sw = i18n.resolvedLanguage === 'sw'
  const [params, setParams] = useSearchParams()
  const active = params.get('for') ?? GROUPS[0].key
  const group = GROUPS.find(g => g.key === active) ?? GROUPS[0]

  const { data, isLoading } = useQuery({
    queryKey: ['nutrition-products', active],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Product[]>>(`/products?nutrition=${active}&limit=40`)
      return res.data.data ?? []
    },
  })

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-[var(--c-text)]">
        {sw ? 'Lishe Maalum' : 'Special nutrition'}
      </h1>
      <p className="text-[var(--c-text-3)] text-sm mt-1 mb-5 max-w-2xl">
        {sw
          ? 'Mazao yanayofaa hasa kwa watu wenye mahitaji maalum ya lishe.'
          : 'Produce especially suited to people with particular nutritional needs.'}
      </p>

      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 mb-5">
        {GROUPS.map(g => {
          const Icon = g.icon
          const on = g.key === active
          return (
            <button
              key={g.key}
              onClick={() => setParams({ for: g.key })}
              aria-pressed={on}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap shrink-0 transition-colors ${
                on ? 'bg-brand-green text-white' : 'bg-[var(--c-card)] border border-[var(--c-border)] text-[var(--c-text-2)] hover:text-[var(--c-text)]'
              }`}
            >
              <Icon className="h-4 w-4" />
              {sw ? g.sw : g.en}
            </button>
          )
        })}
      </div>

      <div className="flex items-start gap-3 bg-[var(--c-card)] border border-[var(--c-border)] rounded-2xl p-4 mb-6">
        <group.icon className="h-5 w-5 text-brand-green shrink-0 mt-0.5" />
        <div>
          <p className="text-[var(--c-text)] font-semibold">{sw ? group.sw : group.en}</p>
          <p className="text-[var(--c-text-3)] text-sm">{sw ? group.swDesc : group.enDesc}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-72 rounded-2xl" />)}
        </div>
      ) : !data?.length ? (
        <div className="text-center py-16">
          <p className="text-[var(--c-text)] font-semibold">
            {sw ? 'Bado hakuna mazao hapa' : 'No produce listed here yet'}
          </p>
          <p className="text-[var(--c-text-3)] text-sm mt-1">
            {sw
              ? 'Wakulima wanaweza kuweka alama hii wanapoongeza bidhaa.'
              : 'Farmers can add this tag when they list a product.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {data.map(p => <FeedProductCard key={p._id} product={p} />)}
        </div>
      )}

      <p className="flex items-start gap-2 text-[var(--c-text-4)] text-xs mt-8 max-w-2xl">
        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        {sw
          ? 'Alama hizi zinawekwa na wakulima wenyewe na si ushauri wa kitabibu. Kwa mahitaji maalum ya lishe, wasiliana na mtaalamu wa afya.'
          : 'These tags are set by the farmers themselves and are not medical advice. For specific dietary needs, consult a health professional.'}
      </p>
    </div>
  )
}
