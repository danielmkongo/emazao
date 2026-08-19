import { ArrowUpRight, BadgeCheck, ClipboardList, Search } from 'lucide-react'
import { Link } from 'react-router-dom'

const buyerBenefits = [
  { icon: Search, title: 'Buy directly from the marketplace', text: 'Browse produce that is available now, compare suppliers and place an order directly with the right farmer.' },
  { icon: ClipboardList, title: 'Or let farmers come to you', text: 'Post the crop, quantity and delivery details you need, then receive offers from farmers ready to supply it.' },
  { icon: BadgeCheck, title: 'Buy with more confidence', text: 'Compare verified profiles, talk directly and use escrow-protected payments from agreement through delivery.' },
]

export const BuyerBenefitsSection = () => (
  <section className="bg-white px-5 py-24 text-[#102014] sm:px-8 lg:px-12 lg:py-28">
    <div className="mx-auto max-w-[1440px]">
      <div className="grid gap-8 lg:grid-cols-[.8fr_1.2fr] lg:items-end lg:gap-20">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[.22em] text-green-700">For buyers</p>
          <h2 className="mt-5 max-w-xl text-5xl font-semibold leading-[.95] tracking-[-.05em] sm:text-6xl" style={{ fontFamily: 'var(--font-display)' }}>
            Buy what&apos;s available—or post what you need.
          </h2>
        </div>
        <div className="lg:pb-1">
          <p className="max-w-xl text-lg leading-8 text-black/55 lg:mt-7">
            Shop available produce directly from farmers, or publish a buyer request and let qualified suppliers come to you. Either way, eMazao takes you from discovery to delivery in one place.
          </p>
          <Link to="/register?intent=buy" className="group mt-7 inline-flex w-full items-center justify-between gap-2 rounded-full bg-[#102014] px-6 py-3.5 font-bold text-white transition-transform hover:scale-[1.02] sm:w-fit sm:justify-start">
            Start buying on eMazao
            <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </div>
      </div>

      <figure className="relative mt-10 overflow-hidden rounded-[1.5rem] bg-[#102014] text-white shadow-[0_28px_70px_rgba(16,32,20,.16)] sm:rounded-[2rem] lg:mt-16">
        <div className="relative aspect-[1.15/1] sm:aspect-[16/9] lg:aspect-[2.15/1]">
          <img
            src="/buyer-emazao-success-v4.png"
            alt="Produce buyer smiling as he reviews an eMazao order beside a fresh delivery"
            className="absolute inset-0 h-full w-full object-cover object-[55%_center] sm:object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent sm:hidden" />
          <figcaption className="absolute inset-x-0 bottom-0 flex items-start gap-3 px-5 py-5 sm:hidden">
            <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#d9ff43] shadow-[0_0_0_5px_rgba(217,255,67,.16)]" />
            <div><p className="text-[10px] font-medium uppercase tracking-[.18em] text-[#d9ff43]">Order confirmed</p><p className="mt-1 text-sm text-white/80">The right produce. The right supplier.</p></div>
          </figcaption>
        </div>
        <figcaption className="hidden items-start gap-4 border-t border-white/10 px-6 py-5 sm:flex sm:items-center sm:px-7">
          <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#d9ff43] shadow-[0_0_0_5px_rgba(217,255,67,.12)] sm:mt-0" />
          <div className="sm:flex sm:items-baseline sm:gap-3">
            <p className="text-xs font-normal uppercase tracking-[.18em] text-[#d9ff43]">Order confirmed</p>
            <p className="mt-1 text-sm text-white/70 sm:mt-0">The right produce. The right supplier. No guesswork.</p>
          </div>
        </figcaption>
      </figure>

      <div className="-mx-5 mt-8 grid snap-x snap-mandatory auto-cols-[84%] grid-flow-col gap-3 overflow-x-auto px-5 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:-mx-8 sm:auto-cols-[48%] sm:px-8 lg:mx-0 lg:grid-flow-row lg:grid-cols-3 lg:gap-0 lg:overflow-visible lg:border-y lg:border-black/10 lg:px-0 lg:pb-0">
        {buyerBenefits.map(({ icon: Icon, title, text }, index) => (
          <div key={title} className={`snap-start rounded-2xl bg-[#f2f0e6] p-6 lg:rounded-none lg:bg-transparent lg:px-7 lg:py-8 ${index > 0 ? 'lg:border-l lg:border-black/10' : ''}`}>
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#102014] text-[#d9ff43]">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="mt-5 font-bold tracking-tight">{title}</h3>
            <p className="mt-2 max-w-sm leading-6 text-black/55">{text}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-center text-xs font-medium text-black/40 lg:hidden">Swipe to explore buyer benefits</p>
    </div>
  </section>
)
