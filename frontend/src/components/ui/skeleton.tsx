import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
}

export const Skeleton = ({ className }: SkeletonProps) => (
  <div className={cn('skeleton-shimmer rounded-xl', className)} />
)

export const ProductCardSkeleton = () => (
  <div className="rounded-2xl bg-[var(--c-card)] border border-[var(--c-border)] overflow-hidden">
    <Skeleton className="aspect-[4/3] rounded-none" />
    <div className="p-4 space-y-3">
      <Skeleton className="h-4 w-3/4 rounded-lg" />
      <Skeleton className="h-3 w-1/2 rounded-lg" />
      <Skeleton className="h-6 w-1/3 rounded-lg" />
    </div>
  </div>
)

export const FeedPostSkeleton = () => (
  <div className="rounded-2xl bg-[var(--c-card)] border border-[var(--c-border)] p-4 space-y-4">
    <div className="flex items-center gap-3">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="space-y-2 flex-1">
        <Skeleton className="h-3 w-1/3 rounded-lg" />
        <Skeleton className="h-2 w-1/4 rounded-lg" />
      </div>
    </div>
    <Skeleton className="aspect-video rounded-xl" />
    <div className="space-y-2">
      <Skeleton className="h-3 w-full rounded-lg" />
      <Skeleton className="h-3 w-3/4 rounded-lg" />
    </div>
  </div>
)
