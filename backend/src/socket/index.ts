import { Server, Socket } from 'socket.io'
import LiveSession from '../models/LiveSession'
import User from '../models/User'
import Follow from '../models/Follow'

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
    socket.on('live:start', async (data: { broadcasterId: string; title: string }) => {
      socket.join(`live:${data.broadcasterId}`)

      // Persist session to DB
      const session = await LiveSession.findOneAndUpdate(
        { broadcasterId: data.broadcasterId },
        { broadcasterId: data.broadcasterId, title: data.title, startedAt: new Date(), viewerCount: 0 },
        { upsert: true, new: true }
      ).populate('broadcasterId', 'name username avatar isVerified')

      const payload = {
        _id: session._id,
        broadcasterId: session.broadcasterId,
        title: data.title,
        viewerCount: 0,
        startedAt: session.startedAt,
      }

      // Emit to all connected clients for global discovery
      io.emit('live:new', payload)

      // Push targeted notification to each follower's room
      const follows = await Follow.find({ followingId: data.broadcasterId }).select('followerId').lean()
      const broadcaster = await User.findById(data.broadcasterId).select('name').lean()
      for (const f of follows) {
        io.to(`user:${f.followerId}`).emit('notification:new', {
          type: 'LIVE',
          title: `${broadcaster?.name ?? 'A farmer'} is live!`,
          body: data.title || 'Tap to join the stream',
          link: `/live/${data.broadcasterId}`,
        })
      }
    })

    socket.on('live:join', (data: { broadcasterId: string; viewerId: string }) => {
      socket.join(`live:${data.broadcasterId}`)
      io.to(`user:${data.broadcasterId}`).emit('live:viewer-joined', { viewerId: data.viewerId })
      // Increment viewer count in DB
      LiveSession.findOneAndUpdate(
        { broadcasterId: data.broadcasterId },
        { $inc: { viewerCount: 1 } }
      ).catch(() => {})
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

    socket.on('live:end', async (data: { broadcasterId: string }) => {
      await LiveSession.deleteOne({ broadcasterId: data.broadcasterId })
      io.to(`live:${data.broadcasterId}`).emit('live:ended')
      io.emit('live:removed', { broadcasterId: data.broadcasterId })
    })

    socket.on('disconnect', async () => {
      if (userId) {
        onlineUsers.delete(userId)
        // Clean up any active live session when broadcaster disconnects
        const deleted = await LiveSession.findOneAndDelete({ broadcasterId: userId })
        if (deleted) {
          io.to(`live:${userId}`).emit('live:ended')
          io.emit('live:removed', { broadcasterId: userId })
        }
      }
    })
  })
}

export const emitToUser = (io: Server, userId: string, event: string, data: unknown): void => {
  io.to(`user:${userId}`).emit(event, data)
}
