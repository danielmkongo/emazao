import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Search, ShieldCheck, Ban, KeyRound, Copy, Check, X } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { timeAgo, verifiedLabel } from '@/lib/utils'
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
      const res = await api.get<ApiResponse<User[]>>(`/admin/users?${params}`)
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

  // Support flow for "the reset email never arrived". The server issues the same
  // expiring token as self-service and returns a link to read out or paste to
  // the user — it never sets a password, so an admin cannot take over an account.
  const [resetLink, setResetLink] = useState<{ email: string; link: string; expiresAt: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const resetMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await api.post<ApiResponse<{ resetLink: string; expiresAt: string; email: string }>>(
        `/admin/users/${userId}/password-reset`
      )
      return res.data.data
    },
    onSuccess: (d) => {
      if (d) setResetLink({ email: d.email, link: d.resetLink, expiresAt: d.expiresAt })
      queryClient.invalidateQueries({ queryKey: ['admin-audit'] })
    },
  })

  const unsuspendMutation = useMutation({
    mutationFn: (userId: string) => api.put(`/admin/users/${userId}/unsuspend`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  const ROLES = ['BUYER', 'FARMER', 'BUSINESS_BUYER', 'LOGISTICS', 'ADMIN']

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-[var(--c-text)]">Users</h1>
        <div className="flex gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--c-text-3)]" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..."
              className="pl-9 pr-4 py-2 bg-[var(--c-input)] border border-[var(--c-border)] rounded-xl text-[var(--c-text)] text-sm placeholder:text-[var(--c-text-3)] focus:outline-none focus:border-brand-green w-48" />
          </div>
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
            className="px-3 py-2 bg-[var(--c-input)] border border-[var(--c-border)] rounded-xl text-[var(--c-text)] text-sm focus:outline-none focus:border-brand-green">
            <option value="">All roles</option>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : (
        <div className="bg-[var(--c-card)] rounded-2xl border border-[var(--c-border)] overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-[var(--c-border)]">
                <th className="text-left px-4 py-3 text-xs text-[var(--c-text-3)] font-medium">User</th>
                <th className="text-left px-4 py-3 text-xs text-[var(--c-text-3)] font-medium">Role</th>
                <th className="text-left px-4 py-3 text-xs text-[var(--c-text-3)] font-medium">Status</th>
                <th className="text-left px-4 py-3 text-xs text-[var(--c-text-3)] font-medium">Joined</th>
                <th className="text-right px-4 py-3 text-xs text-[var(--c-text-3)] font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((u, i) => (
                <motion.tr key={u._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                  className="border-b border-[var(--c-border-sub)] last:border-0 hover:bg-[var(--c-input)]/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar src={u.avatar} name={u.name} size="sm" verified={u.isVerified} />
                      <div>
                        <p className="text-[var(--c-text)] text-sm font-medium">{u.name}</p>
                        <p className="text-[var(--c-text-3)] text-xs">@{u.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><Badge variant="outline" className="text-xs">{u.role}</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Badge variant={u.isVerified ? 'default' : 'outline'} className="text-xs">
                        {u.isVerified ? verifiedLabel(u.verifiedType) : 'Unverified'}
                      </Badge>
                      {u.isSuspended && <Badge variant="urgent" className="text-xs">Suspended</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[var(--c-text-3)] text-xs">{timeAgo(u.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {!u.isVerified && (
                        <Button size="xs" variant="ghost" className="text-brand-green"
                          onClick={() => verifyMutation.mutate({ userId: u._id, verifiedType: 'ID_VERIFIED' })}>
                          <ShieldCheck className="h-3.5 w-3.5" /> Verify
                        </Button>
                      )}
                      <Button size="xs" variant="ghost" className="text-[var(--c-text-3)]"
                        disabled={resetMutation.isPending}
                        onClick={() => resetMutation.mutate(u._id)}>
                        <KeyRound className="h-3.5 w-3.5" /> Reset link
                      </Button>
                      {u.isSuspended ? (
                        <Button size="xs" variant="ghost" className="text-brand-green"
                          onClick={() => unsuspendMutation.mutate(u._id)}>
                          <ShieldCheck className="h-3.5 w-3.5" /> Unsuspend
                        </Button>
                      ) : (
                        <Button size="xs" variant="ghost" className="text-red-400"
                          onClick={() => suspendMutation.mutate(u._id)}>
                          <Ban className="h-3.5 w-3.5" /> Suspend
                        </Button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          {!data?.length && (
            <div className="text-center py-12 text-[var(--c-text-3)]">No users found</div>
          )}
        </div>
      )}

      {/* One-time reset link. Shown once, here, rather than emailed — this exists
          precisely for the case where the user's email is not reaching them. */}
      {resetLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setResetLink(null)} />
          <div className="relative w-full max-w-lg bg-[var(--c-card)] border border-[var(--c-border)] rounded-2xl shadow-2xl p-5 z-10">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="font-semibold text-[var(--c-text)]">Password reset link</h2>
                <p className="text-[var(--c-text-3)] text-sm mt-0.5">For {resetLink.email}</p>
              </div>
              <button onClick={() => setResetLink(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--c-text-3)] hover:bg-[var(--c-raised)] hover:text-[var(--c-text)]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="bg-[var(--c-input)] border border-[var(--c-border)] rounded-xl p-3 mb-3">
              <p className="text-[var(--c-text-2)] text-xs break-all font-mono">{resetLink.link}</p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  void navigator.clipboard.writeText(resetLink.link)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                }}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-brand-green text-white text-sm font-semibold hover:bg-brand-emerald transition-colors"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied' : 'Copy link'}
              </button>
              <p className="text-[var(--c-text-4)] text-xs">
                Expires {new Date(resetLink.expiresAt).toLocaleTimeString()}. Single use.
              </p>
            </div>

            <p className="text-[var(--c-text-4)] text-xs mt-4 leading-relaxed">
              Send this only to the account owner, after you are satisfied they are who they say they
              are. Issuing it has been recorded in the audit log against your account.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
