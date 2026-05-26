/**
 * Skeleton — shimmer loading placeholders.
 * Uses the .skeleton CSS class defined in globals.css.
 */

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return <div className={`skeleton ${className}`} aria-hidden />
}

export function SkeletonStatCard() {
  return (
    <div className="bg-[#141414] border border-[#1f1f1f] rounded-xl p-5">
      <Skeleton className="h-2.5 w-20 mb-3" />
      <Skeleton className="h-7 w-16 mb-2" />
      <Skeleton className="h-2 w-28" />
    </div>
  )
}

export function SkeletonCampaignRow() {
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-2 w-2/5" />
      </div>
      <Skeleton className="h-2.5 w-14 rounded-full" />
      <Skeleton className="h-2 w-10" />
    </div>
  )
}

export function SkeletonInsight() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1a1a1a] last:border-0">
      <Skeleton className="w-5 h-5 rounded flex-shrink-0" />
      <Skeleton className="h-2.5 flex-1" />
    </div>
  )
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="bg-[#141414] border border-[#1f1f1f] rounded-xl p-5 space-y-3">
      <Skeleton className="h-3 w-24" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-2.5 ${i === lines - 1 ? 'w-3/5' : 'w-full'}`} />
      ))}
    </div>
  )
}
