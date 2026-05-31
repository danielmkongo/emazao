import {
  Apple, Wheat, Coffee, Leaf, Beef, Bean, Carrot, Candy, Droplet, CupSoda, Sprout,
  type LucideIcon,
} from 'lucide-react'

// Maps category slugs to consistent Lucide SVG icons (no emoji — keeps the UI professional)
const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  'fruits-vegetables': Apple,
  'grains-cereals': Wheat,
  'coffee-tea': Coffee,
  'spices-herbs': Leaf,
  'livestock-poultry': Beef,
  'nuts-seeds': Bean,
  'roots-tubers': Carrot,
  'sugar-confectionery': Candy,
  'oils-fats': Droplet,
  'beverages': CupSoda,
}

export function CategoryIcon({ slug, className = 'h-4 w-4' }: { slug?: string; className?: string }) {
  const Icon = (slug && CATEGORY_ICON_MAP[slug]) || Sprout
  return <Icon className={className} aria-hidden="true" />
}
