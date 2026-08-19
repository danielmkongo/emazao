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

  return (
    <div className="flex h-[calc(100dvh-84px-92px-env(safe-area-inset-top,0px))] lg:h-screen bg-[var(--c-bg)]">
      <div className={`w-full lg:w-[360px] lg:flex-shrink-0 lg:border-r lg:border-[var(--c-border)] ${isThreadOpen ? 'hidden lg:flex' : 'flex'}`}>
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
