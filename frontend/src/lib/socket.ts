import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export const getSocket = (): Socket => {
  if (!socket) {
    // In dev: connect directly to backend (port 9000). In prod: same origin via nginx.
    const url = import.meta.env.DEV ? 'http://localhost:9000' : window.location.origin
    socket = io(url, {
      // A function, not a snapshotted object — socket.io-client calls this fresh
      // on every connection AND every automatic reconnection attempt, so a token
      // refreshed (or newly logged-in) after the socket was created is always
      // picked up. With a plain object, a reconnect after the original token
      // expired (e.g. the phone was backgrounded/locked for >15min) would keep
      // retrying with the same stale token forever and silently never reconnect
      // — the exact failure mode behind "calls/messages never arrive."
      auth: (cb) => cb({ token: localStorage.getItem('accessToken') ?? undefined }),
      autoConnect: true,
      reconnection: true,
    })

    // Mobile browsers suspend background tabs — timers (including socket.io's
    // reconnection backoff) can stall while backgrounded/locked. Force a
    // reconnect check the moment the tab/app comes back to the foreground.
    const kick = () => {
      if (document.visibilityState === 'visible' && socket && !socket.connected) {
        socket.connect()
      }
    }
    document.addEventListener('visibilitychange', kick)
    window.addEventListener('online', kick)
    window.addEventListener('focus', kick)
  }
  return socket
}

export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
