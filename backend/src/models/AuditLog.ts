import mongoose, { Schema, Document } from 'mongoose'

/**
 * Immutable record of every privileged action an admin takes.
 *
 * The point is accountability after the fact: "who suspended this seller",
 * "who released this escrow", "who issued a password reset for that account".
 * Written on the action path, never edited afterwards — there is intentionally
 * no update or delete route, because a log an admin can rewrite is not evidence.
 */
export interface IAuditLog extends Document {
  actorId: mongoose.Types.ObjectId
  actorEmail: string
  actorRole: string
  action: string
  targetType: string
  targetId?: string
  targetLabel?: string
  summary: string
  meta?: Record<string, unknown>
  ip?: string
  createdAt: Date
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // Denormalised so the trail stays readable even if the admin account is
    // later renamed or removed — an audit entry pointing at a deleted user id
    // tells an auditor nothing.
    actorEmail: { type: String, required: true },
    actorRole: { type: String, required: true },
    action: { type: String, required: true },
    targetType: { type: String, required: true },
    targetId: { type: String },
    targetLabel: { type: String },
    summary: { type: String, required: true },
    meta: { type: Schema.Types.Mixed },
    ip: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

AuditLogSchema.index({ createdAt: -1 })
AuditLogSchema.index({ actorId: 1, createdAt: -1 })
AuditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 })

export default mongoose.model<IAuditLog>('AuditLog', AuditLogSchema)
