import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Radio } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { useAuthStore } from '@/store/authStore'
import { getSocket } from '@/lib/socket'
import api from '@/lib/api'
import type { ApiResponse } from '@/types'

interface LiveSession {
  _id: string
  broadcasterId: { _id: string; name: string; username: string; avatar?: string; isVerified?: boolean }
  title: string
  viewerCount: number
}

export const LiveNowRow = () => {
  const { user } = useAuthStore()
  const [sessions, setSessions] = useState<LiveSession[]>([])

  const { data } = useQuery({
    queryKey: ['live-sessions'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<LiveSession[]>>('/live')
      return res.data.data ?? []
    },
    refetchInterval: 30_000,
  })

  useEffect(() => {
    if (data) setSessions(data)
  }, [data])

  // Real-time: add/remove sessions as they start/end
  useEffect(() => {
    if (!user?._id) return
    const socket = getSocket(user._id)

    socket.on('live:new', (session: LiveSession) => {
      setSessions(prev => {
        const alreadyIn = prev.some(s => s.broadcasterId._id === (session.broadcasterId as any)?._id ?? session.broadcasterId)
        return alreadyIn ? prev : [session, ...prev]
      })
    })

    socket.on('live:removed', ({ broadcasterId }: { broadcasterId: string }) => {
      setSessions(prev => prev.filter(s => s.broadcasterId._id !== broadcasterId))
    })

    return () => {
      socket.off('live:new')
      socket.off('live:removed')
    }
  }, [user?._id])

  if (!sessions.length) return null

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="mb-5 overflow-hidden"
    >
      <div className="flex items-center gap-2 mb-3">
        <motion.div
          className="h-2 w-2 rounded-full bg-red-500 flex-shrink-0"
          animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
          transition={{ duration: 1.4, repeat: Infinity }}
        />
        <span className="text-sm font-semibold text-[var(--c-text)]">Live Now</span>
        <span className="text-xs text-[var(--c-text-3)]">{sessions.length} {sessions.length === 1 ? 'stream' : 'streams'}</span>
      </div>

      <div className="flex gap-5 overflow-x-auto no-scrollbar pb-1">
        <AnimatePresence>
          {sessions.map(session => {
            const b = session.broadcasterId
            return (
              <motion.div
                key={session._id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                className="flex-shrink-0"
              >
                <Link to={`/live/${b._id}`} className="flex flex-col items-center gap-1.5 cursor-pointer">
                  <div className="relative">
                    {/* Pulsing outer ring */}
                    <div className="absolute inset-[-3px] rounded-full border-2 border-red-500/50 animate-ping" />
                    {/* Solid red border */}
                    <div className="relative rounded-full border-[2.5px] border-red-500 p-0.5">
                      <Avatar src={b.avatar} name={b.name} size="md" verified={b.isVerified} />
                    </div>
                    {/* LIVE badge */}
                    <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 whitespace-nowrap shadow-md">
                      <Radio className="h-2 w-2" /> LIVE
                    </div>
                  </div>
                  <p className="text-[11px] text-[var(--c-text-2)] max-w-[64px] text-center truncate mt-1.5">
                    {b.name.split(' ')[0]}
                  </p>
                </Link>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
