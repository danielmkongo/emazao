import { useState, useEffect } from 'react'
import { Leaf } from 'lucide-react'

/**
 * Image that degrades to a branded placeholder instead of a broken-image box.
 *
 * A plain <img> with a dead src renders its own alt text inside the image area.
 * On product cards that text landed underneath the "Sponsored"/"Organic" badges
 * and read as overlapping, unreadable copy — which is exactly what a dead
 * Unsplash/CDN link produced in the storefront grid. Listing photos are
 * user-supplied and hotlinked, so treat a broken one as normal, not exceptional.
 */
export function ImageWithFallback({
  src,
  alt,
  className = '',
  fallbackClassName = '',
  loading = 'lazy',
}: {
  src?: string | null
  alt: string
  className?: string
  fallbackClassName?: string
  loading?: 'lazy' | 'eager'
}) {
  const [failed, setFailed] = useState(false)

  // A card can be recycled onto a different product as lists paginate or refetch,
  // so a previous failure must not stick to the next image.
  useEffect(() => { setFailed(false) }, [src])

  if (!src || failed) {
    return (
      <div
        className={`flex items-center justify-center bg-gradient-to-br from-brand-green/5 to-brand-emerald/10 ${fallbackClassName || className}`}
        // Decorative stand-in: the surrounding card already names the product, so
        // announcing "no image" adds noise for screen-reader users.
        role="presentation"
      >
        <Leaf className="h-10 w-10 text-brand-green/25" />
      </div>
    )
  }

  return (
    <img
      src={src}
      // Empty alt so a *pending* failure never paints raw text over the badges;
      // the accessible name comes from the product title next to the image.
      alt={alt}
      className={className}
      loading={loading}
      onError={() => setFailed(true)}
    />
  )
}
