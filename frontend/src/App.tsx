import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { router } from '@/router'
import { useUIStore } from '@/store/uiStore'
import { queryClient } from '@/lib/queryClient'

function ThemeApplier() {
  const theme = useUIStore((s) => s.theme)
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])
  return null
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeApplier />
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

export default App
