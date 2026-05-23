import { Server } from 'socket.io'
import Notification, { NotificationType } from '../models/Notification'

let _io: Server | null = null

export const setIo = (io: Server): void => { _io = io }

export const emitToRoom = (room: string, event: string, data: unknown): void => {
  if (_io) _io.to(room).emit(event, data)
}

export const sendNotification = async (params: {
  userId: string
  type: NotificationType
  title: string
  body: string
  link?: string
  data?: Record<string, unknown>
}): Promise<void> => {
  const notification = await Notification.create({
    userId: params.userId,
    type: params.type,
    title: params.title,
    body: params.body,
    link: params.link,
    data: params.data,
    isRead: false,
  })

  if (_io) {
    _io.to(`user:${params.userId}`).emit('notification:new', notification)
  }
}
