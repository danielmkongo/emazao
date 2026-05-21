import { Request, Response, NextFunction } from 'express'

export interface AppError extends Error {
  statusCode?: number
  code?: number
}

export const errorHandler = (err: AppError, _req: Request, res: Response, _next: NextFunction): void => {
  const statusCode = err.statusCode || 500
  const message = err.message || 'Internal server error'

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
