import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { X, Camera, Images, Type, Tag, Loader2, ChevronRight, Check } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { formatCurrency } from '@/lib/utils'
import api from '@/lib/api'
import { useStoryUI, refreshStories, STORY_BACKGROUNDS, type StoryBackground } from '@/lib/stories'
import type { ApiResponse, Product } from '@/types'

type Mode = 'pick' | 'media' | 'text'

export default function StoryComposer() {
  const open = useStoryUI(s => s.composerOpen)
  if (!open) return null
  return createPortal(<Composer />, document.body)
}

function Composer() {
  const { t } = useTranslation()
  const close = useStoryUI(s => s.closeComposer)
  const me = useAuthStore(s => s.user)
  const isSeller = me?.role === 'FARMER'

  const [mode, setMode] = useState<Mode>('pick')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [caption, setCaption] = useState('')
  const [bg, setBg] = useState<StoryBackground>('harvest')
  const [product, setProduct] = useState<Product | null>(null)
  const [picking, setPicking] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const isVideo = !!file?.type.startsWith('video/')

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [close])

  const onFile = (f?: File | null) => {
    if (!f) return
    if (!/^(image|video)\//.test(f.type)) { setError(t('stories.badFile')); return }
    if (f.size > 100 * 1024 * 1024) { setError(t('stories.tooBig')); return }
    setError(null)
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setMode('media')
  }

  const canShare = mode === 'media' ? !!file : mode === 'text' ? !!text.trim() : false

  const share = async () => {
    if (!canShare || progress !== null) return
    setError(null)
    try {
      let mediaUrl: string | undefined
      if (mode === 'media' && file) {
        setProgress(0)
        const form = new FormData()
        form.append('file', file)
        const res = await api.post<ApiResponse<{ url: string }>>(isVideo ? '/upload/video' : '/upload/image', form, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: e => e.total && setProgress(Math.round((e.loaded / e.total) * 100)),
        })
        mediaUrl = res.data.data.url
      }
      setProgress(100)
      await api.post('/stories', mode === 'media'
        ? { mediaUrl, mediaType: isVideo ? 'VIDEO' : 'IMAGE', caption: caption.trim() || undefined, productId: product?._id }
        : { text: text.trim(), background: bg, productId: product?._id })
      refreshStories()
      close()
    } catch (err: any) {
      setProgress(null)
      setError(err?.response?.data?.message ?? t('stories.shareFailed'))
    }
  }

  return (
    <motion.div className="fixed inset-0 z-[80] bg-black flex items-center justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} role="dialog" aria-modal="true" aria-label={t('stories.new')}>
      <input ref={cameraRef} type="file" accept="image/*,video/*" capture="environment" className="hidden" onChange={e => onFile(e.target.files?.[0])} />
      <input ref={galleryRef} type="file" accept="image/*,video/*" className="hidden" onChange={e => onFile(e.target.files?.[0])} />

      <div className="relative w-full h-full md:w-auto md:h-[min(92vh,920px)] md:aspect-[9/16] md:rounded-2xl overflow-hidden bg-neutral-950 flex flex-col">
        {/* Canvas */}
        <div className="absolute inset-0">
          {mode === 'media' && preview && (isVideo
            ? <video src={preview} autoPlay loop muted playsInline className="w-full h-full object-cover" />
            : <img src={preview} alt="" className="w-full h-full object-cover" />)}
          {mode === 'text' && (
            <div className="w-full h-full flex items-center justify-center p-8" style={{ background: STORY_BACKGROUNDS[bg] }}>
              <textarea
                autoFocus
                value={text}
                onChange={e => setText(e.target.value.slice(0, 280))}
                placeholder={t('stories.textPlaceholder')}
                rows={5}
                className="w-full bg-transparent text-white text-center font-bold resize-none placeholder:text-white/60 focus:outline-none leading-tight"
                style={{ fontFamily: 'var(--font-display)', fontSize: text.length > 120 ? 24 : text.length > 50 ? 30 : 38 }}
              />
            </div>
          )}
          {mode === 'pick' && (
            <div className="w-full h-full flex flex-col items-center justify-center gap-4 px-8"
              style={{ background: 'radial-gradient(120% 80% at 50% 0%, #14532d 0%, #052e16 45%, #000 100%)' }}>
              <p className="text-white text-2xl font-bold text-center mb-4" style={{ fontFamily: 'var(--font-display)' }}>{t('stories.whatToShare')}</p>
              <PickButton icon={Camera} label={t('stories.camera')} hint={t('stories.cameraHint')} onClick={() => cameraRef.current?.click()} />
              <PickButton icon={Images} label={t('stories.gallery')} hint={t('stories.galleryHint')} onClick={() => galleryRef.current?.click()} />
              <PickButton icon={Type} label={t('stories.text')} hint={t('stories.textHint')} onClick={() => setMode('text')} />
            </div>
          )}
        </div>

        {/* Top bar */}
        <div className="relative z-10 flex items-center justify-between px-2 pt-[calc(env(safe-area-inset-top,0px)+8px)]">
          <button onClick={mode === 'pick' ? close : () => { setMode('pick'); setFile(null); setPreview(null) }}
            aria-label={t('common.close')} className="w-11 h-11 rounded-full flex items-center justify-center text-white bg-black/30 backdrop-blur press">
            <X className="h-6 w-6" />
          </button>
          {mode === 'text' && (
            <div className="flex gap-2 pr-2" role="radiogroup" aria-label={t('stories.background')}>
              {(Object.keys(STORY_BACKGROUNDS) as StoryBackground[]).map(k => (
                <button key={k} onClick={() => setBg(k)} role="radio" aria-checked={bg === k} aria-label={k}
                  className={`w-7 h-7 rounded-full border-2 press ${bg === k ? 'border-white scale-110' : 'border-white/40'}`}
                  style={{ background: STORY_BACKGROUNDS[k] }} />
              ))}
            </div>
          )}
        </div>

        {/* Tagged product */}
        {product && mode !== 'pick' && (
          <div className="relative z-10 mt-auto mb-3 mx-auto flex items-center gap-2.5 pl-1.5 pr-2 py-1.5 rounded-2xl bg-white/95 text-black shadow-2xl max-w-[82%]">
            {product.images?.[0] && <img src={product.images[0]} alt="" className="w-10 h-10 rounded-xl object-cover" />}
            <span className="min-w-0">
              <span className="block text-[12.5px] font-semibold truncate">{product.title}</span>
              <span className="block text-[12.5px] font-bold text-brand-green tabular">{formatCurrency(product.price)}</span>
            </span>
            <button onClick={() => setProduct(null)} aria-label={t('stories.untag')} className="w-7 h-7 rounded-full flex items-center justify-center text-black/60 hover:bg-black/5">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Bottom */}
        {mode !== 'pick' && (
          <div className={`relative z-10 ${product ? '' : 'mt-auto'} px-3 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] pt-8 bg-gradient-to-t from-black/70 to-transparent space-y-3`}>
            {error && <p className="text-center text-sm text-red-300 font-medium">{error}</p>}
            {mode === 'media' && (
              <input value={caption} onChange={e => setCaption(e.target.value.slice(0, 200))} placeholder={t('stories.captionPlaceholder')}
                className="w-full h-11 rounded-full bg-black/35 border border-white/25 px-4 text-white text-[14px] placeholder:text-white/65 focus:outline-none focus:border-white/70 backdrop-blur" />
            )}
            <div className="flex items-center gap-2">
              {isSeller && (
                <button onClick={() => setPicking(true)}
                  className="h-12 px-4 rounded-full bg-white/15 backdrop-blur text-white text-[14px] font-semibold flex items-center gap-2 press">
                  <Tag className="h-[18px] w-[18px]" /> {product ? t('stories.changeProduct') : t('stories.tagProduct')}
                </button>
              )}
              <button onClick={share} disabled={!canShare || progress !== null}
                className="ml-auto h-12 pl-3 pr-5 rounded-full bg-white text-black text-[14px] font-bold flex items-center gap-2.5 disabled:opacity-50 press">
                {me?.avatar ? <img src={me.avatar} alt="" className="w-7 h-7 rounded-full object-cover" /> : <span className="w-7 h-7 rounded-full bg-brand-green" />}
                {progress !== null ? <><Loader2 className="h-4 w-4 animate-spin" /> {progress < 100 ? `${progress}%` : t('stories.sharing')}</> : <>{t('stories.yourStory')} <ChevronRight className="h-4 w-4 -ml-1" /></>}
              </button>
            </div>
          </div>
        )}
        {mode === 'pick' && error && <p className="relative z-10 mt-auto mb-10 text-center text-sm text-red-300 font-medium">{error}</p>}

        <AnimatePresence>
          {picking && <ProductPicker sellerId={me!._id} selected={product?._id} onPick={p => { setProduct(p); setPicking(false) }} onClose={() => setPicking(false)} />}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

function PickButton({ icon: Icon, label, hint, onClick }: { icon: typeof Camera; label: string; hint: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="w-full max-w-xs flex items-center gap-4 p-4 rounded-2xl bg-white/[0.08] hover:bg-white/[0.12] border border-white/10 text-left press">
      <span className="w-12 h-12 rounded-xl bg-gradient-to-br from-harvest to-brand-green flex items-center justify-center flex-shrink-0">
        <Icon className="h-6 w-6 text-white" />
      </span>
      <span>
        <span className="block text-white font-semibold text-[15px]">{label}</span>
        <span className="block text-white/60 text-[12.5px]">{hint}</span>
      </span>
    </button>
  )
}

function ProductPicker({ sellerId, selected, onPick, onClose }: {
  sellerId: string; selected?: string; onPick: (p: Product) => void; onClose: () => void
}) {
  const { t } = useTranslation()
  const { data, isLoading } = useQuery({
    queryKey: ['my-products-for-story', sellerId],
    queryFn: async () => (await api.get<ApiResponse<Product[]>>(`/products?sellerId=${sellerId}&limit=50`)).data.data ?? [],
  })
  return (
    <>
      <motion.div className="absolute inset-0 bg-black/50 z-20" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div className="absolute inset-x-0 bottom-0 z-30 rounded-t-3xl bg-neutral-900 text-white max-h-[70%] flex flex-col pb-[env(safe-area-inset-bottom,0px)]"
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 420, damping: 40 }}>
        <div className="w-10 h-1 rounded-full bg-white/25 mx-auto mt-2.5 flex-shrink-0" />
        <p className="px-5 py-3 font-semibold flex-shrink-0">{t('stories.tagProduct')}</p>
        <div className="overflow-y-auto px-2 pb-3">
          {isLoading ? <div className="py-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-white/60" /></div>
            : !data?.length ? <p className="py-8 text-center text-white/60 text-sm">{t('stories.noProducts')}</p>
            : data.map(p => (
              <button key={p._id} onClick={() => onPick(p)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-left">
                {p.images?.[0] ? <img src={p.images[0]} alt="" className="w-12 h-12 rounded-xl object-cover" /> : <span className="w-12 h-12 rounded-xl bg-white/10" />}
                <span className="flex-1 min-w-0">
                  <span className="block text-[14px] font-medium truncate">{p.title}</span>
                  <span className="block text-[13px] text-brand-lime font-semibold tabular">{formatCurrency(p.price)} / {p.priceUnit}</span>
                </span>
                {selected === p._id && <Check className="h-5 w-5 text-brand-lime" />}
              </button>
            ))}
        </div>
      </motion.div>
    </>
  )
}
