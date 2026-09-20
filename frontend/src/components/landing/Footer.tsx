import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'

const groups = [
  { title: 'explore', items: [['socialCommerce', '/#social-commerce'], ['nav.howItWorks', '/#how-it-works'], ['nav.buyerRequests', '/#buyer-requests'], ['nav.marketplace', '/marketplace']] },
  { title: 'farmers', items: [['openStorefront', '/register?intent=sell'], ['findDemand', '/#buyer-requests'], ['nav.signIn', '/login']] },
  { title: 'buyers', items: [['sourceProduce', '/register?intent=buy'], ['publishDemand', '/register?intent=buy'], ['exploreMarket', '/marketplace']] },
] as const

/** Keys under landing.nav are shared with the top bar; the rest are footer-only. */
const labelKey = (k: string) => (k.startsWith('nav.') ? `landing.${k}` : `landing.footer.${k}`)

const contacts = [
  { key: 'sales', phone: '255754660033' },
  { key: 'support', phone: '255742414757' },
] as const
const formatPhone = (phone: string) => `+${phone.slice(0, 3)} ${phone.slice(3, 6)} ${phone.slice(6, 9)} ${phone.slice(9)}`

export const Footer = ({ onVisibilityChange }: { onVisibilityChange?: (visible: boolean) => void }) => {
  const { t } = useTranslation()
  return (
  <motion.footer onViewportEnter={() => onVisibilityChange?.(true)} onViewportLeave={() => onVisibilityChange?.(false)} viewport={{ amount: 0.08 }} className="bg-[#07110c] px-5 pb-8 pt-20 sm:px-8 lg:px-12">
    <div className="mx-auto max-w-[1440px]">
      <div className="grid gap-14 border-b border-white/10 pb-16 lg:grid-cols-[1.2fr_2fr]">
        <div>
          <Link to="/" aria-label={t('landing.nav.home')} className="inline-flex"><Logo className="h-32 w-auto" /></Link>
          <p className="mt-5 max-w-sm text-lg leading-7 text-white/60">{t('landing.footer.tagline')}</p>
        </div>
        <div className="grid grid-cols-2 gap-9 sm:grid-cols-4">
          {groups.map(({ title, items }) => <div key={title}><h3 className="text-xs font-bold uppercase tracking-[.18em] text-white/45">{t(`landing.footer.${title}`)}</h3><ul className="mt-6 space-y-4">{items.map(([label, to]) => <li key={label}><Link to={to} className="group inline-flex items-center gap-1 text-sm text-white/65 hover:text-white">{t(labelKey(label))}<ArrowUpRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" /></Link></li>)}</ul></div>)}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[.18em] text-white/45">{t('landing.footer.contact')}</h3>
            <ul className="mt-6 space-y-4">{contacts.map(({ key, phone }) => <li key={phone}><p className="mb-1 text-xs text-white/40">{t(`landing.footer.${key}`)}</p><a href={`https://wa.me/${phone}`} target="_blank" rel="noopener noreferrer" className="group inline-flex items-center gap-1 text-sm text-white/65 hover:text-white">{formatPhone(phone)}<ArrowUpRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" /></a></li>)}</ul>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-3 pt-7 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between"><p>{t('landing.footer.copyright')}</p><p>{t('landing.footer.builtFor')}</p></div>
    </div>
  </motion.footer>
  )
}
