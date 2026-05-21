import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail, Lock, User, Sprout } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'
import { cn } from '@/lib/utils'

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['BUYER', 'FARMER', 'BUSINESS_BUYER']),
})
type FormData = z.infer<typeof schema>

const roles = [
  { value: 'BUYER', label: 'Buyer', desc: 'Browse and purchase products', icon: '🛒' },
  { value: 'FARMER', label: 'Farmer / Seller', desc: 'Sell crops and build your storefront', icon: '🌾' },
  { value: 'BUSINESS_BUYER', label: 'Business Buyer', desc: 'Hotels, restaurants, exporters', icon: '🏢' },
] as const

export default function Register() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [error, setError] = useState('')

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'BUYER' },
  })

  const selectedRole = watch('role')

  const onSubmit = async (data: FormData) => {
    try {
      setError('')
      const res = await api.post('/auth/register', data)
      const { user, accessToken, refreshToken } = res.data.data
      setAuth(user, accessToken, refreshToken)
      navigate('/onboarding')
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      setError(e.response?.data?.message || 'Registration failed')
    }
  }

  return (
    <div className="min-h-screen bg-brand-dark flex items-center justify-center p-6">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-brand-green/8 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md"
      >
        <Link to="/" className="flex items-center justify-center gap-2 mb-10">
          <div className="h-10 w-10 rounded-xl bg-brand-green flex items-center justify-center">
            <Sprout className="h-5 w-5 text-white" />
          </div>
          <span className="text-2xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
            EMAZAO
          </span>
        </Link>

        <div className="glass rounded-2xl p-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white mb-2">Create your account</h1>
            <p className="text-white/50 text-sm">Join 50,000+ farmers and buyers on EMAZAO</p>
          </div>

          {error && (
            <div className="mb-6 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Role selection */}
            <div>
              <label className="text-sm font-medium text-white/70 mb-3 block">I am a...</label>
              <div className="grid grid-cols-1 gap-2">
                {roles.map(({ value, label, desc, icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setValue('role', value)}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-xl border text-left transition-all',
                      selectedRole === value
                        ? 'border-brand-green bg-brand-green/10 text-white'
                        : 'border-white/10 bg-white/[0.03] text-white/50 hover:border-white/20'
                    )}
                  >
                    <span className="text-2xl">{icon}</span>
                    <div>
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs opacity-60">{desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <Input
              {...register('name')}
              label="Full Name"
              placeholder="John Mwangi"
              leftIcon={<User className="h-4 w-4" />}
              error={errors.name?.message}
            />
            <Input
              {...register('email')}
              label="Email"
              type="email"
              placeholder="you@example.com"
              leftIcon={<Mail className="h-4 w-4" />}
              error={errors.email?.message}
            />
            <Input
              {...register('password')}
              label="Password"
              type="password"
              placeholder="Min. 6 characters"
              leftIcon={<Lock className="h-4 w-4" />}
              error={errors.password?.message}
            />

            <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
              Create Account
            </Button>
          </form>

          <p className="text-center text-sm text-white/40 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-lime hover:underline">Sign in</Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
