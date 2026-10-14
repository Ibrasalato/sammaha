import { tr } from '../lib/i18n'
/** Grey placeholder with a soft shimmer, shown while data loads. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton rounded-md bg-stone-deep ${className}`} aria-hidden />
}

/** Generic page placeholder: a heading and a few panels. */
export function PageSkeleton() {
  return (
    <div className="space-y-4 py-6" role="status" aria-label={tr('جارٍ التحميل', 'Loading')}>
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-80 max-w-full" />
      <div className="grid gap-4 pt-2 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="panel space-y-3 p-5"><Skeleton className="h-20 w-full rounded-lg" /><Skeleton className="h-4 w-2/3" /><Skeleton className="h-4 w-1/2" /></div>
        ))}
      </div>
      <div className="panel space-y-3 p-5">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-4 w-full" />)}</div>
    </div>
  )
}
