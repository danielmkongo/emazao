import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Search, ShieldCheck, Ban } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { timeAgo } from '@/lib/utils'
import api from '@/lib/api'
import type { ApiResponse, User } from '@/types'

export default function AdminUsers() {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', search, roleFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (roleFilter) params.set('role', roleFilter)
      params.set('limit', '50')
      const res = await api.get<ApiResponse<User[]>>(`/users?${params}`)
      return res.data.data
    },
  })

  const verifyMutation = useMutation({
    mutationFn: ({ userId, verifiedType }: { userId: string; verifiedType: string }) =>
      api.put(`/admin/users/${userId}/verify`, { verifiedType }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  const suspendMutation = useMutation({
    mutationFn: (userId: string) => api.put(`/admin/users/${userId}/suspend`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  const ROLES = ['BUYER', 'FARMER', 'BUSINESS_BUYER', 'LOGISTICS', 'ADMIN']

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-white">Users</h1>
        <div className="flex gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..."
              className="pl-9 pr-4 py-2 bg-brand-800 border border-white/10 rounded-xl text-white text-sm placeholder-white/30 focus:outline-none focus:border-brand-green w-48" />
          </div>
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
            className="px-3 py-2 bg-brand-800 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-brand-green">
            <option value="">All roles</option>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : (
        <div className="bg-brand-800 rounded-2xl border border-white/[0.06] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left px-4 py-3 text-xs text-white/40 font-medium">User</th>
                <th className="text-left px-4 py-3 text-xs text-white/40 font-medium">Role</th>
                <th className="text-left px-4 py-3 text-xs text-white/40 font-medium">Status</th>
                <th className="text-left px-4 py-3 text-xs text-white/40 font-medium">Joined</th>
                <th className="text-right px-4 py-3 text-xs text-white/40 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((u, i) => (
                <motion.tr key={u._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                  className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar src={u.avatar} name={u.name} size="sm" verified={u.isVerified} />
                      <div>
                        <p className="text-white text-sm font-medium">{u.name}</p>
                        <p className="text-white/30 text-xs">@{u.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><Badge variant="outline" className="text-xs">{u.role}</Badge></td>
                  <td className="px-4 py-3">
                    <Badge variant={u.isVerified ? 'default' : 'outline'} className="text-xs">
                      {u.isVerified ? (u.verifiedType ?? 'Verified') : 'Unverified'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-white/30 text-xs">{timeAgo(u.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {!u.isVerified && (
                        <Button size="xs" variant="ghost" className="text-brand-green"
                          onClick={() => verifyMutation.mutate({ userId: u._id, verifiedType: 'ID_VERIFIED' })}>
                          <ShieldCheck className="h-3.5 w-3.5" /> Verify
                        </Button>
                      )}
                      <Button size="xs" variant="ghost" className="text-red-400"
                        onClick={() => suspendMutation.mutate(u._id)}>
                        <Ban className="h-3.5 w-3.5" /> Suspend
                      </Button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          {!data?.length && (
            <div className="text-center py-12 text-white/30">No users found</div>
          )}
        </div>
      )}
    </div>
  )
}
