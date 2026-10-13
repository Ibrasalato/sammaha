import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { TYPE_LABEL } from '../lib/config'
import { remaining, remainingText } from '../lib/format'
import { useNow } from '../lib/store'
import type { AuctionPhase, NameType, RequestStatus } from '../lib/types'

/** The wasm seal — every camel name is shown as a brand-mark stamp in its type colour. */
export function NameSeal({ name, type, size = 'md' }: { name: string; type: NameType; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const dims = { sm: 'w-14 text-[15px]', md: 'w-24 text-xl', lg: 'w-36 text-3xl', xl: 'w-56 text-5xl sm:w-64 sm:text-6xl' }[size]
  return (
    <div className={`seal seal-${type} ${dims} shrink-0 font-kufi font-semibold`} aria-label={`${name} — ${TYPE_LABEL[type]}`}>
      <span className="px-2 text-center leading-tight">{name}</span>
    </div>
  )
}

export function TypeBadge({ type }: { type: NameType }) {
  return (
    <span className={`pill ${type === 'qaadan' ? 'bg-qaadan-soft text-qaadan-deep' : 'bg-bakkar-soft text-bakkar-deep'}`}>
      <span className={`h-2 w-2 rounded-full ${type === 'qaadan' ? 'bg-qaadan' : 'bg-bakkar'}`} />
      {TYPE_LABEL[type]}
    </span>
  )
}

export function PhasePill({ phase }: { phase: AuctionPhase }) {
  const m = {
    live: ['bg-ok/10 text-ok', 'جارٍ الآن'],
    scheduled: ['bg-gold-soft text-gold-deep', 'قادم'],
    ended: ['bg-stone-deep text-muted', 'منتهٍ'],
  }[phase]
  return (
    <span className={`pill ${m[0]}`}>
      {phase === 'live' && <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-ok" /></span>}
      {m[1]}
    </span>
  )
}

export const REQUEST_STATUS: Record<RequestStatus, [string, string]> = {
  pending_payment: ['بانتظار سداد الضمان', 'bg-gold-soft text-gold-deep'],
  under_review: ['تحت المراجعة', 'bg-qaadan-soft text-qaadan-deep'],
  accepted: ['مقبول', 'bg-ok/10 text-ok'],
  rejected: ['مرفوض', 'bg-bad/10 text-bad'],
  cancelled: ['ملغى', 'bg-stone-deep text-muted'],
}
export function RequestStatusPill({ status }: { status: RequestStatus }) {
  const [label, cls] = REQUEST_STATUS[status]
  return <span className={`pill ${cls}`}>{label}</span>
}

export function Countdown({ to, prefix, className = '' }: { to: string; prefix?: string; className?: string }) {
  const now = useNow(1000)
  const ms = Date.parse(to) - now
  const r = remaining(ms)
  const urgent = !r.done && ms < 3600_000
  return (
    <span className={`num ${urgent ? 'text-bad' : ''} ${className}`}>
      {prefix && <span className="text-muted">{prefix} </span>}
      {remainingText(ms)}
    </span>
  )
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/50 p-0 sm:items-center sm:p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className={`max-h-[92vh] w-full overflow-auto rounded-t-2xl bg-paper p-5 sm:rounded-2xl sm:p-6 ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-xl">{title}</h2>
          <button className="rounded-md px-2 text-2xl leading-none text-muted hover:text-ink" onClick={onClose} aria-label="إغلاق">×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="panel flex flex-col items-center gap-3 px-6 py-12 text-center">
      <p className="font-kufi text-lg">{title}</p>
      {children}
    </div>
  )
}

export function Loading() {
  return <div className="py-16 text-center text-muted">جارٍ التحميل…</div>
}

export function ErrorBox({ text }: { text: string }) {
  return <div className="rounded-lg border border-bad/30 bg-bad/5 px-4 py-3 text-[15px] text-bad">{text}</div>
}

export function PageHead({ title, sub, action }: { title: string; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl sm:text-3xl">{title}</h1>
        {sub && <p className="mt-1 text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  )
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="inline-flex rounded-lg border border-line bg-paper p-1" role="tablist">
      {options.map(([v, label]) => (
        <button key={v} role="tab" aria-selected={value === v} onClick={() => onChange(v)}
          className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${value === v ? 'bg-ink text-paper' : 'text-muted hover:text-ink'}`}>
          {label}
        </button>
      ))}
    </div>
  )
}
