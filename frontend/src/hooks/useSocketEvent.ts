import { useEffect } from 'react'
import { getSocket } from '@/lib/socket'

/**
 * Subscribe to one socket.io event for the lifetime of the calling component.
 *
 * Plain `socket.off('event')` removes *every* listener registered for that
 * event name, regardless of which component added it — fine while only one
 * component ever listens to a given event, but the first time two components
 * need the same event concurrently, one's cleanup silently kills the
 * other's listener. Passing the handler reference to `.off()` scopes the
 * removal to just this subscription.
 */
export function useSocketEvent<T = unknown>(
  event: string,
  handler: (data: T) => void,
  deps: unknown[]
): void {
  useEffect(() => {
    const socket = getSocket()
    socket.on(event, handler as (...args: unknown[]) => void)
    return () => {
      socket.off(event, handler as (...args: unknown[]) => void)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
