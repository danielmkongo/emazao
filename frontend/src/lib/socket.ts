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
  }
  return socket
}

export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
