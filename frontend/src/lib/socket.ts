import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export const getSocket = (userId?: string): Socket => {
  if (!socket) {
    socket = io('http://localhost:5000', {
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
