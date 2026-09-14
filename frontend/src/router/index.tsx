import { createBrowserRouter, Navigate } from 'react-router-dom'
import { Suspense } from 'react'
// Self-healing lazy: reloads once if a chunk 404s after a deploy (stale index.html)
import { lazyWithReload as lazy } from '@/lib/lazyWithReload'
import { MainLayout } from '@/components/layout/MainLayout'
import { useAuthStore } from '@/store/authStore'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorBoundary } from '@/components/ErrorBoundary'

const Loading = () => (
  <div className="p-6 space-y-4">
    {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
  </div>
)

// Each route gets its own boundary — previously only the app root had one, so a
// render error on any single page blanked the entire app (nav included) rather
// than just that route's content.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const wrap = (Component: React.LazyExoticComponent<() => any>) => (
  <ErrorBoundary><Suspense fallback={<Loading />}><Component /></Suspense></ErrorBoundary>
)

// Lazy pages
const Landing = lazy(() => import('@/pages/Landing'))
const Login = lazy(() => import('@/pages/auth/Login'))
const Register = lazy(() => import('@/pages/auth/Register'))
const ForgotPassword = lazy(() => import('@/pages/auth/ForgotPassword'))
const ResetPassword = lazy(() => import('@/pages/auth/ResetPassword'))
const VerifyOtp = lazy(() => import('@/pages/auth/VerifyOtp'))
const Onboarding = lazy(() => import('@/pages/auth/Onboarding'))
const Feed = lazy(() => import('@/pages/feed/Feed'))
const Explore = lazy(() => import('@/pages/explore/Explore'))
const ReelFeed = lazy(() => import('@/pages/reels/ReelFeed'))
const LiveBroadcast = lazy(() => import('@/pages/reels/LiveBroadcast'))
const LiveViewer = lazy(() => import('@/pages/reels/LiveViewer'))
const Marketplace = lazy(() => import('@/pages/marketplace/Marketplace'))
const ProductDetail = lazy(() => import('@/pages/marketplace/ProductDetail'))
const Requirements = lazy(() => import('@/pages/requirements/Requirements'))
const PostRequirement = lazy(() => import('@/pages/requirements/PostRequirement'))
const RequirementDetail = lazy(() => import('@/pages/requirements/RequirementDetail'))
const Storefront = lazy(() => import('@/pages/farm/Storefront'))
const MessagesLayout = lazy(() => import('@/pages/messages/MessagesLayout'))
const Thread = lazy(() => import('@/pages/messages/Thread'))
const Orders = lazy(() => import('@/pages/orders/Orders'))
const OrderDetail = lazy(() => import('@/pages/orders/OrderDetail'))
const WalletPage = lazy(() => import('@/pages/wallet/Wallet'))
const VerificationPage = lazy(() => import('@/pages/wallet/Verification'))
const Notifications = lazy(() => import('@/pages/notifications/Notifications'))
const Profile = lazy(() => import('@/pages/profile/Profile'))

// Farmer Dashboard
const Dashboard = lazy(() => import('@/pages/dashboard/Dashboard'))
const Analytics = lazy(() => import('@/pages/dashboard/Analytics'))
const DashboardProducts = lazy(() => import('@/pages/dashboard/Products'))
const AddProduct = lazy(() => import('@/pages/dashboard/AddProduct'))
const EditProduct = lazy(() => import('@/pages/dashboard/EditProduct'))
const DashboardOrders = lazy(() => import('@/pages/dashboard/DashboardOrders'))
const DashboardBids = lazy(() => import('@/pages/dashboard/Bids'))
const DashboardWallet = lazy(() => import('@/pages/dashboard/DashboardWallet'))
const DashboardReels = lazy(() => import('@/pages/dashboard/Reels'))
const DashboardStorefront = lazy(() => import('@/pages/dashboard/Storefront'))

// Profile & Settings
const Settings = lazy(() => import('@/pages/profile/Settings'))

// Admin
const Admin = lazy(() => import('@/pages/admin/Admin'))
const AdminUsers = lazy(() => import('@/pages/admin/AdminUsers'))
const AdminVerification = lazy(() => import('@/pages/admin/AdminVerification'))
const AdminCompliance = lazy(() => import('@/pages/admin/Compliance'))
const NotFound = lazy(() => import('@/pages/NotFound'))
const AdminDisputes = lazy(() => import('@/pages/admin/AdminDisputes'))
const AdminAnalytics = lazy(() => import('@/pages/admin/AdminAnalytics'))
const AdminOverview = lazy(() => import('@/pages/admin/AdminOverview'))
const AdminTransactions = lazy(() => import('@/pages/admin/AdminTransactions'))
const AdminAudit = lazy(() => import('@/pages/admin/AdminAudit'))
const AdminSettings = lazy(() => import('@/pages/admin/AdminSettings'))

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
  { path: '/forgot-password', element: wrap(ForgotPassword) },
  { path: '/reset-password', element: wrap(ResetPassword) },
  { path: '/verify-otp', element: wrap(VerifyOtp) },
  { path: '/onboarding', element: wrap(Onboarding) },

  // Fullscreen routes — no layout chrome
  {
    // Optional :reelId so a reel tapped in the feed opens on that exact reel.
    // Public: a reel link is the single most-shared thing a farmer produces, and
    // the feed endpoint already uses optionalProtect. Liking, commenting and
    // buying from within a reel still prompt for sign-in.
    path: '/reels/:reelId?',
    element: (
      <Suspense fallback={<div className="h-screen bg-black" />}>
        <ReelFeed />
      </Suspense>
    ),
  },
  {
    path: '/live',
    element: (
      <ProtectedRoute>
        <Suspense fallback={<div className="h-screen bg-black" />}>
          <LiveBroadcast />
        </Suspense>
      </ProtectedRoute>
    ),
  },
  {
    path: '/live/:broadcasterId',
    element: (
      <ProtectedRoute>
        <Suspense fallback={<div className="h-screen bg-black" />}>
          <LiveViewer />
        </Suspense>
      </ProtectedRoute>
    ),
  },

  // ── Public browsing ────────────────────────────────────────────────────────
  // Produce, storefronts and farmer profiles are shareable outside the app —
  // links get passed around on WhatsApp constantly — so a recipient can look
  // before deciding to sign up. Anything that spends money, sends a message or
  // exposes someone's private data stays behind auth in the group below.
  {
    element: <MainLayout />,
    children: [
      { path: '/marketplace', element: wrap(Marketplace) },
      { path: '/marketplace/product/:slug', element: wrap(ProductDetail) },
      { path: '/farm/:username', element: wrap(Storefront) },
      { path: '/profile/:username', element: wrap(Profile) },
      { path: '/explore', element: wrap(Explore) },
    ],
  },

  {
    element: (
      <ProtectedRoute>
        <MainLayout />
      </ProtectedRoute>
    ),
    children: [
      { path: '/feed', element: wrap(Feed) },
      { path: '/requirements', element: wrap(Requirements) },
      { path: '/requirements/post', element: wrap(PostRequirement) },
      { path: '/requirements/:id', element: wrap(RequirementDetail) },
      {
        path: '/messages',
        element: wrap(MessagesLayout),
        children: [
          // 'new' is deliberately NOT a separate route. Thread decides it is
          // composing a new conversation by reading `id === 'new'` from the
          // params, and a static child route sets no param at all — so with one
          // registered, /messages/new left `id` undefined, isNewConvo was always
          // false, and the compose path never ran: the recipient was never read
          // from the query string, the composer had no conversation to target,
          // and sending posted with no recipientId, which is what created the
          // participant-less conversations.
          { path: ':id', element: wrap(Thread) },
        ],
      },
      { path: '/orders', element: wrap(Orders) },
      { path: '/orders/:id', element: wrap(OrderDetail) },
      { path: '/wallet', element: wrap(WalletPage) },
      { path: '/wallet/verification', element: wrap(VerificationPage) },
      { path: '/notifications', element: wrap(Notifications) },
      // Own profile only — the :username variant is public, above.
      { path: '/profile', element: wrap(Profile) },
      { path: '/settings', element: wrap(Settings) },

      // Farmer Dashboard
      { path: '/dashboard', element: wrap(Dashboard) },
      { path: '/dashboard/analytics', element: wrap(Analytics) },
      { path: '/dashboard/products', element: wrap(DashboardProducts) },
      { path: '/dashboard/products/new', element: wrap(AddProduct) },
      { path: '/dashboard/products/:id/edit', element: wrap(EditProduct) },
      { path: '/dashboard/orders', element: wrap(DashboardOrders) },
      { path: '/dashboard/reels', element: wrap(DashboardReels) },
      { path: '/dashboard/storefront', element: wrap(DashboardStorefront) },
      { path: '/dashboard/bids', element: wrap(DashboardBids) },
      { path: '/dashboard/wallet', element: wrap(DashboardWallet) },

      // Admin
      {
        path: '/admin',
        element: <AdminRoute><Suspense fallback={<Loading />}><Admin /></Suspense></AdminRoute>,
        children: [
          { index: true, element: <Navigate to="/admin/overview" replace /> },
          { path: 'overview', element: wrap(AdminOverview) },
          { path: 'transactions', element: wrap(AdminTransactions) },
          { path: 'users', element: wrap(AdminUsers) },
          { path: 'verification', element: wrap(AdminVerification) },
          { path: 'compliance', element: wrap(AdminCompliance) },
          { path: 'disputes', element: wrap(AdminDisputes) },
          { path: 'analytics', element: wrap(AdminAnalytics) },
          { path: 'audit', element: wrap(AdminAudit) },
          { path: 'settings', element: wrap(AdminSettings) },
        ],
      },
    ],
  },

  // Show a real 404 instead of silently redirecting — shared product/reel
  // links that break should say so rather than look like an empty homepage.
  { path: '*', element: wrap(NotFound) },
])
