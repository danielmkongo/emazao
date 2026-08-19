import { useEffect, useState } from 'react'
import { RouterProvider } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { router } from '@/router'
import { useUIStore } from '@/store/uiStore'
import { useAuthStore } from '@/store/authStore'
import { useUnreadStore } from '@/store/unreadStore'
import { queryClient } from '@/lib/queryClient'
import CallModal, { useCallStore } from '@/components/layout/CallModal'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { getSocket } from '@/lib/socket'
import { playNotificationSound } from '@/lib/sound'
import { refreshUnreadMessages } from '@/hooks/useUnreadMessages'
import { useSocketEvent } from '@/hooks/useSocketEvent'

function ThemeApplier() {
  const theme = useUIStore((s) => s.theme)
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    // Recolor the browser/OS chrome (status bar with battery & clock on mobile,
    // installed-PWA title bar) to follow the app theme.
    const meta = document.querySelector('meta[name="theme-color"]')
    meta?.setAttribute('content', theme === 'dark' ? '#0A0F0D' : '#ffffff')
  }, [theme])
  return null
}

function GlobalCallHandler() {
  const { user } = useAuthStore()
  const { call, setCall } = useCallStore()

  useEffect(() => {
    if (!user?._id) return
    // Listen for outgoing call initiated from Profile page
    const handleCallOut = (e: Event) => {
      const { calleeId, calleeName, calleeAvatar, video } = (e as CustomEvent).detail
      const socket = getSocket()
      // Caller identity is derived server-side from the authenticated socket, not
      // trusted from the client, so only the callee + call type need to be sent.
      socket.emit('call:request', { calleeId, video })
      setCall({ type: 'calling', direction: 'outgoing', video, calleeId, calleeName, calleeAvatar })
    }
    window.addEventListener('emazao:call-out', handleCallOut)
    return () => window.removeEventListener('emazao:call-out', handleCallOut)
  }, [user?._id, setCall])

  return <CallModal call={call} setCall={setCall} />
}

// Live badges + sound for messages and notifications, mounted once for the
// whole app so they fire no matter which page the user is currently on —
// previously nothing subscribed to these events client-side, so a new message
// or notification produced no indication at all until the user happened to
// open Messages/Notifications and the next poll landed.
function GlobalRealtimeHandler() {
  const { user } = useAuthStore()
  const incrementUnreadMessages = useUnreadStore((s) => s.incrementUnreadMessages)

  useEffect(() => {
    if (!user?._id) return
    void refreshUnreadMessages()
  }, [user?._id])

  useSocketEvent('notification:new', (n: { type: string; link?: string }) => {
    if (!user?._id) return
    playNotificationSound()
    queryClient.setQueryData(['notifications-count'], (old: { unreadCount: number } | undefined) =>
      old ? { ...old, unreadCount: old.unreadCount + 1 } : old
    )
    queryClient.invalidateQueries({ queryKey: ['notifications'] })

    if (n.type === 'MESSAGE') {
      const conversationId = n.link?.split('/messages/')[1]
      const activeConversationId = useUnreadStore.getState().activeConversationId
      if (conversationId && conversationId !== activeConversationId) {
        incrementUnreadMessages()
      }
    }
  }, [user?._id, incrementUnreadMessages])

  return null
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeApplier />
      <ErrorBoundary>
        <RouterProvider router={router} />
        <GlobalCallHandler />
        <GlobalRealtimeHandler />
      </ErrorBoundary>
    </QueryClientProvider>
  )
}

export default App
