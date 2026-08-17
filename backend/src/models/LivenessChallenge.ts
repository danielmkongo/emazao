import mongoose, { Schema, Document } from 'mongoose'

/**
 * A one-time, server-issued liveness challenge.
 *
 * The security of challenge-response liveness rests entirely on the *server*
 * choosing the actions, in a random order, with a short expiry. If the client
 * picked them, an attacker would simply record a video performing every action
 * once and replay the matching clip. Because the sequence is unpredictable and
 * short-lived, a pre-recorded video almost never matches the requested order.
 *
 * The challenge is consumed on first verification attempt so the same captured
 * frames can never be submitted twice.
 */
export type LivenessAction = 'BLINK' | 'LOOK_LEFT' | 'LOOK_RIGHT' | 'SMILE' | 'OPEN_MOUTH'

export const LIVENESS_ACTIONS: LivenessAction[] = ['BLINK', 'LOOK_LEFT', 'LOOK_RIGHT', 'SMILE', 'OPEN_MOUTH']

export interface ILivenessChallenge extends Document {
  userId: mongoose.Types.ObjectId
  nonce: string
  actions: LivenessAction[]
  consumed: boolean
  passed?: boolean
  score?: number
  failureReason?: string
  expiresAt: Date
  createdAt: Date
}

const LivenessChallengeSchema = new Schema<ILivenessChallenge>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    nonce: { type: String, required: true, unique: true },
    actions: [{ type: String, enum: LIVENESS_ACTIONS, required: true }],
    consumed: { type: Boolean, default: false },
    passed: { type: Boolean },
    score: { type: Number },
    failureReason: { type: String },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
)

LivenessChallengeSchema.index({ userId: 1, createdAt: -1 })
// Mongo reaps expired challenges itself; an unconsumed challenge has no value
// once its window closes.
LivenessChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export default mongoose.model<ILivenessChallenge>('LivenessChallenge', LivenessChallengeSchema)
