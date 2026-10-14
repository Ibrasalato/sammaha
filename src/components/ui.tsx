import { useEffect } from 'react'
import { PageSkeleton } from './Skeleton'
import { tr } from '../lib/i18n'
import type { ReactNode } from 'react'
import { TYPE_CLS, TYPE_GROUPS, TYPE_HINT, TYPE_LABEL } from '../lib/config'
import { remaining, remainingText } from '../lib/format'
import { useNow } from '../lib/store'
import type { AuctionPhase, NameType, RequestStatus } from '../lib/types'

/**
 * Name tile — the one way a camel name is shown across the platform:
 * white name on the type colour (purple qaadan / green bakkar / gold manqiya) over the Sadu weave, as on auction cards.
 */
export function NameSeal({ name, type, size = 'md', palette = 'standard' }: { name: string; type: NameType; size?: 'sm' | 'md' | 'lg' | 'xl' | 'hero'; palette?: 'standard' | 'brand' }) {
  const dims = {
    sm: 'h-12 w-16 rounded-md text-[14px]',
    md: 'h-[72px] w-28 rounded-lg text-[19px]',
    lg: 'h-28 w-44 rounded-lg text-[30px]',
    xl: 'mx-auto h-40 w-full max-w-sm rounded-xl text-[44px] sm:h-44 sm:text-[52px]',
    hero: 'mx-auto h-28 w-full rounded-xl text-[34px] sm:h-[120px] sm:text-[38px]',
  }[size]
  return (
    <div className={`lot-field ${palette === 'brand' ? `lot-brand-${type}` : `lot-${type}`} ${dims} relative flex shrink-0 flex-col items-center justify-center overflow-hidden text-center font-extrabold leading-none text-paper`}
      aria-label={`${name}، ${TYPE_LABEL[type]}`}>
      {palette === 'brand' && size !== 'sm' && <img src="./sammha-logo-light.svg" alt="" aria-hidden className="pointer-events-none absolute -bottom-3 end-2 h-[70%] w-auto max-w-none opacity-[.14]" />}
      <span className="relative px-2 drop-shadow-sm">{name}</span>
      {size !== 'sm' && <span className={`relative mt-2 font-medium opacity-80 ${size === 'xl' ? 'text-[14px]' : size === 'hero' ? 'text-[12.5px]' : 'text-[11.5px]'}`}>{TYPE_LABEL[type]}</span>}
    </div>
  )
}

export function TypeBadge({ type }: { type: NameType }) {
  return (
    <span className={`pill ${TYPE_CLS[type].pill}`}>
      <span className={`h-2 w-2 rounded-full ${TYPE_CLS[type].dot}`} />
      {TYPE_LABEL[type]}
    </span>
  )
}

/** cancelled and paused auctions take precedence over the time-based phase */
export function AuctionStatePill({ a, phase }: { a: { paused?: boolean; cancelled?: boolean }; phase: AuctionPhase }) {
  if (a.cancelled) return <span className="pill bg-bad/10 text-bad">{tr('ملغى', 'Cancelled')}</span>
  if (a.paused) return <span className="pill bg-info-soft text-info-deep"><span aria-hidden>❚❚</span>{tr('متوقف مؤقتًا', 'Paused')}</span>
  return <PhasePill phase={phase} />
}

export function PhasePill({ phase }: { phase: AuctionPhase }) {
  const m = {
    live: ['bg-[#E2F0E8] text-ok', tr('جارٍ الآن', 'Live')],
    scheduled: ['bg-gold-soft text-gold-deep', tr('قادم', 'Upcoming')],
    ended: ['bg-stone-deep text-muted', tr('منتهٍ', 'Ended')],
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
  under_review: ['تحت المراجعة', 'bg-info-soft text-info-deep'],
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
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-pine/50 p-0 sm:items-center sm:p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className={`max-h-[92vh] w-full overflow-auto rounded-t-2xl bg-paper p-5 sm:rounded-2xl sm:p-6 ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`} onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between gap-4 border-b border-line pb-4">
          <h2 className="text-xl">{title}</h2>
          <button className="rounded-md px-2 text-2xl leading-none text-muted hover:text-ink" onClick={onClose} aria-label={tr('إغلاق', 'Close')}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="panel flex flex-col items-center gap-3 px-6 py-12 text-center">
      <p className="text-lg font-extrabold">{title}</p>
      {children}
    </div>
  )
}

export function Loading() {
  return <PageSkeleton />
}

export function ErrorBox({ text }: { text: string }) {
  return <div className="rounded-lg border border-bad/30 bg-bad/5 px-4 py-3 text-[15px] text-bad">{text}</div>
}

export function PageHead({ title, sub, action }: { title: string; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[26px] sm:text-[32px]">{title}</h1>
        {sub && <p className="mt-1 text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  )
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="inline-flex rounded-md border border-line bg-paper p-1" role="tablist">
      {options.map(([v, label]) => (
        <button key={v} role="tab" aria-selected={value === v} onClick={() => onChange(v)}
          className={`rounded px-3.5 py-1.5 text-sm font-bold transition-colors ${value === v ? 'bg-pine text-paper' : 'text-muted hover:text-pine'}`}>
          {label}
        </button>
      ))}
    </div>
  )
}

/** Category picker grouped as فردي (بكار، قعدان) and منقية; used by every request form. */
export function TypePicker({ value, onChange, compact }: { value: NameType | null; onChange: (t: NameType) => void; compact?: boolean }) {
  return (
    <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
      {TYPE_GROUPS.map((g) => (
        <fieldset key={g.key}>
          <legend className="mb-2 text-[14px] font-bold text-muted">{g.label()} <span className="font-normal">· {g.hint()}</span></legend>
          <div className={`grid gap-3 ${g.types.length > 1 ? 'sm:grid-cols-2' : ''}`}>
            {g.types.map((t) => (
              <button key={t} type="button" onClick={() => onChange(t)} aria-pressed={value === t}
                className={`flex items-center gap-3 rounded-xl border-2 text-start transition-colors ${compact ? 'p-3' : 'p-4'} ${value === t ? TYPE_CLS[t].card : 'border-line bg-paper hover:border-pine'}`}>
                <NameSeal name={TYPE_LABEL[t]} type={t} size="sm" />
                <span><span className={`block font-extrabold ${compact ? 'text-lg' : 'text-xl'}`}>{TYPE_LABEL[t]}</span><span className="text-[13px] text-muted">{TYPE_HINT[t]}</span></span>
              </button>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  )
}
