import Category from '../models/Category'

const CATEGORIES = [
  { name: 'Fruits & Vegetables', slug: 'fruits-vegetables', icon: '🥬', description: 'Fresh produce' },
  { name: 'Grains & Cereals', slug: 'grains-cereals', icon: '🌾', description: 'Wheat, maize, rice, millet' },
  { name: 'Livestock & Poultry', slug: 'livestock-poultry', icon: '🐄', description: 'Cattle, goats, chickens' },
  { name: 'Dairy & Eggs', slug: 'dairy-eggs', icon: '🥛', description: 'Milk, cheese, butter, eggs' },
  { name: 'Spices & Herbs', slug: 'spices-herbs', icon: '🌿', description: 'Pepper, turmeric, ginger, basil' },
  { name: 'Legumes & Pulses', slug: 'legumes-pulses', icon: '🫘', description: 'Beans, lentils, peas, chickpeas' },
  { name: 'Oilseeds & Nuts', slug: 'oilseeds-nuts', icon: '🥜', description: 'Groundnuts, sesame, sunflower' },
  { name: 'Roots & Tubers', slug: 'roots-tubers', icon: '🥔', description: 'Cassava, yam, potatoes, sweet potato' },
  { name: 'Coffee & Tea', slug: 'coffee-tea', icon: '☕', description: 'Coffee beans, tea leaves' },
  { name: 'Sugar & Confectionery', slug: 'sugar-confectionery', icon: '🍯', description: 'Sugar cane, honey, cocoa' },
  { name: 'Cotton & Fibre', slug: 'cotton-fibre', icon: '🌱', description: 'Cotton, sisal, jute' },
  { name: 'Aquaculture & Fish', slug: 'aquaculture-fish', icon: '🐟', description: 'Fresh fish, dried fish, shrimp' },
  { name: 'Processed & Packaged', slug: 'processed-packaged', icon: '📦', description: 'Packaged food products' },
  { name: 'Organic & Specialty', slug: 'organic-specialty', icon: '🌍', description: 'Certified organic products' },
  { name: 'Farm Inputs', slug: 'farm-inputs', icon: '🚜', description: 'Seeds, fertilizers, tools' },
]

export const seedCategories = async () => {
  const existing = await Category.countDocuments()
  if (existing > 0) return

  await Category.insertMany(CATEGORIES)
  console.log(`✅ Seeded ${CATEGORIES.length} categories`)
}
