// Minimal structured-ish logger — not a full winston/pino setup, but gives every
// line a timestamp and level so `pm2 logs` output can be scanned/grepped, and
// gives controllers one place to log server-side detail on errors they still
// return a sanitized message for (see errorHandler.ts).
type Level = 'info' | 'warn' | 'error'

function write(level: Level, message: string, meta?: Record<string, unknown>): void {
  const line = `[${new Date().toISOString()}] ${level.toUpperCase()} ${message}`
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
  if (meta) fn(line, meta)
  else fn(line)
}

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => write('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => write('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => write('error', message, meta),
}
