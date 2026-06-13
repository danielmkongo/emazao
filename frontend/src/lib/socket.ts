import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export const getSocket = (userId?: string): Socket => {
  if (!socket) {
    // In dev: connect directly to backend (port 9000). In prod: same origin via nginx.
    const url = import.meta.env.DEV ? 'http://localhost:9000' : window.location.origin
    socket = io(url, {
      auth: { userId },
      autoConnect: true,
      reconnection: true,
    })
  } else if (userId && (socket.auth as { userId?: string }).userId !== userId) {
    // The socket was first created before the userId was known (or it changed on
    // login). Re-auth and reconnect so the backend re-joins this socket to its
    // user:<id> room — without which calls, live signalling and notifications
    // never reach this client.
    ;(socket.auth as { userId?: string }).userId = userId
    socket.disconnect().connect()
  }
  return socket
}

export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
