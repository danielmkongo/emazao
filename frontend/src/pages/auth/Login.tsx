import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail, Lock, Eye, EyeOff, Sprout } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})
type FormData = z.infer<typeof schema>

export default function Login() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    try {
      setError('')
      const res = await api.post('/auth/login', data)
      const { user, accessToken, refreshToken } = res.data.data
      setAuth(user, accessToken, refreshToken)
      navigate(user.onboardingDone ? '/feed' : '/onboarding')
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      setError(e.response?.data?.message || 'Login failed')
    }
  }

  return (
    <div className="min-h-screen bg-[var(--c-bg)] flex items-center justify-center p-6 transition-colors duration-200">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 right-1/3 w-96 h-96 bg-brand-green/6 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 left-1/4 w-80 h-80 bg-gold/5 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md"
      >
        <Link to="/" className="flex items-center justify-center gap-2 mb-10">
          <div className="h-10 w-10 rounded-xl bg-brand-green flex items-center justify-center shadow-lg shadow-brand-green/25">
            <Sprout className="h-5 w-5 text-white" />
          </div>
          <span className="text-2xl font-bold text-[var(--c-text)]" style={{ fontFamily: 'var(--font-display)' }}>
            eMazao
          </span>
        </Link>

        <div className="glass rounded-2xl p-8 shadow-xl">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-[var(--c-text)] mb-2">Welcome back</h1>
            <p className="text-[var(--c-text-3)] text-sm">Sign in to your account to continue trading</p>
          </div>

          {error && (
            <div className="mb-6 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
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
              type={showPass ? 'text' : 'password'}
              placeholder="••••••••"
              leftIcon={<Lock className="h-4 w-4" />}
              rightIcon={
                <button type="button" onClick={() => setShowPass(!showPass)}>
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
              error={errors.password?.message}
            />

            <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
              Sign In
            </Button>
          </form>

          <p className="text-center text-sm text-[var(--c-text-3)] mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-brand-green hover:underline font-medium">
              Create one
            </Link>
          </p>

          <div className="mt-4 pt-4 border-t border-[var(--c-border)]">
            <p className="text-xs text-[var(--c-text-4)] text-center mb-2">Demo accounts (password: Demo1234!)</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-[var(--c-text-3)]">
              <div className="bg-[var(--c-input)] rounded-lg p-2">
                <p className="font-medium text-[var(--c-text-2)]">Farmer</p>
                <p>james@emazao.demo</p>
              </div>
              <div className="bg-[var(--c-input)] rounded-lg p-2">
                <p className="font-medium text-[var(--c-text-2)]">Buyer</p>
                <p>sarah@emazao.demo</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
