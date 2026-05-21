import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
}

export const Skeleton = ({ className }: SkeletonProps) => (
  <div
    className={cn(
      'animate-pulse rounded-xl bg-gradient-to-r from-brand-800 via-brand-700/50 to-brand-800 bg-[length:200%_100%]',
      className
    )}
    style={{ animation: 'shimmer 1.5s ease-in-out infinite' }}
  />
)

export const ProductCardSkeleton = () => (
  <div className="rounded-2xl bg-brand-800 border border-white/[0.06] overflow-hidden">
    <Skeleton className="aspect-square rounded-none" />
    <div className="p-4 space-y-3">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-6 w-1/3" />
    </div>
  </div>
)

export const FeedPostSkeleton = () => (
  <div className="rounded-2xl bg-brand-800 border border-white/[0.06] p-4 space-y-4">
    <div className="flex items-center gap-3">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="space-y-2 flex-1">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-2 w-1/4" />
      </div>
    </div>
    <Skeleton className="aspect-video rounded-xl" />
    <div className="space-y-2">
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-3/4" />
    </div>
  </div>
)
