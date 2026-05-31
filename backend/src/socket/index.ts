import { Server, Socket } from 'socket.io'
import LiveSession from '../models/LiveSession'
import User from '../models/User'
import Follow from '../models/Follow'

const onlineUsers  = new Map<string, string>()         // userId → socketId
const liveViewers  = new Map<string, Set<string>>()    // broadcasterId → Set<userId>
const viewerOf     = new Map<string, string>()         // userId → broadcasterId (for disconnect cleanup)

function emitViewerCount(io: Server, broadcasterId: string) {
  const count = liveViewers.get(broadcasterId)?.size ?? 0
  // Emit to everyone in the stream so broadcaster and all viewers see the same count
  io.to(`live:${broadcasterId}`).emit('live:viewer-count', { count })
  io.to(`user:${broadcasterId}`).emit('live:viewer-count', { count })
  LiveSession.findOneAndUpdate({ broadcasterId }, { viewerCount: count }).catch(() => {})
}

export const initSocket = (io: Server): void => {
  io.on('connection', (socket: Socket) => {
    const userId = socket.handshake.auth['userId'] as string | undefined
    if (userId) {
      onlineUsers.set(userId, socket.id)
      socket.join(`user:${userId}`)
    }

    // ── Messaging ──────────────────────────────────────────────────────────────
    socket.on('join_conversation',  (id: string) => socket.join(`conv:${id}`))
    socket.on('leave_conversation', (id: string) => socket.leave(`conv:${id}`))
    socket.on('send_message', (data: { conversationId: string; message: unknown }) => {
      socket.to(`conv:${data.conversationId}`).emit('message:new', data.message)
    })

    // ── Requirements ───────────────────────────────────────────────────────────
    socket.on('join_requirement', (id: string) => socket.join(`req:${id}`))

    // ── WebRTC Calling ─────────────────────────────────────────────────────────
    socket.on('call:request', (d: { calleeId: string; callerName: string; callerId: string; video: boolean }) => {
      io.to(`user:${d.calleeId}`).emit('call:incoming', { callerId: d.callerId, callerName: d.callerName, video: d.video })
    })
    socket.on('call:accept',        (d: { callerId: string; calleeId: string })                    => io.to(`user:${d.callerId}`).emit('call:accepted', { calleeId: d.calleeId }))
    socket.on('call:decline',       (d: { callerId: string })                                      => io.to(`user:${d.callerId}`).emit('call:declined'))
    socket.on('call:offer',         (d: { to: string; from: string; sdp: unknown })               => io.to(`user:${d.to}`).emit('call:offer',         { from: d.from, sdp: d.sdp }))
    socket.on('call:answer',        (d: { to: string; from: string; sdp: unknown })               => io.to(`user:${d.to}`).emit('call:answer',        { from: d.from, sdp: d.sdp }))
    socket.on('call:ice-candidate', (d: { to: string; from: string; candidate: unknown })         => io.to(`user:${d.to}`).emit('call:ice-candidate', { from: d.from, candidate: d.candidate }))
    socket.on('call:end',           (d: { to: string })                                            => io.to(`user:${d.to}`).emit('call:ended'))

    // ── Live Streaming ─────────────────────────────────────────────────────────
    socket.on('live:start', async (data: { broadcasterId: string; title: string }) => {
      socket.join(`live:${data.broadcasterId}`)
      liveViewers.set(data.broadcasterId, new Set())

      const session = await LiveSession.findOneAndUpdate(
        { broadcasterId: data.broadcasterId },
        { broadcasterId: data.broadcasterId, title: data.title, startedAt: new Date(), viewerCount: 0 },
        { upsert: true, new: true }
      ).populate('broadcasterId', 'name username avatar isVerified')

      io.emit('live:new', {
        _id: session._id,
        broadcasterId: session.broadcasterId,
        title: data.title,
        viewerCount: 0,
        startedAt: session.startedAt,
      })

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

      if (!liveViewers.has(data.broadcasterId)) liveViewers.set(data.broadcasterId, new Set())
      liveViewers.get(data.broadcasterId)!.add(data.viewerId)
      viewerOf.set(data.viewerId, data.broadcasterId)

      io.to(`user:${data.broadcasterId}`).emit('live:viewer-joined', { viewerId: data.viewerId })
      emitViewerCount(io, data.broadcasterId)
    })

    socket.on('live:leave', (data: { broadcasterId: string; viewerId: string }) => {
      socket.leave(`live:${data.broadcasterId}`)
      liveViewers.get(data.broadcasterId)?.delete(data.viewerId)
      viewerOf.delete(data.viewerId)
      io.to(`user:${data.broadcasterId}`).emit('live:viewer-left', { viewerId: data.viewerId })
      emitViewerCount(io, data.broadcasterId)
    })

    // All live WebRTC signalling routes via userId rooms
    socket.on('live:offer',         (d: { to: string; from: string; sdp: unknown })               => io.to(`user:${d.to}`).emit('live:offer',         { from: d.from, sdp: d.sdp }))
    socket.on('live:answer',        (d: { to: string; from: string; sdp: unknown })               => io.to(`user:${d.to}`).emit('live:answer',        { from: d.from, sdp: d.sdp }))
    socket.on('live:ice-candidate', (d: { to: string; from: string; candidate: unknown })         => io.to(`user:${d.to}`).emit('live:ice-candidate', { from: d.from, candidate: d.candidate }))

    // socket.to() excludes sender — broadcaster won't see their own comment twice
    socket.on('live:comment', (data: { broadcasterId: string; text: string; username: string }) => {
      socket.to(`live:${data.broadcasterId}`).emit('live:comment', data)
    })

    socket.on('live:end', async (data: { broadcasterId: string }) => {
      liveViewers.delete(data.broadcasterId)
      await LiveSession.deleteOne({ broadcasterId: data.broadcasterId })
      io.to(`live:${data.broadcasterId}`).emit('live:ended')
      io.emit('live:removed', { broadcasterId: data.broadcasterId })
    })

    socket.on('disconnect', async () => {
      if (userId) {
        onlineUsers.delete(userId)

        // Remove from viewer set if they were watching
        const broadcasterId = viewerOf.get(userId)
        if (broadcasterId) {
          liveViewers.get(broadcasterId)?.delete(userId)
          viewerOf.delete(userId)
          io.to(`user:${broadcasterId}`).emit('live:viewer-left', { viewerId: userId })
          emitViewerCount(io, broadcasterId)
        }

        // End stream if they were the broadcaster
        const deleted = await LiveSession.findOneAndDelete({ broadcasterId: userId })
        if (deleted) {
          liveViewers.delete(userId)
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
