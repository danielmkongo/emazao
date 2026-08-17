import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '@/components/ui/language-switcher'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})
type FormData = z.infer<typeof schema>

export default function Login() {
  const { t } = useTranslation()
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
        {/* Shared <Logo>, same as the landing page and app sidebar. These pages used
            a generic sprout glyph plus a typed wordmark, so the whole auth flow
            looked like a different product from the one users came from. */}
        <Link to="/" className="flex items-center justify-center mb-10">
          <Logo className="h-20 w-auto" />
        </Link>

        <div className="glass rounded-2xl p-8 shadow-xl">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-[var(--c-text)] mb-2">{t('auth.welcomeBack')}</h1>
            <p className="text-[var(--c-text-3)] text-sm">{t('auth.signInSubtitle')}</p>
          </div>

          {error && (
            <div className="mb-6 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <Input
              {...register('email')}
              label={t('auth.email')}
              type="email"
              placeholder="you@example.com"
              leftIcon={<Mail className="h-4 w-4" />}
              error={errors.email?.message}
            />

            <Input
              {...register('password')}
              label={t('auth.password')}
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

            <div className="flex justify-end -mt-2">
              <Link to="/forgot-password" className="text-xs text-brand-green hover:underline font-medium">
                {t('auth.forgotPassword')}
              </Link>
            </div>

            <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
              {t('auth.signInButton')}
            </Button>
          </form>

          <p className="text-center text-sm text-[var(--c-text-3)] mt-6">
            {t('auth.noAccount')}{' '}
            <Link to="/register" className="text-brand-green hover:underline font-medium">
              {t('auth.createOne')}
            </Link>
          </p>

          {/* Dev-only: advertising working credentials on a public login page invites
              anyone to sign in as a seeded account. Vite statically replaces
              import.meta.env.DEV with false for `vite build`, so this block is
              dropped from the production bundle entirely rather than just hidden. */}
          {import.meta.env.DEV && (
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
          )}
        </div>

        {/* Offered before sign-in: a Swahili-first farmer shouldn't have to read
            an English form to find the language toggle. */}
        <div className="mt-6 max-w-[240px] mx-auto">
          <LanguageSwitcher variant="compact" />
        </div>
      </motion.div>
    </div>
  )
}
