import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Plus, Trash2, Eye, Heart, MessageSquare, Share2, X, Video, Tag, Upload, Loader2, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { formatNumber, timeAgo } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'
import type { ApiResponse, Reel, Product } from '@/types'

interface NewReelForm {
  title: string
  caption: string
  videoUrl: string
  thumbnailUrl: string
  tags: string
  productId: string
}

const EMPTY: NewReelForm = { title: '', caption: '', videoUrl: '', thumbnailUrl: '', tags: '', productId: '' }

export default function DashboardReels() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<NewReelForm>(EMPTY)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [uploadError, setUploadError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const { data: reels, isLoading } = useQuery({
    queryKey: ['my-reels', user?._id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Reel[]>>(`/reels/user/${user!._id}`)
      return res.data.data ?? []
    },
    enabled: !!user?._id,
  })

  const { data: products } = useQuery({
    queryKey: ['my-products-select', user?._id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Product[]>>(`/products?sellerId=${user!._id}&status=all&limit=50`)
      return res.data.data ?? []
    },
    enabled: !!user?._id,
    staleTime: 30_000,
  })

  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError('')
    setUploading(true)
    setUploadProgress('Uploading video…')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await api.post<{ success: boolean; data: { url: string; thumbnailUrl: string } }>(
        '/upload/video', formData, { headers: { 'Content-Type': 'multipart/form-data' } }
      )
      setForm(f => ({ ...f, videoUrl: res.data.data.url, thumbnailUrl: res.data.data.thumbnailUrl ?? '' }))
      setUploadProgress('Video ready!')
    } catch {
      setUploadError('Upload failed. Try a smaller file or check your connection.')
      setUploadProgress('')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post('/reels', {
        title: form.title,
        caption: form.caption,
        videoUrl: form.videoUrl,
        thumbnailUrl: form.thumbnailUrl || undefined,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        productId: form.productId || undefined,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-reels', user?._id] })
      setForm(EMPTY)
      setUploadProgress('')
      setShowForm(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (reelId: string) => api.delete(`/reels/${reelId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-reels', user?._id] }),
  })

  const handleDelete = (reelId: string, title?: string) => {
    if (!confirm(`Delete "${title ?? 'this reel'}"? This cannot be undone.`)) return
    deleteMutation.mutate(reelId)
  }

  const openForm = () => { setForm(EMPTY); setUploadProgress(''); setUploadError(''); setShowForm(true) }

  const canSubmit = form.title.trim() && form.videoUrl.trim() && !uploading

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--c-text)]">My Reels</h1>
          <p className="text-sm text-[var(--c-text-3)] mt-0.5">{reels?.length ?? 0} video{reels?.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={openForm}><Plus className="h-4 w-4" /> Upload Reel</Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="aspect-[9/16] rounded-2xl" />)}
        </div>
      ) : !reels?.length ? (
        <div className="text-center py-24 border-2 border-dashed border-[var(--c-border)] rounded-2xl">
          <div className="w-16 h-16 rounded-2xl bg-[var(--c-raised)] flex items-center justify-center mx-auto mb-4">
            <Video className="h-7 w-7 text-[var(--c-text-4)]" />
          </div>
          <p className="text-[var(--c-text)] font-semibold mb-1">No reels yet</p>
          <p className="text-[var(--c-text-3)] text-sm mb-4">Upload a video to showcase your farm and products</p>
          <Button onClick={openForm}><Plus className="h-4 w-4" /> Upload your first reel</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {reels.map((reel, i) => (
            <motion.div key={reel._id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="relative group bg-[var(--c-card)] rounded-2xl border border-[var(--c-border)] overflow-hidden">
              <div className="relative aspect-[9/16] bg-[var(--c-input)] overflow-hidden">
                {reel.thumbnailUrl ? (
                  <img src={reel.thumbnailUrl} alt={reel.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-brand-green/20 to-brand-emerald/10">
                    <Play className="h-12 w-12 text-white/60" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                <a href={reel.videoUrl} target="_blank" rel="noopener noreferrer"
                  className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center">
                    <ExternalLink className="h-6 w-6 text-white" />
                  </div>
                </a>
                <button onClick={() => handleDelete(reel._id, reel.title)} disabled={deleteMutation.isPending}
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-all">
                  <Trash2 className="h-4 w-4" />
                </button>
                <div className="absolute bottom-3 left-3 right-3">
                  <p className="text-white font-semibold text-sm mb-1.5 line-clamp-1">{reel.title}</p>
                  <div className="flex items-center gap-3 text-xs text-white/80">
                    <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{formatNumber(reel.viewCount ?? 0)}</span>
                    <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{formatNumber(reel.likeCount ?? 0)}</span>
                    <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{formatNumber(reel.commentCount ?? 0)}</span>
                    <span className="flex items-center gap-1"><Share2 className="h-3 w-3" />{formatNumber(reel.shareCount ?? 0)}</span>
                  </div>
                </div>
              </div>
              <div className="px-4 py-3">
                <p className="text-xs text-[var(--c-text-4)]">{timeAgo(reel.createdAt)}</p>
                {reel.caption && <p className="text-xs text-[var(--c-text-3)] mt-1 line-clamp-2">{reel.caption}</p>}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) setShowForm(false) }}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowForm(false)} />
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="relative w-full max-w-lg bg-[var(--c-card)] border border-[var(--c-border)] rounded-2xl shadow-2xl z-10 max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--c-border)]">
                <h2 className="font-bold text-[var(--c-text)] text-lg">Upload Reel</h2>
                <button onClick={() => setShowForm(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--c-text-3)] hover:bg-[var(--c-raised)] transition-colors cursor-pointer">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* Video file picker */}
                <div>
                  <label className="text-sm font-medium text-[var(--c-text-2)] mb-1.5 block">Video File *</label>
                  <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={handleVideoSelect} />

                  {!form.videoUrl ? (
                    <button
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      className="w-full border-2 border-dashed border-[var(--c-border)] hover:border-brand-green/50 rounded-xl p-8 flex flex-col items-center gap-3 transition-colors cursor-pointer disabled:opacity-60"
                    >
                      {uploading ? (
                        <><Loader2 className="h-8 w-8 text-brand-green animate-spin" /><span className="text-sm text-[var(--c-text-3)]">{uploadProgress}</span></>
                      ) : (
                        <><Upload className="h-8 w-8 text-[var(--c-text-4)]" /><span className="text-sm text-[var(--c-text-3)]">Tap to choose a video</span><span className="text-xs text-[var(--c-text-4)]">MP4, MOV, WebM — max 100MB</span></>
                      )}
                    </button>
                  ) : (
                    <div className="flex items-center gap-3 bg-brand-green/8 border border-brand-green/20 rounded-xl px-4 py-3">
                      <Video className="h-5 w-5 text-brand-green flex-shrink-0" />
                      <span className="text-sm text-brand-green flex-1 truncate">Video uploaded successfully</span>
                      <button onClick={() => { setForm(f => ({ ...f, videoUrl: '', thumbnailUrl: '' })); setUploadProgress('') }}
                        className="text-[var(--c-text-4)] hover:text-red-400 transition-colors cursor-pointer">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                  {uploadError && <p className="text-red-400 text-xs mt-1">{uploadError}</p>}
                </div>

                <Input label="Title *" placeholder="e.g. Harvesting our organic tomatoes"
                  value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />

                <div>
                  <label className="text-sm font-medium text-[var(--c-text-2)] mb-1.5 block">Caption</label>
                  <textarea rows={3} placeholder="Describe what's in your video…"
                    value={form.caption} onChange={e => setForm(f => ({ ...f, caption: e.target.value }))}
                    className="w-full bg-[var(--c-input)] border border-[var(--c-border)] rounded-xl px-4 py-3 text-[var(--c-text)] placeholder:text-[var(--c-text-4)] text-sm focus:outline-none focus:border-brand-green resize-none transition-colors" />
                </div>

                <div>
                  <label className="text-sm font-medium text-[var(--c-text-2)] mb-1.5 flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5 text-[var(--c-text-4)]" /> Tags
                  </label>
                  <input type="text" placeholder="tomatoes, organic, harvest (comma-separated)"
                    value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                    className="w-full bg-[var(--c-input)] border border-[var(--c-border)] rounded-xl px-4 py-3 text-[var(--c-text)] placeholder:text-[var(--c-text-4)] text-sm focus:outline-none focus:border-brand-green transition-colors" />
                </div>

                {products && products.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-[var(--c-text-2)] mb-1.5 block">Link to Product (optional)</label>
                    <select value={form.productId} onChange={e => setForm(f => ({ ...f, productId: e.target.value }))}
                      className="w-full bg-[var(--c-input)] border border-[var(--c-border)] rounded-xl px-4 py-3 text-[var(--c-text)] text-sm focus:outline-none focus:border-brand-green transition-colors cursor-pointer">
                      <option value="">No product linked</option>
                      {products.map(p => <option key={p._id} value={p._id}>{p.title}</option>)}
                    </select>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button variant="secondary" onClick={() => setShowForm(false)} className="flex-1">Cancel</Button>
                  <Button onClick={() => createMutation.mutate()} loading={createMutation.isPending}
                    disabled={!canSubmit} className="flex-1">
                    <Video className="h-4 w-4" /> Publish Reel
                  </Button>
                </div>

                {createMutation.isError && (
                  <p className="text-red-400 text-xs text-center">
                    {(createMutation.error as any)?.response?.data?.message ?? 'Failed to publish reel'}
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
