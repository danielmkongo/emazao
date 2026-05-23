import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, Globe, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'

const countries = ['Tanzania', 'Kenya', 'Nigeria', 'Ghana', 'Uganda', 'Ethiopia', 'South Africa', 'Rwanda', 'Other']
const categories = ['🍅 Tomatoes', '🌽 Maize', '🥬 Vegetables', '🍌 Fruits', '🌾 Grains', '🥛 Dairy', '🐔 Poultry', '🌿 Herbs', '🛠 Tools', '🌱 Seeds']

export default function Onboarding() {
  const navigate = useNavigate()
  const { user, updateUser } = useAuthStore()
  const [step, setStep] = useState(0)
  const [country, setCountry] = useState('')
  const [region, setRegion] = useState('')
  const [interests, setInterests] = useState<string[]>([])
  const [farmName, setFarmName] = useState('')
  const [saving, setSaving] = useState(false)

  const isFarmer = user?.role === 'FARMER'
  const totalSteps = isFarmer ? 3 : 2

  const toggleInterest = (cat: string) =>
    setInterests((prev) => prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat])

  const finish = async () => {
    setSaving(true)
    try {
      await api.put('/users/me', { country, region, onboardingDone: true })
      if (isFarmer && farmName) {
        await api.put('/users/me/seller-profile', { farmName, farmLocation: `${region}, ${country}`, specializations: interests })
        await api.put('/users/me', { role: 'FARMER' })
      }
      updateUser({ onboardingDone: true, country, region })
      navigate('/feed')
    } finally {
      setSaving(false)
    }
  }

  const steps = [
    {
      title: 'Where are you based?',
      content: (
        <div className="space-y-4">
          <div>
            <label className="text-sm text-[var(--c-text-3)] mb-2 block">Country</label>
            <div className="grid grid-cols-2 gap-2">
              {countries.map((c) => (
                <button
                  key={c}
                  onClick={() => setCountry(c)}
                  className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                    country === c ? 'bg-brand-green/15 border-brand-green text-brand-green' : 'border-[var(--c-border)] text-[var(--c-text-3)] hover:border-brand-green/40'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <Input
            label="Region / City"
            placeholder="e.g. Dar es Salaam"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            leftIcon={<MapPin className="h-4 w-4" />}
          />
        </div>
      ),
      canNext: !!country,
    },
    {
      title: 'What are your interests?',
      content: (
        <div className="grid grid-cols-2 gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => toggleInterest(cat)}
              className={`px-3 py-3 rounded-xl text-sm font-medium transition-all border text-left ${
                interests.includes(cat) ? 'bg-brand-green/15 border-brand-green text-brand-green' : 'border-[var(--c-border)] text-[var(--c-text-3)] hover:border-brand-green/40'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      ),
      canNext: true,
    },
    ...(isFarmer ? [{
      title: 'Name your farm',
      content: (
        <div className="space-y-4">
          <Input
            label="Farm Name"
            placeholder="e.g. Sunrise Valley Farm"
            value={farmName}
            onChange={(e) => setFarmName(e.target.value)}
            leftIcon={<Globe className="h-4 w-4" />}
          />
          <p className="text-sm text-[var(--c-text-4)]">This is your storefront name visible to all buyers.</p>
        </div>
      ),
      canNext: farmName.length >= 3,
    }] : []),
  ]

  const currentStep = steps[step]!

  return (
    <div className="min-h-screen bg-[var(--c-bg)] flex items-center justify-center p-6 transition-colors duration-200">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-brand-green/8 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all ${i <= step ? 'bg-brand-green' : 'bg-[var(--c-border)]'}`}
            />
          ))}
        </div>

        <div className="glass rounded-2xl p-8">
          <div className="mb-8">
            <p className="text-brand-lime text-sm mb-2">Step {step + 1} of {totalSteps}</p>
            <h1 className="text-2xl font-bold text-[var(--c-text)]">{currentStep.title}</h1>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              {currentStep.content}
            </motion.div>
          </AnimatePresence>

          <div className="flex gap-3 mt-8">
            {step > 0 && (
              <Button variant="secondary" onClick={() => setStep(s => s - 1)} className="flex-1">
                Back
              </Button>
            )}
            {step < totalSteps - 1 ? (
              <Button
                onClick={() => setStep(s => s + 1)}
                disabled={!currentStep.canNext}
                className="flex-1"
              >
                Continue
              </Button>
            ) : (
              <Button onClick={finish} loading={saving} className="flex-1">
                <CheckCircle className="h-4 w-4" /> Finish Setup
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
