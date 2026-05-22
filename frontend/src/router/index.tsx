import { createBrowserRouter, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { MainLayout } from '@/components/layout/MainLayout'
import { useAuthStore } from '@/store/authStore'
import { Skeleton } from '@/components/ui/skeleton'

const Loading = () => (
  <div className="p-6 space-y-4">
    {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
  </div>
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const wrap = (Component: React.LazyExoticComponent<() => any>) => (
  <Suspense fallback={<Loading />}><Component /></Suspense>
)

// Lazy pages
const Landing = lazy(() => import('@/pages/Landing'))
const Login = lazy(() => import('@/pages/auth/Login'))
const Register = lazy(() => import('@/pages/auth/Register'))
const VerifyOtp = lazy(() => import('@/pages/auth/VerifyOtp'))
const Onboarding = lazy(() => import('@/pages/auth/Onboarding'))
const Feed = lazy(() => import('@/pages/feed/Feed'))
const Explore = lazy(() => import('@/pages/explore/Explore'))
const ReelFeed = lazy(() => import('@/pages/reels/ReelFeed'))
const Marketplace = lazy(() => import('@/pages/marketplace/Marketplace'))
const ProductDetail = lazy(() => import('@/pages/marketplace/ProductDetail'))
const Requirements = lazy(() => import('@/pages/requirements/Requirements'))
const PostRequirement = lazy(() => import('@/pages/requirements/PostRequirement'))
const RequirementDetail = lazy(() => import('@/pages/requirements/RequirementDetail'))
const Storefront = lazy(() => import('@/pages/farm/Storefront'))
const Inbox = lazy(() => import('@/pages/messages/Inbox'))
const Thread = lazy(() => import('@/pages/messages/Thread'))
const Orders = lazy(() => import('@/pages/orders/Orders'))
const OrderDetail = lazy(() => import('@/pages/orders/OrderDetail'))
const WalletPage = lazy(() => import('@/pages/wallet/Wallet'))
const Notifications = lazy(() => import('@/pages/notifications/Notifications'))
const Profile = lazy(() => import('@/pages/profile/Profile'))

// Farmer Dashboard
const Dashboard = lazy(() => import('@/pages/dashboard/Dashboard'))
const Analytics = lazy(() => import('@/pages/dashboard/Analytics'))
const DashboardProducts = lazy(() => import('@/pages/dashboard/Products'))
const AddProduct = lazy(() => import('@/pages/dashboard/AddProduct'))
const DashboardOrders = lazy(() => import('@/pages/dashboard/DashboardOrders'))
const DashboardBids = lazy(() => import('@/pages/dashboard/Bids'))
const DashboardWallet = lazy(() => import('@/pages/dashboard/DashboardWallet'))

// Profile & Settings
const Settings = lazy(() => import('@/pages/profile/Settings'))

// Admin
const Admin = lazy(() => import('@/pages/admin/Admin'))
const AdminUsers = lazy(() => import('@/pages/admin/AdminUsers'))
const AdminVerification = lazy(() => import('@/pages/admin/AdminVerification'))
const AdminDisputes = lazy(() => import('@/pages/admin/AdminDisputes'))
const AdminAnalytics = lazy(() => import('@/pages/admin/AdminAnalytics'))

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isAuthenticated } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!['ADMIN', 'SUPER_ADMIN'].includes(user?.role ?? '')) return <Navigate to="/feed" replace />
  return <>{children}</>
}

export const router = createBrowserRouter([
  { path: '/', element: wrap(Landing) },
  { path: '/login', element: wrap(Login) },
  { path: '/register', element: wrap(Register) },
  { path: '/verify-otp', element: wrap(VerifyOtp) },
  { path: '/onboarding', element: wrap(Onboarding) },

  {
    element: (
      <ProtectedRoute>
        <MainLayout />
      </ProtectedRoute>
    ),
    children: [
      { path: '/feed', element: wrap(Feed) },
      { path: '/explore', element: wrap(Explore) },
      { path: '/reels', element: wrap(ReelFeed) },
      { path: '/marketplace', element: wrap(Marketplace) },
      { path: '/marketplace/product/:slug', element: wrap(ProductDetail) },
      { path: '/requirements', element: wrap(Requirements) },
      { path: '/requirements/post', element: wrap(PostRequirement) },
      { path: '/requirements/:id', element: wrap(RequirementDetail) },
      { path: '/farm/:username', element: wrap(Storefront) },
      { path: '/messages', element: wrap(Inbox) },
      { path: '/messages/:id', element: wrap(Thread) },
      { path: '/orders', element: wrap(Orders) },
      { path: '/orders/:id', element: wrap(OrderDetail) },
      { path: '/wallet', element: wrap(WalletPage) },
      { path: '/notifications', element: wrap(Notifications) },
      { path: '/profile', element: wrap(Profile) },
      { path: '/profile/:username', element: wrap(Profile) },
      { path: '/settings', element: wrap(Settings) },

      // Farmer Dashboard
      { path: '/dashboard', element: wrap(Dashboard) },
      { path: '/dashboard/analytics', element: wrap(Analytics) },
      { path: '/dashboard/products', element: wrap(DashboardProducts) },
      { path: '/dashboard/products/new', element: wrap(AddProduct) },
      { path: '/dashboard/orders', element: wrap(DashboardOrders) },
      { path: '/dashboard/bids', element: wrap(DashboardBids) },
      { path: '/dashboard/wallet', element: wrap(DashboardWallet) },

      // Admin
      {
        path: '/admin',
        element: <AdminRoute><Suspense fallback={<Loading />}><Admin /></Suspense></AdminRoute>,
        children: [
          { index: true, element: <Navigate to="/admin/users" replace /> },
          { path: 'users', element: wrap(AdminUsers) },
          { path: 'verification', element: wrap(AdminVerification) },
          { path: 'disputes', element: wrap(AdminDisputes) },
          { path: 'analytics', element: wrap(AdminAnalytics) },
        ],
      },
    ],
  },

  { path: '*', element: <Navigate to="/" replace /> },
])
