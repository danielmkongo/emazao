import { useTranslation } from 'react-i18next'

// Real WhatsApp glyph rather than a generic chat-bubble icon (lucide has no
// brand icons) — recognizable at a glance is the whole point of this button.
function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="currentColor" className={className}>
      <path d="M16.004 3C9.1 3 3.5 8.6 3.5 15.5c0 2.34.64 4.53 1.76 6.42L3 29l7.27-2.2a12.4 12.4 0 0 0 5.73 1.4h.005c6.9 0 12.5-5.6 12.5-12.5S22.9 3 16.004 3Zm0 22.7h-.004a10.3 10.3 0 0 1-5.24-1.44l-.376-.223-3.9 1.18 1.2-3.8-.245-.39a10.24 10.24 0 0 1-1.58-5.52c0-5.68 4.63-10.3 10.32-10.3 2.76 0 5.35 1.07 7.3 3.02a10.24 10.24 0 0 1 3.02 7.3c0 5.68-4.63 10.3-10.5 10.16Zm5.66-7.72c-.31-.155-1.83-.9-2.11-1.005-.283-.104-.49-.155-.696.156-.207.31-.8 1.005-.98 1.212-.18.207-.36.233-.67.078-.31-.155-1.31-.483-2.494-1.538-.922-.822-1.545-1.838-1.726-2.148-.18-.31-.02-.478.136-.632.14-.14.31-.362.465-.543.155-.18.207-.31.31-.517.104-.207.052-.388-.026-.543-.078-.155-.696-1.677-.954-2.297-.251-.603-.507-.521-.696-.53l-.593-.01c-.207 0-.543.078-.827.388-.283.31-1.083 1.058-1.083 2.58 0 1.522 1.109 2.994 1.264 3.201.155.207 2.183 3.335 5.29 4.676.739.319 1.316.51 1.766.653.742.236 1.417.203 1.951.123.595-.089 1.83-.748 2.088-1.47.259-.723.259-1.343.181-1.47-.078-.128-.284-.207-.594-.362Z" />
    </svg>
  )
}

/**
 * Floating direct-line to WhatsApp — visitors browsing the landing page
 * before signing up get an immediate, human way to ask a question instead of
 * the only options being "read more sections" or "create an account".
 */
export function WhatsAppButton({ phone = '255754660033', hidden = false }: { phone?: string; hidden?: boolean }) {
  const { t } = useTranslation()
  return (
    <a
      href={`https://wa.me/${phone}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t('landing.whatsapp.aria')}
      title={t('landing.whatsapp.title')}
      // Fixed-position, so it floats over whatever content happens to be
      // underneath — the footer already lists both numbers directly, so the
      // button hides once it's in view instead of sitting on top of that
      // same text. Bumped up on mobile (bottom-24 vs bottom-7) since there's
      // no bottom nav on this logged-out page to reserve that corner, and the
      // hero's mobile product-preview card sits close to it.
      className={`fixed bottom-24 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-xl shadow-black/30 transition-all hover:scale-105 active:scale-95 sm:bottom-7 sm:right-7 ${
        hidden ? 'opacity-0 pointer-events-none translate-y-2' : 'opacity-100'
      }`}
    >
      <span className="absolute inset-0 animate-ping rounded-full bg-[#25D366] opacity-40 motion-reduce:animate-none" />
      <WhatsAppGlyph className="relative h-7 w-7" />
    </a>
  )
}
