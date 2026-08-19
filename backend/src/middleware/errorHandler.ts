import { Request, Response, NextFunction } from 'express'
import { logger } from '../utils/logger'

export interface AppError extends Error {
  statusCode?: number
  code?: number
}

export const errorHandler = (err: AppError, req: Request, res: Response, _next: NextFunction): void => {
  const statusCode = err.statusCode || 500
  const message = err.message || 'Internal server error'

  // Almost nothing calls next(err) today (controllers catch locally instead),
  // but anything that does reach here should leave a server-side trace —
  // previously the client-facing message was the only record of a failure.
  logger.error(`${req.method} ${req.originalUrl} -> ${statusCode}`, { message, stack: err.stack })

  // Mongoose duplicate key
  if (err.code === 11000) {
    res.status(400).json({ success: false, message: 'Duplicate field value entered' })
    return
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env['NODE_ENV'] === 'development' && { stack: err.stack }),
  })
}

export const notFound = (req: Request, res: Response): void => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` })
}
