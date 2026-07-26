import { Server, Socket } from 'socket.io'
import jwt from 'jsonwebtoken'
import { env } from '../config/env'
import LiveSession from '../models/LiveSession'
import User from '../models/User'
import Follow from '../models/Follow'
import Conversation from '../models/Conversation'

const onlineUsers  = new Map<string, string>()         // userId → socketId
const liveViewers  = new Map<string, Set<string>>()    // broadcasterId → Set<userId>
const viewerOf     = new Map<string, string>()         // userId → broadcasterId (for disconnect cleanup)
const activeCalls  = new Map<string, string>()         // userId → peerUserId (only while a call is accepted/connected)

function emitViewerCount(io: Server, broadcasterId: string) {
  const count = liveViewers.get(broadcasterId)?.size ?? 0
  // Emit to everyone in the stream so broadcaster and all viewers see the same count
  io.to(`live:${broadcasterId}`).emit('live:viewer-count', { count })
  io.to(`user:${broadcasterId}`).emit('live:viewer-count', { count })
  io.emit('live:viewer-count-global', { broadcasterId, count })
  LiveSession.findOneAndUpdate({ broadcasterId }, { viewerCount: count })
    .catch(err => console.error('[live] emitViewerCount update failed', err))
}

export const initSocket = (io: Server): void => {
  // Every connecting socket must present a valid access token — the userId can no
  // longer be asserted directly by the client (it used to be trusted as-is, which
  // let anyone connect claiming to be any user and receive their private
  // notifications/calls, or join any conversation room to eavesdrop).
  io.use((socket, next) => {
    const token = socket.handshake.auth?.['token'] as string | undefined
    if (!token) return next(new Error('unauthorized'))
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as { id: string; role: string }
      socket.data.userId = decoded.id
      socket.data.role = decoded.role
      next()
    } catch {
      next(new Error('unauthorized'))
    }
  })

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId as string
    onlineUsers.set(userId, socket.id)
    socket.join(`user:${userId}`)

    // ── Messaging ──────────────────────────────────────────────────────────────
    socket.on('join_conversation', async (id: string) => {
      const convo = await Conversation.findById(id).select('participants').lean()
      if (convo && convo.participants.map(String).includes(userId)) socket.join(`conv:${id}`)
    })
    socket.on('leave_conversation', (id: string) => socket.leave(`conv:${id}`))
    socket.on('send_message', (data: { conversationId: string; message: unknown }) => {
      socket.to(`conv:${data.conversationId}`).emit('message:new', data.message)
    })

    // ── Requirements ───────────────────────────────────────────────────────────
    socket.on('join_requirement', (id: string) => socket.join(`req:${id}`))

    // ── WebRTC Calling ─────────────────────────────────────────────────────────
    socket.on('call:request', async (d: { calleeId: string; video: boolean }) => {
      const caller = await User.findById(userId).select('name avatar').lean()
      io.to(`user:${d.calleeId}`).emit('call:incoming', {
        callerId: userId,
        callerName: caller?.name ?? 'Unknown',
        callerAvatar: caller?.avatar,
        video: d.video,
      })
    })
    socket.on('call:accept', (d: { callerId: string }) => {
      activeCalls.set(d.callerId, userId)
      activeCalls.set(userId, d.callerId)
      io.to(`user:${d.callerId}`).emit('call:accepted', { calleeId: userId })
    })
    socket.on('call:decline', (d: { callerId: string }) => io.to(`user:${d.callerId}`).emit('call:declined'))
    socket.on('call:offer',         (d: { to: string; sdp: unknown })         => io.to(`user:${d.to}`).emit('call:offer',         { from: userId, sdp: d.sdp }))
    socket.on('call:answer',        (d: { to: string; sdp: unknown })         => io.to(`user:${d.to}`).emit('call:answer',        { from: userId, sdp: d.sdp }))
    socket.on('call:ice-candidate', (d: { to: string; candidate: unknown })   => io.to(`user:${d.to}`).emit('call:ice-candidate', { from: userId, candidate: d.candidate }))
    socket.on('call:busy',          (d: { callerId: string })                => io.to(`user:${d.callerId}`).emit('call:busy'))
    socket.on('call:end', (d: { to: string }) => {
      activeCalls.delete(userId)
      activeCalls.delete(d.to)
      io.to(`user:${d.to}`).emit('call:ended')
    })

    // ── Live Streaming ─────────────────────────────────────────────────────────
    socket.on('live:start', async (data: { title: string }) => {
      socket.join(`live:${userId}`)
      if (!liveViewers.has(userId)) liveViewers.set(userId, new Set())

      const session = await LiveSession.findOneAndUpdate(
        { broadcasterId: userId },
        { broadcasterId: userId, title: data.title, startedAt: new Date(), viewerCount: 0, lastHeartbeatAt: new Date() },
        { upsert: true, new: true }
      ).populate('broadcasterId', 'name username avatar isVerified')

      io.emit('live:new', {
        _id: session._id,
        broadcasterId: session.broadcasterId,
        title: data.title,
        viewerCount: 0,
        startedAt: session.startedAt,
      })

      const follows = await Follow.find({ followingId: userId }).select('followerId').lean()
      const broadcaster = await User.findById(userId).select('name').lean()
      for (const f of follows) {
        io.to(`user:${f.followerId}`).emit('notification:new', {
          type: 'LIVE',
          title: `${broadcaster?.name ?? 'A farmer'} is live!`,
          body: data.title || 'Tap to join the stream',
          link: `/live/${userId}`,
        })
      }
    })

    socket.on('live:heartbeat', () => {
      LiveSession.findOneAndUpdate({ broadcasterId: userId }, { lastHeartbeatAt: new Date() })
        .catch(err => console.error('[live] heartbeat update failed', err))
    })

    socket.on('live:join', async (data: { broadcasterId: string }) => {
      const session = await LiveSession.findOne({ broadcasterId: data.broadcasterId }).select('_id').lean()
      if (!session) {
        socket.emit('live:not-found', { broadcasterId: data.broadcasterId })
        return
      }

      socket.join(`live:${data.broadcasterId}`)
      if (!liveViewers.has(data.broadcasterId)) liveViewers.set(data.broadcasterId, new Set())
      liveViewers.get(data.broadcasterId)!.add(userId)
      viewerOf.set(userId, data.broadcasterId)

      io.to(`user:${data.broadcasterId}`).emit('live:viewer-joined', { viewerId: userId })
      emitViewerCount(io, data.broadcasterId)
    })

    socket.on('live:leave', (data: { broadcasterId: string }) => {
      socket.leave(`live:${data.broadcasterId}`)
      liveViewers.get(data.broadcasterId)?.delete(userId)
      viewerOf.delete(userId)
      io.to(`user:${data.broadcasterId}`).emit('live:viewer-left', { viewerId: userId })
      emitViewerCount(io, data.broadcasterId)
    })

    // All live WebRTC signalling routes via userId rooms
    socket.on('live:offer',         (d: { to: string; sdp: unknown })       => io.to(`user:${d.to}`).emit('live:offer',         { from: userId, sdp: d.sdp }))
    socket.on('live:answer',        (d: { to: string; sdp: unknown })       => io.to(`user:${d.to}`).emit('live:answer',        { from: userId, sdp: d.sdp }))
    socket.on('live:ice-candidate', (d: { to: string; candidate: unknown }) => io.to(`user:${d.to}`).emit('live:ice-candidate', { from: userId, candidate: d.candidate }))

    // socket.to() excludes sender — broadcaster won't see their own comment twice
    socket.on('live:comment', async (data: { broadcasterId: string; text: string }) => {
      const author = await User.findById(userId).select('name username').lean()
      socket.to(`live:${data.broadcasterId}`).emit('live:comment', {
        broadcasterId: data.broadcasterId,
        text: data.text,
        username: author?.username ?? author?.name ?? 'Someone',
      })
    })

    socket.on('live:end', async (data: { broadcasterId: string }) => {
      if (data.broadcasterId !== userId) return // only the broadcaster can end their own stream
      liveViewers.delete(userId)
      await LiveSession.deleteOne({ broadcasterId: userId })
      io.to(`live:${userId}`).emit('live:ended')
      io.emit('live:removed', { broadcasterId: userId })
    })

    socket.on('disconnect', async () => {
      onlineUsers.delete(userId)

      // Notify the other party of an in-progress call instead of leaving them
      // hanging silently (e.g. when a server restart or network drop kills
      // this socket mid-call).
      const peerId = activeCalls.get(userId)
      if (peerId) {
        io.to(`user:${peerId}`).emit('call:peer-disconnected')
        activeCalls.delete(userId)
        activeCalls.delete(peerId)
      }

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
    })
  })
}

export const emitToUser = (io: Server, userId: string, event: string, data: unknown): void => {
  io.to(`user:${userId}`).emit(event, data)
}
