import { tr } from '../lib/i18n'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

const PATHS = {
  home: 'M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z',
  file: 'M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9zM14 3v6h6M8 13h8M8 17h5',
  gavel: 'M14.5 12.5l-8 8a2.12 2.12 0 01-3-3l8-8M16 16l6-6M8 8l6-6M9 7l8 8M21 11l-8-8',
  tag: 'M20.6 13.4l-7.2 7.2a2 2 0 01-2.8 0L3 13V3h10l7.6 7.6a2 2 0 010 2.8zM7.5 7.5h.01',
  wallet: 'M20 7H5a2 2 0 010-4h13v4M20 7v12a2 2 0 01-2 2H5a2 2 0 01-2-2V5M16 13h.01',
  receipt: 'M5 3v18l2.5-1.5L10 21l2-1.5 2 1.5 2.5-1.5L19 21V3l-2.5 1.5L14 3l-2 1.5L10 3 7.5 4.5zM9 9h6M9 13h6',
  calendar: 'M8 3v3M16 3v3M4 8h16M5 5h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z',
  users: 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zm13 10v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
  check: 'M9 12l2 2 4-4M12 22a10 10 0 100-20 10 10 0 000 20z',
  clock: 'M12 22a10 10 0 100-20 10 10 0 000 20zm0-15v5l3 2',
  plus: 'M12 5v14M5 12h14',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4',
  alert: 'M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z',
  coins: 'M8 14a6 6 0 100-12 6 6 0 000 12zM18.1 10.4A6 6 0 1110.4 18.1M7 6h1v4M16.7 13.9l.7.7-2.8 2.8',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z',
  bell: 'M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0',
  lock: 'M5 11h14a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2v-7a2 2 0 012-2zM7 11V7a5 5 0 0110 0v4',
  device: 'M5 4h14a1 1 0 011 1v10a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1zM8 20h8M12 16v4',
  megaphone: 'M3 11v2a1 1 0 001 1h2l5 4V6L6 10H4a1 1 0 00-1 1zM15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13',
  history: 'M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8M3 3v5h5M12 7v5l4 2',
  trophy: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4zM17 6h3v1.5a3.5 3.5 0 01-3.5 3.5M7 6H4v1.5A3.5 3.5 0 007.5 11',
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, className = 'h-5 w-5' }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  )
}

const TONES = {
  pine: 'bg-pine-soft text-pine',
  gold: 'bg-gold-soft text-gold-deep',
  green: 'bg-[#E2F0E8] text-ok',
  blue: 'bg-info-soft text-info-deep',
  red: 'bg-rose-soft text-rose-deep',
} as const

export function StatTile({ icon, label, value, hint, tone = 'pine', to, highlight }: {
  icon: IconName; label: string; value: ReactNode; hint?: string; tone?: keyof typeof TONES; to?: string; highlight?: boolean
}) {
  const body = (
    <>
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${TONES[tone]}`}><Icon name={icon} /></span>
      <span className="min-w-0">
        <span className="block text-[13.5px] font-medium text-muted">{label}</span>
        <span className="num block text-[24px] font-extrabold leading-tight text-ink">{value}</span>
        {hint && <span className="block truncate text-[12.5px] text-muted">{hint}</span>}
      </span>
    </>
  )
  const cls = `panel flex items-center gap-4 p-4 transition-shadow ${highlight ? 'ring-2 ring-gold/60' : ''} ${to ? 'hover:shadow-lift' : ''}`
  return to ? <Link to={to} className={cls}>{body}</Link> : <div className={cls}>{body}</div>
}

export function SectionCard({ title, icon, action, children, className = '' }: {
  title: string; icon?: IconName; action?: ReactNode; children: ReactNode; className?: string
}) {
  return (
    <section className={`panel overflow-hidden ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
        <h2 className="flex items-center gap-2 text-[17px]">{icon && <Icon name={icon} className="h-[18px] w-[18px] text-gold-deep" />}{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export function Alert({ icon = 'alert', tone = 'gold', to, children, aside }: {
  icon?: IconName; tone?: 'gold' | 'red' | 'green'; to?: string; children: ReactNode; aside?: ReactNode
}) {
  const t = { gold: 'border-gold/50 bg-gold-soft text-gold-deep', red: 'border-bad/40 bg-bad/5 text-bad', green: 'border-ok/40 bg-[#E2F0E8] text-ok' }[tone]
  const inner = (
    <>
      <Icon name={icon} className="h-5 w-5 shrink-0" />
      <span className="flex-1 text-[15px] font-bold text-ink">{children}</span>
      {aside}
      {to && <Icon name="arrow" className="h-4 w-4 shrink-0 rtl:rotate-180" />}
    </>
  )
  const cls = `flex items-center gap-3 rounded-lg border px-4 py-3 ${t}`
  return to ? <Link to={to} className={`${cls} hover:brightness-[.98]`}>{inner}</Link> : <div className={cls}>{inner}</div>
}

/** Celebration banner for a name the owner won at auction. */
export function WinAlert({ name, note, to, aside }: { name: string; note?: ReactNode; to?: string; aside?: ReactNode }) {
  const inner = (
    <>
      <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-b from-[#E2C27E] to-[#C99532] text-paper shadow-[0_6px_16px_-6px_rgba(174,131,44,.8)] ring-4 ring-gold/15">
        <Icon name="trophy" className="h-6 w-6" />
        <span className="absolute -end-0.5 -top-0.5 text-[13px]" aria-hidden>✦</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[16.5px] font-extrabold text-ink">{tr('مبارك عليك الفوز بمزاد شعار', 'Congratulations on winning the auction for')} «{name}»</span>
        {note && <span className="mt-0.5 block text-[14px] font-medium text-gold-deep">{note}</span>}
      </span>
      {aside}
      {to && <Icon name="arrow" className="h-4 w-4 shrink-0 text-gold-deep rtl:rotate-180" />}
    </>
  )
  const cls = 'flex items-center gap-4 rounded-xl border border-gold/60 bg-gradient-to-l from-gold-soft via-[#FBF4E4] to-gold-soft px-4 py-3.5'
  return to ? <Link to={to} className={`${cls} transition hover:shadow-card`}>{inner}</Link> : <div className={cls}>{inner}</div>
}

/** 4-step progress used for a request's journey */
export function StepDots({ done }: { done: number }) {
  return (
    <span className="flex items-center gap-1" aria-label={`${done} ${tr('من', 'of')} 4`}>
      {[0, 1, 2, 3].map((i) => <span key={i} className={`h-1.5 w-5 rounded-full ${i < done ? 'bg-ok' : 'bg-stone-deep'}`} />)}
    </span>
  )
}
