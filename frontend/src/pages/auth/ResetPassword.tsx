import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Lock, Eye, EyeOff, Sprout, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import api from '@/lib/api'

const schema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  })
type FormData = z.infer<typeof schema>

export default function ResetPassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    if (!token) return
    try {
      setError('')
      await api.post('/auth/reset-password', { token, newPassword: data.password })
      navigate('/login')
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      setError(e.response?.data?.message || 'Something went wrong. Please try again.')
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
          {!token ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-red-500/10 border-2 border-red-500/40 flex items-center justify-center mx-auto mb-5">
                <AlertTriangle className="h-8 w-8 text-red-400" />
              </div>
              <h1 className="text-xl font-bold text-[var(--c-text)] mb-2">Invalid reset link</h1>
              <p className="text-[var(--c-text-3)] text-sm mb-6">
                This link is missing its reset token. Request a new one below.
              </p>
              <Link to="/forgot-password" className="text-brand-green hover:underline font-medium text-sm">
                Request a new link
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-[var(--c-text)] mb-2">Choose a new password</h1>
                <p className="text-[var(--c-text-3)] text-sm">Make sure it's at least 8 characters</p>
              </div>

              {error && (
                <div className="mb-6 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <Input
                  {...register('password')}
                  label="New password"
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

                <Input
                  {...register('confirmPassword')}
                  label="Confirm password"
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  leftIcon={<Lock className="h-4 w-4" />}
                  error={errors.confirmPassword?.message}
                />

                <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
                  Reset Password
                </Button>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}
