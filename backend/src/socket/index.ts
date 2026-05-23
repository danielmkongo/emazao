import { Server, Socket } from 'socket.io'

const onlineUsers = new Map<string, string>() // userId → socketId

export const initSocket = (io: Server): void => {
  io.on('connection', (socket: Socket) => {
    const userId = socket.handshake.auth['userId'] as string | undefined
    if (userId) {
      onlineUsers.set(userId, socket.id)
      socket.join(`user:${userId}`)
    }

    // ── Messaging ──────────────────────────────────────────────────────────────
    socket.on('join_conversation', (conversationId: string) => {
      socket.join(`conv:${conversationId}`)
    })

    socket.on('leave_conversation', (conversationId: string) => {
      socket.leave(`conv:${conversationId}`)
    })

    socket.on('send_message', (data: { conversationId: string; message: unknown }) => {
      socket.to(`conv:${data.conversationId}`).emit('message:new', data.message)
    })

    // ── Requirements (live bid updates) ────────────────────────────────────────
    socket.on('join_requirement', (requirementId: string) => {
      socket.join(`req:${requirementId}`)
    })

    // ── WebRTC Calling ─────────────────────────────────────────────────────────
    socket.on('call:request', (data: { calleeId: string; callerName: string; callerId: string; video: boolean }) => {
      io.to(`user:${data.calleeId}`).emit('call:incoming', {
        callerId: data.callerId,
        callerName: data.callerName,
        video: data.video,
      })
    })

    socket.on('call:accept', (data: { callerId: string; calleeId: string }) => {
      io.to(`user:${data.callerId}`).emit('call:accepted', { calleeId: data.calleeId })
    })

    socket.on('call:decline', (data: { callerId: string }) => {
      io.to(`user:${data.callerId}`).emit('call:declined')
    })

    socket.on('call:offer', (data: { to: string; from: string; sdp: unknown }) => {
      io.to(`user:${data.to}`).emit('call:offer', { from: data.from, sdp: data.sdp })
    })

    socket.on('call:answer', (data: { to: string; from: string; sdp: unknown }) => {
      io.to(`user:${data.to}`).emit('call:answer', { from: data.from, sdp: data.sdp })
    })

    socket.on('call:ice-candidate', (data: { to: string; from: string; candidate: unknown }) => {
      io.to(`user:${data.to}`).emit('call:ice-candidate', { from: data.from, candidate: data.candidate })
    })

    socket.on('call:end', (data: { to: string }) => {
      io.to(`user:${data.to}`).emit('call:ended')
    })

    // ── Live Streaming ─────────────────────────────────────────────────────────
    socket.on('live:start', (data: { broadcasterId: string; title: string }) => {
      socket.join(`live:${data.broadcasterId}`)
      io.emit('live:new', { broadcasterId: data.broadcasterId, title: data.title })
    })

    socket.on('live:join', (data: { broadcasterId: string; viewerId: string }) => {
      socket.join(`live:${data.broadcasterId}`)
      io.to(`user:${data.broadcasterId}`).emit('live:viewer-joined', { viewerId: data.viewerId })
    })

    socket.on('live:offer', (data: { to: string; from: string; sdp: unknown }) => {
      io.to(`user:${data.to}`).emit('live:offer', { from: data.from, sdp: data.sdp })
    })

    socket.on('live:answer', (data: { to: string; from: string; sdp: unknown }) => {
      io.to(`user:${data.to}`).emit('live:answer', { from: data.from, sdp: data.sdp })
    })

    socket.on('live:ice-candidate', (data: { to: string; from: string; candidate: unknown }) => {
      io.to(`user:${data.to}`).emit('live:ice-candidate', { from: data.from, candidate: data.candidate })
    })

    socket.on('live:comment', (data: { broadcasterId: string; text: string; username: string }) => {
      io.to(`live:${data.broadcasterId}`).emit('live:comment', data)
    })

    socket.on('live:end', (data: { broadcasterId: string }) => {
      io.to(`live:${data.broadcasterId}`).emit('live:ended')
      io.emit('live:removed', { broadcasterId: data.broadcasterId })
    })

    socket.on('disconnect', () => {
      if (userId) onlineUsers.delete(userId)
    })
  })
}

export const emitToUser = (io: Server, userId: string, event: string, data: unknown): void => {
  io.to(`user:${userId}`).emit(event, data)
}
