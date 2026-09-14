import mongoose, { Schema, Document } from 'mongoose'

/**
 * Platform-wide configuration that operations staff change without a deploy —
 * commission, payout thresholds, whether signups are open. Stored as a single
 * document (`key: 'platform'`) rather than a row per field so a read is one
 * query and an update is atomic across related values.
 *
 * Deliberately excludes anything secret: credentials stay in the environment,
 * where they are not readable through an HTTP endpoint.
 */
export interface IPlatformSetting extends Document {
  key: string
  commissionPercent: number
  minPayoutAmount: number
  maintenanceMode: boolean
  maintenanceMessage: string
  allowRegistrations: boolean
  requireVerificationToSell: boolean
  autoApproveProducts: boolean
  supportEmail: string
  updatedBy?: mongoose.Types.ObjectId
  updatedAt: Date
}

const PlatformSettingSchema = new Schema<IPlatformSetting>(
  {
    key: { type: String, required: true, unique: true, default: 'platform' },
    // Percent of order value the platform keeps. Bounded in the schema as well as
    // the controller: a typo'd 1000 here would silently reprice every future order.
    commissionPercent: { type: Number, default: 5, min: 0, max: 50 },
    minPayoutAmount: { type: Number, default: 10000, min: 0 },
    maintenanceMode: { type: Boolean, default: false },
    maintenanceMessage: { type: String, default: 'eMazao is briefly down for maintenance. Please check back shortly.' },
    allowRegistrations: { type: Boolean, default: true },
    requireVerificationToSell: { type: Boolean, default: false },
    autoApproveProducts: { type: Boolean, default: true },
    supportEmail: { type: String, default: 'support@emazao.com' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
)

export default mongoose.model<IPlatformSetting>('PlatformSetting', PlatformSettingSchema)
