import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'

export default function VerifyOtp() {
  const navigate = useNavigate()
  const { updateUser } = useAuthStore()
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const inputs = useRef<(HTMLInputElement | null)[]>([])

  const handleChange = (i: number, val: string) => {
    if (!/^\d?$/.test(val)) return
    const next = [...otp]
    next[i] = val
    setOtp(next)
    if (val && i < 5) inputs.current[i + 1]?.focus()
  }

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) inputs.current[i - 1]?.focus()
  }

  const verify = async () => {
    const code = otp.join('')
    if (code.length !== 6) return
    setLoading(true)
    try {
      await api.post('/auth/verify-otp', { otp: code })
      updateUser({ isVerified: true })
      navigate('/feed')
    } catch {
      setError('Invalid OTP. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-brand-dark flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="glass rounded-2xl p-8 text-center">
          <div className="h-16 w-16 rounded-2xl bg-brand-green/15 flex items-center justify-center mx-auto mb-6">
            <span className="text-3xl">📱</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Verify your account</h1>
          <p className="text-white/50 text-sm mb-8">Enter the 6-digit code sent to your email</p>

          {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

          <div className="flex justify-center gap-3 mb-8">
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputs.current[i] = el }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className="h-14 w-11 text-center text-xl font-bold bg-brand-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green/40 transition-all"
              />
            ))}
          </div>

          <Button className="w-full" size="lg" onClick={verify} loading={loading}>
            Verify
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
