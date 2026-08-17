import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail, CheckCircle2 } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import api from '@/lib/api'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
})
type FormData = z.infer<typeof schema>

export default function ForgotPassword() {
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    try {
      setError('')
      await api.post('/auth/forgot-password', data)
      setSent(true)
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
        {/* Shared <Logo>, same as the landing page and app sidebar. These pages used
            a generic sprout glyph plus a typed wordmark, so the whole auth flow
            looked like a different product from the one users came from. */}
        <Link to="/" className="flex items-center justify-center mb-10">
          <Logo className="h-20 w-auto" />
        </Link>

        <div className="glass rounded-2xl p-8 shadow-xl">
          {sent ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-brand-green/10 border-2 border-brand-green flex items-center justify-center mx-auto mb-5">
                <CheckCircle2 className="h-8 w-8 text-brand-green" />
              </div>
              <h1 className="text-xl font-bold text-[var(--c-text)] mb-2">Check your email</h1>
              <p className="text-[var(--c-text-3)] text-sm mb-6">
                If that email is registered, we've sent a link to reset your password. It expires in 30 minutes.
              </p>
              <Link to="/login" className="text-brand-green hover:underline font-medium text-sm">
                Back to Sign In
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-[var(--c-text)] mb-2">Forgot password?</h1>
                <p className="text-[var(--c-text-3)] text-sm">Enter your email and we'll send you a reset link</p>
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

                <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
                  Send Reset Link
                </Button>
              </form>

              <p className="text-center text-sm text-[var(--c-text-3)] mt-6">
                Remembered your password?{' '}
                <Link to="/login" className="text-brand-green hover:underline font-medium">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}
