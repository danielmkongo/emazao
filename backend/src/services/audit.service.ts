import { AuthRequest } from '../middleware/auth.middleware'
import AuditLog from '../models/AuditLog'

/**
 * Append an entry to the admin audit trail.
 *
 * Never throws. An audit write failing must not roll back or 500 the action the
 * admin actually asked for — a suspended fraudster staying suspended matters
 * more than the log line. Failures are logged to stderr so they are still
 * visible in pm2 output rather than vanishing.
 */
export async function recordAudit(
  req: AuthRequest,
  entry: {
    action: string
    targetType: string
    targetId?: string
    targetLabel?: string
    summary: string
    meta?: Record<string, unknown>
  }
): Promise<void> {
  try {
    if (!req.user) return
    await AuditLog.create({
      actorId: req.user.id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      ...entry,
      // Behind nginx the socket address is the proxy, so prefer the forwarded
      // client address when one is present.
      ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress,
    })
  } catch (err) {
    console.error('audit write failed:', (err as Error).message)
  }
}
