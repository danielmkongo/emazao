import { create } from 'zustand'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { queryClient } from '@/lib/queryClient'
import api from '@/lib/api'
import type { ApiResponse, User } from '@/types'

export type StoryBackground = 'harvest' | 'sunrise' | 'soil' | 'rain' | 'night'

export interface StoryProduct {
  _id: string
  title: string
  price: number
  priceUnit: string
  images: string[]
  slug?: string
}

export interface Story {
  _id: string
  userId: string
  mediaUrl?: string
  mediaType?: 'IMAGE' | 'VIDEO'
  text?: string
  background?: StoryBackground
  caption?: string
  productId?: StoryProduct | null
  viewCount: number
  reactionCount: number
  seen: boolean
  expiresAt: string
  createdAt: string
}

export interface StoryGroup {
  user: Pick<User, '_id' | 'name' | 'username' | 'avatar' | 'isVerified' | 'role'>
  stories: Story[]
  allSeen: boolean
  latestAt: string
  suggested?: boolean
}

/** Quick reactions offered under a story. Must match the server's list. */
export const STORY_REACTIONS = ['❤️', '🔥', '😍', '👏', '😂', '😮', '🌾', '💰']

/** Text-story backdrops, named for what they look like on a farm. */
export const STORY_BACKGROUNDS: Record<StoryBackground, string> = {
  harvest: 'linear-gradient(160deg, #F59E0B 0%, #EA580C 45%, #9A3412 100%)',
  sunrise: 'linear-gradient(160deg, #FDE68A 0%, #F59E0B 40%, #16A34A 100%)',
  soil:    'linear-gradient(160deg, #78350F 0%, #451A03 60%, #1C0A00 100%)',
  rain:    'linear-gradient(160deg, #0EA5E9 0%, #0F766E 55%, #064E3B 100%)',
  night:   'linear-gradient(160deg, #0B3D2C 0%, #052E16 50%, #000000 100%)',
}

// ─── Viewer / composer state ────────────────────────────────────────────────
// Kept in a store rather than a route so a story can open over whatever page
// you are on — the feed rail, a profile, a message — and closing it puts you
// back exactly where you were, scroll position and all.

interface StoryUIState {
  groups: StoryGroup[]
  groupIndex: number
  viewerOpen: boolean
  composerOpen: boolean
  openViewer: (groups: StoryGroup[], groupIndex?: number) => void
  closeViewer: () => void
  setGroupIndex: (i: number) => void
  openComposer: () => void
  closeComposer: () => void
}

export const useStoryUI = create<StoryUIState>((set) => ({
  groups: [],
  groupIndex: 0,
  viewerOpen: false,
  composerOpen: false,
  openViewer: (groups, groupIndex = 0) => { if (groups.length) set({ groups, groupIndex, viewerOpen: true }) },
  closeViewer: () => set({ viewerOpen: false }),
  setGroupIndex: (groupIndex) => set({ groupIndex }),
  openComposer: () => set({ composerOpen: true }),
  closeComposer: () => set({ composerOpen: false }),
}))

// ─── Data ───────────────────────────────────────────────────────────────────

export function useStoryFeed() {
  const user = useAuthStore((s) => s.user)
  return useQuery({
    queryKey: ['stories', 'feed', user?._id],
    queryFn: async () => (await api.get<ApiResponse<StoryGroup[]>>('/stories/feed')).data.data ?? [],
    enabled: !!user,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  })
}

/** One person's active stories — drives the ring on their avatar anywhere. */
export function useUserStories(userId?: string) {
  return useQuery({
    queryKey: ['stories', 'user', userId],
    queryFn: async () => (await api.get<ApiResponse<StoryGroup | null>>(`/stories/user/${userId}`)).data.data,
    enabled: !!userId,
    staleTime: 60_000,
  })
}

/**
 * Mark a story seen locally in every cached copy, so the ring greys out the
 * moment you watch it rather than on the next refetch.
 */
export function markStorySeenLocally(storyId: string) {
  const patch = (g: StoryGroup | null | undefined) => {
    if (!g) return g
    let changed = false
    const stories = g.stories.map(s => (s._id === storyId && !s.seen ? ((changed = true), { ...s, seen: true }) : s))
    return changed ? { ...g, stories, allSeen: stories.every(s => s.seen) } : g
  }
  queryClient.setQueriesData<StoryGroup[]>({ queryKey: ['stories', 'feed'] }, old => old?.map(g => patch(g)!))
  queryClient.setQueriesData<StoryGroup | null>({ queryKey: ['stories', 'user'] }, old => patch(old) ?? old)
}

export function refreshStories() {
  queryClient.invalidateQueries({ queryKey: ['stories'] })
}
