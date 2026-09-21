import { useEffect } from 'react'
import { Outlet, useLocation, useParams } from 'react-router-dom'
import { MessageSquare } from 'lucide-react'
import { ConversationList } from '@/components/messages/ConversationList'

/**
 * Desktop gets a persistent conversation list next to the open thread (the
 * conventional WhatsApp Web / Slack layout) instead of navigating to a whole
 * separate page and losing the list, which wasted most of the screen width
 * on wide viewports. Mobile keeps the original one-panel-at-a-time behavior —
 * there's no room for both, so whichever panel matches the current route is
 * the only one shown.
 */
export default function MessagesLayout() {
  const location = useLocation()
  const { id } = useParams<{ id: string }>()
  const isThreadOpen = location.pathname !== '/messages'

  // The page behind the chat must not scroll at all. On a phone the document
  // is 100vh tall but only 100dvh is visible, so it could still move by about a
  // toolbar's height — and when the message list reached its end, the leftover
  // scroll was handed to the page, carrying the composer up with it. Locking
  // the document and pinning this layer to the space between the top bar and
  // the bottom nav keeps the composer glued down whatever the finger does.
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const before = [html.style.overflow, body.style.overflow, html.style.overscrollBehavior, body.style.overscrollBehavior]
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    html.style.overscrollBehavior = 'none'
    body.style.overscrollBehavior = 'none'
    window.scrollTo(0, 0)
    return () => {
      ;[html.style.overflow, body.style.overflow, html.style.overscrollBehavior, body.style.overscrollBehavior] = before
    }
  }, [])

  return (
    <div className="fixed inset-x-0 top-[calc(56px+env(safe-area-inset-top,0px))] bottom-[calc(56px+env(safe-area-inset-bottom,0px))] flex overscroll-none lg:static lg:h-screen bg-[var(--c-bg)]">
      <div className={`w-full min-w-0 overflow-hidden lg:w-[360px] lg:flex-shrink-0 lg:border-r lg:border-[var(--c-border)] ${isThreadOpen ? 'hidden lg:flex' : 'flex'}`}>
        <ConversationList activeId={id} />
      </div>
      <div className={`flex-1 min-w-0 ${isThreadOpen ? 'flex' : 'hidden lg:flex'}`}>
        {isThreadOpen ? (
          <Outlet />
        ) : (
          <div className="hidden lg:flex flex-col items-center justify-center gap-3 w-full text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-[var(--c-raised)] flex items-center justify-center">
              <MessageSquare className="h-7 w-7 text-[var(--c-text-4)]" />
            </div>
            <p className="text-[var(--c-text)] font-semibold">Select a conversation</p>
            <p className="text-[var(--c-text-3)] text-sm max-w-xs">Pick someone from the list to see your messages, or start a new one.</p>
          </div>
        )}
      </div>
    </div>
  )
}
