import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Upload, X, ArrowLeft, Leaf } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import api from '@/lib/api'
import type { ApiResponse, Category } from '@/types'

const schema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  price: z.coerce.number().positive('Price must be positive'),
  priceUnit: z.string().min(1, 'Price unit is required'),
  minimumOrder: z.coerce.number().positive().default(1),
  availableStock: z.coerce.number().positive('Stock must be positive'),
  stockUnit: z.string().min(1, 'Stock unit is required'),
  condition: z.enum(['FRESH', 'PROCESSED', 'DRIED', 'FROZEN', 'SEEDS']),
  categoryId: z.string().min(1, 'Category is required'),
  origin: z.string().optional(),
  isOrganic: z.boolean().default(false),
  tags: z.string().optional(),
})

type FormData = z.infer<typeof schema>

const CONDITIONS = ['FRESH', 'PROCESSED', 'DRIED', 'FROZEN', 'SEEDS'] as const
const PRICE_UNITS = ['per kg', 'per ton', 'per crate', 'per bag', 'per litre', 'per unit', 'per dozen']

export default function AddProduct() {
  const navigate = useNavigate()
  const [images, setImages] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Category[]>>('/categories')
      return res.data.data
    },
  })

  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm<FormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any,
    defaultValues: { condition: 'FRESH', isOrganic: false, minimumOrder: 1 },
  })

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        ...data,
        images,
        tags: data.tags ? data.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      }
      const res = await api.post('/products', payload)
      return res.data
    },
    onSuccess: () => navigate('/dashboard/products'),
  })

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('file', file)
        const res = await api.post<ApiResponse<{ url: string }>>('/upload/image', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        setImages(prev => [...prev, res.data.data.url])
      }
    } finally {
      setUploading(false)
    }
  }

  const isOrganic = watch('isOrganic')

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-white/40 hover:text-white mb-6 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <h1 className="text-2xl font-bold text-white mb-8">Add New Product</h1>

      <form onSubmit={handleSubmit(d => mutation.mutate(d as FormData))} className="space-y-6">
        {/* Images */}
        <div>
          <p className="text-sm font-medium text-white/70 mb-3">Product Images</p>
          <div className="flex flex-wrap gap-3">
            {images.map((url, i) => (
              <div key={i} className="relative h-24 w-24 rounded-xl overflow-hidden">
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button type="button" onClick={() => setImages(prev => prev.filter((_, j) => j !== i))}
                  className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5">
                  <X className="h-3 w-3 text-white" />
                </button>
              </div>
            ))}
            {images.length < 6 && (
              <label className="h-24 w-24 rounded-xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center cursor-pointer hover:border-brand-green transition-colors">
                <Upload className="h-5 w-5 text-white/40" />
                <span className="text-xs text-white/40 mt-1">{uploading ? 'Uploading...' : 'Add photo'}</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} disabled={uploading} />
              </label>
            )}
          </div>
        </div>

        <Input label="Product Title" placeholder="e.g. Fresh Organic Tomatoes" error={errors.title?.message} {...register('title')} />

        <div>
          <label className="block text-sm font-medium text-white/70 mb-1.5">Description</label>
          <textarea {...register('description')} rows={3}
            placeholder="Describe your product, quality, growing conditions..."
            className="w-full bg-brand-800 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-brand-green resize-none" />
          {errors.description && <p className="text-red-400 text-xs mt-1">{errors.description.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="Price" type="number" step="0.01" placeholder="0.00" error={errors.price?.message} {...register('price')} />
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Price Unit</label>
            <select {...register('priceUnit')} className="w-full bg-brand-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-green">
              {PRICE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="Available Stock" type="number" placeholder="100" error={errors.availableStock?.message} {...register('availableStock')} />
          <Input label="Stock Unit" placeholder="kg / tons / crates" error={errors.stockUnit?.message} {...register('stockUnit')} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="Minimum Order" type="number" placeholder="1" error={errors.minimumOrder?.message} {...register('minimumOrder')} />
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Condition</label>
            <select {...register('condition')} className="w-full bg-brand-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-green">
              {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-white/70 mb-1.5">Category</label>
          <select {...register('categoryId')} className="w-full bg-brand-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-green">
            <option value="">Select category...</option>
            {categories?.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
          {errors.categoryId && <p className="text-red-400 text-xs mt-1">{errors.categoryId.message}</p>}
        </div>

        <Input label="Origin (optional)" placeholder="e.g. Nakuru, Kenya" {...register('origin')} />

        <Input label="Tags (comma separated)" placeholder="organic, tomatoes, fresh, export" {...register('tags')} />

        <label className="flex items-center gap-3 cursor-pointer">
          <div onClick={() => setValue('isOrganic', !isOrganic)}
            className={`w-12 h-6 rounded-full transition-colors flex items-center px-1 ${isOrganic ? 'bg-brand-green' : 'bg-white/10'}`}>
            <div className={`w-4 h-4 rounded-full bg-white transition-transform ${isOrganic ? 'translate-x-6' : ''}`} />
          </div>
          <span className="text-white flex items-center gap-2"><Leaf className="h-4 w-4 text-brand-green" />Certified Organic</span>
        </label>

        {mutation.isError && (
          <p className="text-red-400 text-sm">{(mutation.error as any)?.response?.data?.message || 'Failed to create product'}</p>
        )}

        <Button type="submit" className="w-full" size="lg" loading={mutation.isPending}>
          Publish Product
        </Button>
      </form>
    </div>
  )
}
