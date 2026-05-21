import { Server, Socket } from 'socket.io'

const onlineUsers = new Map<string, string>() // userId → socketId

export const initSocket = (io: Server): void => {
  io.on('connection', (socket: Socket) => {
    const userId = socket.handshake.auth['userId'] as string | undefined
    if (userId) {
      onlineUsers.set(userId, socket.id)
      socket.join(`user:${userId}`)
      console.log(`🔌 User ${userId} connected (${socket.id})`)
    }

    // Join a conversation room
    socket.on('join_conversation', (conversationId: string) => {
      socket.join(`conv:${conversationId}`)
    })

    // Send a message (broadcast to room)
    socket.on('send_message', (data: { conversationId: string; message: unknown }) => {
      socket.to(`conv:${data.conversationId}`).emit('message:new', data.message)
    })

    // Join a requirement room (for live bid updates)
    socket.on('join_requirement', (requirementId: string) => {
      socket.join(`req:${requirementId}`)
    })

    socket.on('disconnect', () => {
      if (userId) {
        onlineUsers.delete(userId)
        console.log(`🔌 User ${userId} disconnected`)
      }
    })
  })
}

// Utility to emit to a specific user from anywhere in the server
export const emitToUser = (io: Server, userId: string, event: string, data: unknown): void => {
  io.to(`user:${userId}`).emit(event, data)
}
