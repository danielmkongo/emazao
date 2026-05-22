import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { MapPin, Package, DollarSign, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import api from '@/lib/api'

const schema = z.object({
  title: z.string().min(5, 'Title too short'),
  description: z.string().min(20, 'Please be more descriptive'),
  productType: z.string().min(2),
  quantityAmount: z.coerce.number().positive(),
  quantityUnit: z.string().min(1),
  deliveryLocation: z.string().min(3),
  deliveryFrequency: z.string().optional(),
  budgetMin: z.coerce.number().optional(),
  budgetMax: z.coerce.number().optional(),
  preferredQuality: z.string().optional(),
  deadline: z.string().optional(),
  isUrgent: z.boolean().optional(),
})
type FormData = z.infer<typeof schema>

const units = ['kg', 'ton', 'crate', 'bag', 'pallet', 'container']
const frequencies = ['One-time', 'Weekly', 'Bi-weekly', 'Monthly', 'Seasonal']

export default function PostRequirement() {
  const navigate = useNavigate()
  const [error, setError] = useState('')

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any,
    defaultValues: { quantityUnit: 'ton', isUrgent: false },
  })

  const isUrgent = watch('isUrgent')

  const onSubmit = async (data: FormData) => {
    try {
      setError('')
      const res = await api.post('/requirements', data)
      navigate(`/requirements/${res.data.data._id}`)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      setError(e.response?.data?.message || 'Failed to post requirement')
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: 'var(--font-display)' }}>
            Post a Requirement
          </h1>
          <p className="text-white/40 text-sm">Describe what you need. Farmers will bid with their best offers.</p>
        </div>

        {error && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-6">
          {/* Basic info */}
          <div className="bg-brand-800 rounded-2xl border border-white/[0.06] p-6 space-y-5">
            <h2 className="font-semibold text-white">Basic Information</h2>
            <Input {...register('title')} label="Requirement Title" placeholder="e.g. 5 Tons of Fresh Tomatoes Weekly" error={errors.title?.message} />
            <Input {...register('productType')} label="Product Type" placeholder="e.g. Tomatoes, Maize, Fruits..." error={errors.productType?.message} />
            <div>
              <label className="text-sm font-medium text-white/70 mb-1.5 block">Description</label>
              <textarea
                {...register('description')}
                rows={4}
                placeholder="Describe quality requirements, packaging preferences, any certifications needed..."
                className="w-full bg-brand-700 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:border-brand-green resize-none"
              />
              {errors.description && <p className="text-xs text-red-400 mt-1">{errors.description.message}</p>}
            </div>
          </div>

          {/* Quantity & Delivery */}
          <div className="bg-brand-800 rounded-2xl border border-white/[0.06] p-6 space-y-5">
            <h2 className="font-semibold text-white">Quantity & Delivery</h2>
            <div className="grid grid-cols-2 gap-4">
              <Input {...register('quantityAmount')} label="Quantity" type="number" placeholder="100" leftIcon={<Package className="h-4 w-4" />} error={errors.quantityAmount?.message} />
              <div>
                <label className="text-sm font-medium text-white/70 mb-1.5 block">Unit</label>
                <select
                  {...register('quantityUnit')}
                  className="w-full h-11 bg-brand-700 border border-white/10 rounded-xl px-4 text-white text-sm focus:outline-none focus:border-brand-green"
                >
                  {units.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <Input {...register('deliveryLocation')} label="Delivery Location" placeholder="e.g. Dar es Salaam, Tanzania" leftIcon={<MapPin className="h-4 w-4" />} error={errors.deliveryLocation?.message} />
            <div>
              <label className="text-sm font-medium text-white/70 mb-1.5 block">Delivery Frequency</label>
              <div className="flex flex-wrap gap-2">
                {frequencies.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setValue('deliveryFrequency', f)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      watch('deliveryFrequency') === f
                        ? 'bg-brand-green/15 border-brand-green text-brand-lime'
                        : 'border-white/10 text-white/40 hover:border-white/20'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Budget */}
          <div className="bg-brand-800 rounded-2xl border border-white/[0.06] p-6 space-y-5">
            <h2 className="font-semibold text-white">Budget & Timeline</h2>
            <div className="grid grid-cols-2 gap-4">
              <Input {...register('budgetMin')} label="Min Budget (USD)" type="number" placeholder="500" leftIcon={<DollarSign className="h-4 w-4" />} />
              <Input {...register('budgetMax')} label="Max Budget (USD)" type="number" placeholder="2000" leftIcon={<DollarSign className="h-4 w-4" />} />
            </div>
            <Input {...register('deadline')} label="Deadline" type="date" leftIcon={<Calendar className="h-4 w-4" />} />
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                {...register('isUrgent')}
                className="w-4 h-4 accent-brand-green rounded"
              />
              <span className="text-sm text-white/70">Mark as urgent (requires faster response)</span>
            </label>
          </div>

          <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
            Post Requirement
          </Button>
        </form>
      </motion.div>
    </div>
  )
}
