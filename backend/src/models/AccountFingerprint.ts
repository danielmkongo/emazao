import mongoose, { Schema, Document } from 'mongoose'

/**
 * Coarse device/network fingerprints per account, used to spot one person
 * operating both sides of a "sale".
 *
 * Values are hashed, never stored raw: an IP address is personal data under the
 * Personal Data Protection Act 2022, and we only ever need to ask "do these two
 * accounts share one", which equality over hashes answers just as well.
 *
 * Deliberately coarse — this is a signal that feeds a human review queue, not an
 * identity system. Shared fingerprints are genuinely common in Tanzania (family
 * phones, village cybercafés, carrier-grade NAT), so this must never auto-ban.
 */
export interface IAccountFingerprint extends Document {
  userId: mongoose.Types.ObjectId
  ipHash: string
  uaHash: string
  firstSeen: Date
  lastSeen: Date
  hits: number
}

const AccountFingerprintSchema = new Schema<IAccountFingerprint>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  ipHash: { type: String, required: true },
  uaHash: { type: String, required: true },
  firstSeen: { type: Date, default: Date.now },
  lastSeen: { type: Date, default: Date.now },
  hits: { type: Number, default: 1 },
})

AccountFingerprintSchema.index({ userId: 1, ipHash: 1, uaHash: 1 }, { unique: true })
AccountFingerprintSchema.index({ ipHash: 1 })
// Fingerprints age out after 180 days — retaining them indefinitely would be a
// data-minimisation problem with no forensic benefit.
AccountFingerprintSchema.index({ lastSeen: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 })

export default mongoose.model<IAccountFingerprint>('AccountFingerprint', AccountFingerprintSchema)
