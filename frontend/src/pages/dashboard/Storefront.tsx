import { useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { Store, MapPin, Ruler, Truck, Award, Sprout, CheckCircle, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'
import type { ApiResponse } from '@/types'

interface SellerProfile {
  _id: string
  farmName: string
  farmDescription: string
  farmSize: number
  farmLocation: string
  specializations: string[]
  certifications: string[]
  deliveryRadius: number
  storeSlug: string
  isActive: boolean
}

interface FormData {
  farmName: string
  farmDescription: string
  farmSize: string
  farmLocation: string
  specializations: string
  certifications: string
  deliveryRadius: string
}

export default function DashboardStorefront() {
  const { user } = useAuthStore()

  const { data: profileData, isLoading } = useQuery({
    queryKey: ['seller-profile', user?.username],
    queryFn: async () => {
      const res = await api.get<ApiResponse<{ user: any; sellerProfile: SellerProfile | null }>>(`/users/${user!.username}`)
      return res.data.data
    },
    enabled: !!user?.username,
  })

  const { register, handleSubmit, reset, formState: { isDirty } } = useForm<FormData>()

  useEffect(() => {
    if (profileData?.sellerProfile) {
      const sp = profileData.sellerProfile
      reset({
        farmName: sp.farmName ?? '',
        farmDescription: sp.farmDescription ?? '',
        farmSize: sp.farmSize ? String(sp.farmSize) : '',
        farmLocation: sp.farmLocation ?? '',
        specializations: (sp.specializations ?? []).join(', '),
        certifications: (sp.certifications ?? []).join(', '),
        deliveryRadius: sp.deliveryRadius ? String(sp.deliveryRadius) : '',
      })
    }
  }, [profileData, reset])

  const saveMutation = useMutation({
    mutationFn: async (values: FormData) => {
      const payload = {
        farmName: values.farmName,
        farmDescription: values.farmDescription,
        farmSize: values.farmSize ? parseFloat(values.farmSize) : undefined,
        farmLocation: values.farmLocation,
        specializations: values.specializations.split(',').map(s => s.trim()).filter(Boolean),
        certifications: values.certifications.split(',').map(s => s.trim()).filter(Boolean),
        deliveryRadius: values.deliveryRadius ? parseFloat(values.deliveryRadius) : undefined,
      }
      const res = await api.put<ApiResponse<SellerProfile>>('/users/me/seller-profile', payload)
      return res.data.data
    },
    onSuccess: () => {
      reset(undefined, { keepValues: true })
    },
  })

  const onSubmit = handleSubmit(values => saveMutation.mutate(values))
  const storeSlug = profileData?.sellerProfile?.storeSlug

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--c-text)]">Storefront</h1>
          <p className="text-sm text-[var(--c-text-3)] mt-0.5">Manage how your farm appears to buyers</p>
        </div>
        {storeSlug && (
          <a
            href={`/farm/${user?.username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-brand-green hover:underline"
          >
            View storefront <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : (
        <motion.form
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={onSubmit}
          className="space-y-5"
        >
          {!profileData?.sellerProfile && (
            <div className="flex items-start gap-3 p-4 bg-brand-green/8 border border-brand-green/20 rounded-xl mb-4">
              <Store className="h-5 w-5 text-brand-green mt-0.5 shrink-0" />
              <p className="text-sm text-[var(--c-text-2)]">
                You haven't set up your storefront yet. Fill in the details below to create your farm's public profile.
              </p>
            </div>
          )}

          {/* Farm Identity */}
          <div className="bg-[var(--c-card)] rounded-2xl border border-[var(--c-border)] p-5 space-y-4">
            <h2 className="font-semibold text-[var(--c-text)] flex items-center gap-2">
              <Sprout className="h-4 w-4 text-brand-green" /> Farm Identity
            </h2>
            <Input
              label="Farm Name *"
              placeholder="e.g. Green Valley Organic Farm"
              {...register('farmName', { required: true })}
            />
            <div>
              <label className="text-sm font-medium text-[var(--c-text-2)] mb-1.5 block">
                Farm Description
              </label>
              <textarea
                rows={4}
                placeholder="Tell buyers about your farm, your growing practices, what makes you unique…"
                {...register('farmDescription')}
                className="w-full bg-[var(--c-input)] border border-[var(--c-border)] rounded-xl px-4 py-3 text-[var(--c-text)] placeholder:text-[var(--c-text-4)] text-sm focus:outline-none focus:border-brand-green resize-none transition-colors"
              />
            </div>
          </div>

          {/* Location & Logistics */}
          <div className="bg-[var(--c-card)] rounded-2xl border border-[var(--c-border)] p-5 space-y-4">
            <h2 className="font-semibold text-[var(--c-text)] flex items-center gap-2">
              <MapPin className="h-4 w-4 text-brand-green" /> Location & Logistics
            </h2>
            <Input
              label="Farm Location"
              placeholder="e.g. Nakuru, Kenya"
              {...register('farmLocation')}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Farm Size (hectares)"
                type="number"
                placeholder="e.g. 5"
                {...register('farmSize')}
              />
              <div>
                <label className="text-sm font-medium text-[var(--c-text-2)] mb-1.5 flex items-center gap-1.5 block">
                  <Truck className="h-3.5 w-3.5 text-[var(--c-text-4)]" /> Delivery Radius (km)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 50"
                  {...register('deliveryRadius')}
                  className="w-full bg-[var(--c-input)] border border-[var(--c-border)] rounded-xl px-4 py-3 text-[var(--c-text)] placeholder:text-[var(--c-text-4)] text-sm focus:outline-none focus:border-brand-green transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Products & Certifications */}
          <div className="bg-[var(--c-card)] rounded-2xl border border-[var(--c-border)] p-5 space-y-4">
            <h2 className="font-semibold text-[var(--c-text)] flex items-center gap-2">
              <Award className="h-4 w-4 text-brand-green" /> Products & Credentials
            </h2>
            <div>
              <label className="text-sm font-medium text-[var(--c-text-2)] mb-1.5 flex items-center gap-2 block">
                <Ruler className="h-3.5 w-3.5 text-[var(--c-text-4)]" /> Specializations
              </label>
              <input
                type="text"
                placeholder="tomatoes, maize, organic produce (comma-separated)"
                {...register('specializations')}
                className="w-full bg-[var(--c-input)] border border-[var(--c-border)] rounded-xl px-4 py-3 text-[var(--c-text)] placeholder:text-[var(--c-text-4)] text-sm focus:outline-none focus:border-brand-green transition-colors"
              />
              <p className="text-xs text-[var(--c-text-4)] mt-1">Separate with commas</p>
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--c-text-2)] mb-1.5 flex items-center gap-2 block">
                <CheckCircle className="h-3.5 w-3.5 text-[var(--c-text-4)]" /> Certifications
              </label>
              <input
                type="text"
                placeholder="Organic Certified, USDA, GlobalG.A.P (comma-separated)"
                {...register('certifications')}
                className="w-full bg-[var(--c-input)] border border-[var(--c-border)] rounded-xl px-4 py-3 text-[var(--c-text)] placeholder:text-[var(--c-text-4)] text-sm focus:outline-none focus:border-brand-green transition-colors"
              />
              <p className="text-xs text-[var(--c-text-4)] mt-1">Separate with commas</p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              type="submit"
              loading={saveMutation.isPending}
              disabled={!isDirty && !!profileData?.sellerProfile}
              className="flex-1"
            >
              {profileData?.sellerProfile ? 'Save Changes' : 'Create Storefront'}
            </Button>
          </div>

          {saveMutation.isSuccess && (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center text-sm text-brand-green"
            >
              Storefront saved successfully!
            </motion.p>
          )}

          {saveMutation.isError && (
            <p className="text-center text-sm text-red-400">
              {(saveMutation.error as any)?.response?.data?.message ?? 'Failed to save storefront'}
            </p>
          )}
        </motion.form>
      )}
    </div>
  )
}
