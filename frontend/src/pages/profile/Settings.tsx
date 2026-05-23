import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { User, Lock, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  bio: z.string().max(160, 'Bio max 160 characters').optional(),
  location: z.string().optional(),
  country: z.string().optional(),
})

type FormData = z.infer<typeof schema>

export default function Settings() {
  const { user, updateUser, clearAuth } = useAuthStore()

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: user?.name ?? '',
      bio: user?.bio ?? '',
      location: user?.location ?? '',
      country: user?.country ?? '',
    },
  })

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await api.put('/users/me', data)
      return res.data.data
    },
    onSuccess: (updatedUser) => updateUser(updatedUser),
  })

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-[var(--c-text)] mb-8">Settings</h1>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="bg-[var(--c-card)] rounded-2xl border border-[var(--c-border)] p-6 mb-4">
        <h2 className="font-semibold text-[var(--c-text)] mb-6 flex items-center gap-2">
          <User className="h-4 w-4 text-brand-green" /> Profile Information
        </h2>

        <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
          <Input label="Display Name" placeholder="Your full name" error={errors.name?.message} {...register('name')} />

          <div>
            <label className="block text-sm font-medium text-[var(--c-text-2)] mb-1.5">Bio</label>
            <textarea {...register('bio')} rows={3} maxLength={160}
              placeholder="Tell people about yourself..."
              className="w-full bg-[var(--c-input)] border border-[var(--c-border)] rounded-xl px-4 py-3 text-[var(--c-text)] placeholder:text-[var(--c-text-3)] focus:outline-none focus:border-brand-green resize-none" />
            {errors.bio && <p className="text-red-400 text-xs mt-1">{errors.bio.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Location" placeholder="City, Country" {...register('location')} />
            <Input label="Country" placeholder="Country" {...register('country')} />
          </div>

          {mutation.isSuccess && (
            <p className="text-brand-green text-sm">Profile updated successfully</p>
          )}

          <Button type="submit" loading={mutation.isPending}>Save Changes</Button>
        </form>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="bg-[var(--c-card)] rounded-2xl border border-[var(--c-border)] p-6">
        <h2 className="font-semibold text-[var(--c-text)] mb-4 flex items-center gap-2">
          <Lock className="h-4 w-4 text-red-400" /> Account
        </h2>
        <Button variant="destructive" onClick={() => clearAuth()} className="w-full">
          <LogOut className="h-4 w-4" /> Sign Out
        </Button>
      </motion.div>
    </div>
  )
}
