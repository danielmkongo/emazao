import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail, Lock, User, ShoppingBasket, Wheat, Building2 } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'
import { cn } from '@/lib/utils'

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['BUYER', 'FARMER', 'BUSINESS_BUYER']),
})
type FormData = z.infer<typeof schema>

// Line icons rather than emoji: emoji render differently on every platform,
// can't inherit the selected/unselected colour, and read as placeholder art.
const roles = [
  { value: 'BUYER',          label: 'auth.roleBuyer',  desc: 'auth.roleBuyerDesc', icon: ShoppingBasket },
  { value: 'FARMER',         label: 'auth.roleFarmer', desc: 'auth.roleFarmerDesc',   icon: Wheat },
  { value: 'BUSINESS_BUYER', label: 'auth.roleBusiness', desc: 'auth.roleBusinessDesc',   icon: Building2 },
] as const

export default function Register() {
  const { t } = useTranslation()
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
    <div className="min-h-screen bg-[var(--c-bg)] flex items-center justify-center p-6 transition-colors duration-200">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-brand-green/6 rounded-full blur-3xl" />
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
            <h1 className="text-2xl font-bold text-[var(--c-text)] mb-2">{t('auth.createAccount')}</h1>
            <p className="text-[var(--c-text-3)] text-sm">{t('auth.registerSubtitle')}</p>
          </div>

          {error && (
            <div className="mb-6 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="text-sm font-medium text-[var(--c-text-2)] mb-3 block">{t('auth.iAmA')}</label>
              <div className="grid grid-cols-1 gap-2">
                {roles.map(({ value, label, desc, icon: Icon }) => {
                  const active = selectedRole === value
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setValue('role', value)}
                      aria-pressed={active}
                      className={cn(
                        'flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all duration-200',
                        active
                          ? 'border-brand-green bg-brand-green/8 text-[var(--c-text)] ring-2 ring-brand-green/15'
                          : 'border-[var(--c-border)] bg-[var(--c-input)] text-[var(--c-text-2)] hover:border-brand-green/40'
                      )}
                    >
                      <span
                        className={cn(
                          'h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors duration-200',
                          active ? 'bg-brand-green text-white' : 'bg-[var(--c-raised)] text-[var(--c-text-3)]'
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{t(label)}</p>
                        <p className="text-xs text-[var(--c-text-3)] leading-snug">{t(desc)}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <Input {...register('name')} label={t('auth.fullName')} placeholder="John Mwangi" leftIcon={<User className="h-4 w-4" />} error={errors.name?.message} />
            <Input {...register('email')} label={t('auth.email')} type="email" placeholder="you@example.com" leftIcon={<Mail className="h-4 w-4" />} error={errors.email?.message} />
            <Input {...register('password')} label={t('auth.password')} type="password" placeholder={t('auth.passwordMin')} leftIcon={<Lock className="h-4 w-4" />} error={errors.password?.message} />

            <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
              {t('auth.createAccountButton')}
            </Button>
          </form>

          <p className="text-center text-sm text-[var(--c-text-3)] mt-6">
            {t('auth.haveAccount')}{' '}
            <Link to="/login" className="text-brand-green hover:underline font-medium">Sign in</Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
