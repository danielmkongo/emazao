import mongoose, { Schema, Document } from 'mongoose'

export interface ICategory extends Document {
  name: string
  slug: string
  icon?: string
  image?: string
  description?: string
  parentId?: mongoose.Types.ObjectId
  createdAt: Date
}

const CategorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true, unique: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    icon: { type: String },
    image: { type: String },
    description: { type: String },
    parentId: { type: Schema.Types.ObjectId, ref: 'Category' },
  },
  { timestamps: true }
)

export default mongoose.model<ICategory>('Category', CategorySchema)
