import { useEffect, useState } from 'react'
import { RouterProvider } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { router } from '@/router'
import { useUIStore } from '@/store/uiStore'
import { useAuthStore } from '@/store/authStore'
import { queryClient } from '@/lib/queryClient'
import CallModal, { useCallStore } from '@/components/layout/CallModal'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { getSocket } from '@/lib/socket'

function ThemeApplier() {
  const theme = useUIStore((s) => s.theme)
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    // Recolor the browser/OS chrome (status bar with battery & clock on mobile,
    // installed-PWA title bar) to follow the app theme.
    const meta = document.querySelector('meta[name="theme-color"]')
    meta?.setAttribute('content', theme === 'dark' ? '#0A0F0D' : '#16A34A')
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
      const socket = getSocket(user._id)
      socket.emit('call:request', { calleeId, callerId: user._id, callerName: user.name, video })
      setCall({ type: 'calling', video, calleeId, calleeName, calleeAvatar })
    }
    window.addEventListener('emazao:call-out', handleCallOut)
    return () => window.removeEventListener('emazao:call-out', handleCallOut)
  }, [user?._id, setCall])

  return <CallModal call={call} setCall={setCall} />
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeApplier />
      <ErrorBoundary>
        <RouterProvider router={router} />
        <GlobalCallHandler />
      </ErrorBoundary>
    </QueryClientProvider>
  )
}

export default App
