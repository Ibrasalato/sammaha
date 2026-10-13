import { Link } from 'react-router-dom'
import { tr } from '../lib/i18n'
import { TYPE_LABEL } from '../lib/config'
import { phaseOf } from '../lib/demoApi'
import { cur, date, dateTime, humanLeft, num, remaining, time } from '../lib/format'
import { useNow } from '../lib/store'
import type { Auction } from '../lib/types'
import { CARD_STYLES, CARD_STYLE_LABEL, setCardStyle, useCardStyle } from '../lib/cardStyle'
import type { CardStyle } from '../lib/cardStyle'
import { getLang } from '../lib/i18n'

const pad = (n: number) => String(n).padStart(2, '0')

/** d / h / m / s boxes — the classic auction-house countdown */
export function CountdownBoxes({ to, tone = 'ink' }: { to: string; tone?: 'ink' | 'urgent' | 'dark' }) {
  const now = useNow(1000)
  const r = remaining(Date.parse(to) - now)
  const cells: [number, string][] = [[r.d, tr('يوم', 'Days')], [r.h, tr('ساعة', 'Hrs')], [r.m, tr('دقيقة', 'Min')], [r.s, tr('ثانية', 'Sec')]]
  return (
    <div className="grid grid-cols-4 gap-1.5" role="timer" aria-label={tr(`متبقٍ ${r.d} يوم ${r.h} ساعة ${r.m} دقيقة`, `${r.d} days ${r.h} hours ${r.m} minutes left`)}>
      {cells.map(([v, l]) => (
        <div key={l} className={`rounded-md py-1 text-center ${tone === 'urgent' ? 'bg-bad/10 text-bad' : tone === 'dark' ? 'bg-paper/10 text-paper' : 'bg-stone text-ink'}`}>
          <div className="num text-[16px] font-extrabold leading-tight">{pad(v)}</div>
          <div className="text-[10.5px] font-bold opacity-70">{l}</div>
        </div>
      ))}
    </div>
  )
}

function Icon({ d, className = 'h-4 w-4' }: { d: string; className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden><path d={d} /></svg>
}
const ICON = {
  gavel: 'M14.5 12.5l-8 8a2.12 2.12 0 01-3-3l8-8M16 16l6-6M8 8l6-6M9 7l8 8M21 11l-8-8',
  users: 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zm13 10v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
  clock: 'M12 22a10 10 0 100-20 10 10 0 000 20zm0-15v5l3 2',
  check: 'M20 6L9 17l-5-5',
}

/** Quiet single-line time for anything more than a day away */
function TimeLine({ label, ms, at }: { label: string; ms: number; at: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md bg-stone px-3 py-2.5 text-[13.5px]">
      <span className="flex items-center gap-1.5 text-muted"><Icon d={ICON.clock} className="h-3.5 w-3.5" />{label}</span>
      <span className="font-bold" title={dateTime(at)}>{humanLeft(ms)}</span>
    </div>
  )
}

function ModernCard({ a }: { a: Auction }) {
  const now = useNow(1000)
  const phase = phaseOf(a, now)
  const q = a.type === 'qaadan'
  const price = phase === 'ended' && a.finalPrice ? a.finalPrice : a.currentPrice
  const start = Date.parse(a.startsAt)
  const end = Date.parse(a.endsAt)
  const elapsed = phase === 'live' ? Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100)) : phase === 'ended' ? 100 : 0
  const urgent = phase === 'live' && end - now < 3600_000
  const lastDay = phase === 'live' && end - now < 86_400_000

  return (
    <Link to={`/auctions/${a.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-line bg-paper shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift">
      {/* Lot visual */}
      <div className={`lot-field lot-${a.type} relative flex h-28 flex-col items-center justify-center text-paper`}>
        <span className="absolute start-3 top-3 rounded bg-paper/95 px-2 py-0.5 text-[12px] font-extrabold" style={{ color: q ? '#143F63' : '#742838' }}>{TYPE_LABEL[a.type]}</span>
        <span className="absolute end-3 top-3">
          {phase === 'live' && <span className="flex items-center gap-1.5 rounded bg-ink/35 px-2 py-0.5 text-[12px] font-bold backdrop-blur-sm"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#5BE39B]" />{tr('مباشر', 'Live')}</span>}
          {phase === 'scheduled' && <span className="rounded bg-ink/35 px-2 py-0.5 text-[12px] font-bold backdrop-blur-sm">{tr('قريبًا', 'Soon')}</span>}
          {phase === 'ended' && <span className="rounded bg-ink/45 px-2 py-0.5 text-[12px] font-bold backdrop-blur-sm">{tr('منتهٍ', 'Ended')}</span>}
        </span>
        <span className="text-[30px] font-extrabold leading-none drop-shadow-sm">{a.name}</span>
        {phase === 'ended' && a.settled && (
          <span className="absolute bottom-2 flex items-center gap-1 rounded-full bg-paper px-2.5 py-px text-[11.5px] font-extrabold text-ok">
            <Icon d={ICON.check} className="h-3.5 w-3.5" />{tr('تمت الترسية', 'Awarded')}
          </span>
        )}
      </div>
      {/* time progress */}
      <div className="h-1 bg-stone-deep"><div className={`h-full ${urgent ? 'bg-bad' : 'bg-gold'}`} style={{ width: `${elapsed}%` }} /></div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-[12.5px] font-medium text-muted">{phase === 'ended' ? tr('سعر الترسية', 'Hammer price') : a.bidCount ? tr('أعلى مزايدة', 'Top bid') : tr('السعر الافتتاحي', 'Opening price')}</div>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <span className="num text-[24px] font-extrabold leading-none text-ink">{num(price)}</span>
              <span className="text-[13px] font-medium text-muted">{cur()}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 text-[12px] font-medium text-muted">
            <span className="flex items-center gap-1.5"><Icon d={ICON.gavel} />{a.bidCount ? tr(`${num(a.bidCount)} مزايدة`, `${num(a.bidCount)} bids`) : tr('لا مزايدات', 'No bids')}</span>
            {a.leaderLabel && phase === 'live' && <span className="flex items-center gap-1.5"><Icon d={ICON.users} />{a.leaderLabel}</span>}
          </div>
        </div>

        {phase === 'live' && (lastDay ? (
          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-medium text-muted"><Icon d={ICON.clock} className="h-3.5 w-3.5" />{tr('ينتهي خلال', 'Ends in')}</div>
            <CountdownBoxes to={a.endsAt} tone={urgent ? 'urgent' : 'ink'} />
          </div>
        ) : (
          <TimeLine label={tr('ينتهي خلال', 'Ends in')} ms={end - now} at={a.endsAt} />
        ))}
        {phase === 'scheduled' && <TimeLine label={tr('يبدأ خلال', 'Starts in')} ms={start - now} at={a.startsAt} />}
        {phase === 'ended' && (
          <div className="rounded-md bg-stone px-3 py-2 text-[13px]">
            <span className="font-bold">{a.settled ? (a.wonByRequester ? tr('رسا على مقدم الطلب', 'Awarded to the applicant') : tr('رسا على أعلى مزايد', 'Awarded to top bidder')) : tr('جارٍ الترسية', 'Awarding')}</span>
            <span className="text-muted">{tr('، انتهى', ', ended')} {date(a.endsAt)} {time(a.endsAt)}</span>
          </div>
        )}

        <div className="mt-auto">
          {phase === 'live'
            ? <span className="btn-gold btn-sm w-full py-2">{tr('زايد الآن', 'Bid now')}</span>
            : <span className="btn-ghost btn-sm w-full py-2 group-hover:border-pine">{phase === 'scheduled' ? tr('تفاصيل المزاد', 'View auction') : tr('عرض النتيجة', 'View result')}</span>}
        </div>
      </div>
    </Link>
  )
}

// ───────────────────────── shared lot state for the alternative designs ─────────────────────────
function useLot(a: Auction) {
  const now = useNow(1000)
  const phase = phaseOf(a, now)
  const start = Date.parse(a.startsAt)
  const end = Date.parse(a.endsAt)
  return {
    now, phase, start, end,
    price: phase === 'ended' && a.finalPrice ? a.finalPrice : a.currentPrice,
    priceLabel: phase === 'ended' ? tr('سعر الترسية', 'Hammer price') : a.bidCount ? tr('أعلى مزايدة', 'Top bid') : tr('السعر الافتتاحي', 'Opening price'),
    elapsed: phase === 'live' ? Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100)) : phase === 'ended' ? 100 : 0,
    urgent: phase === 'live' && end - now < 3600_000,
    lastDay: phase === 'live' && end - now < 86_400_000,
    bids: a.bidCount ? tr(`${num(a.bidCount)} مزايدة`, `${num(a.bidCount)} bids`) : tr('لا مزايدات', 'No bids'),
    status: phase === 'live' ? tr('مباشر', 'Live') : phase === 'scheduled' ? tr('قريبًا', 'Soon') : a.settled ? tr('تمت الترسية', 'Awarded') : tr('منتهٍ', 'Ended'),
    timeLabel: phase === 'live' ? tr('ينتهي خلال', 'Ends in') : phase === 'scheduled' ? tr('يبدأ خلال', 'Starts in') : tr('انتهى', 'Ended'),
    timeValue: phase === 'live' ? humanLeft(end - now) : phase === 'scheduled' ? humanLeft(start - now) : date(a.endsAt),
    cta: phase === 'live' ? tr('زايد الآن', 'Bid now') : phase === 'scheduled' ? tr('تفاصيل المزاد', 'View auction') : tr('عرض النتيجة', 'View result'),
  }
}

const TYPE_HEX = { qaadan: { base: '#1E5A8C', deep: '#143F63', soft: '#E7EFF7' }, bakkar: { base: '#A23B4F', deep: '#742838', soft: '#F7E8EB' } } as const

function LiveDot({ light }: { light?: boolean }) {
  return <span className={`h-1.5 w-1.5 animate-pulse rounded-full ${light ? 'bg-[#5BE39B]' : 'bg-ok'}`} />
}

/** Classic: an auction-house catalogue entry — double gold frame, ornament rules, centred name. */
function ClassicCard({ a }: { a: Auction }) {
  const l = useLot(a)
  const c = TYPE_HEX[a.type]
  const Rule = () => (
    <div className="my-2 flex items-center justify-center gap-2 text-gold" aria-hidden>
      <span className="h-px w-10 bg-gold/60" /><span className="h-1.5 w-1.5 rotate-45 bg-gold" /><span className="h-px w-10 bg-gold/60" />
    </div>
  )
  return (
    <Link to={`/auctions/${a.id}`} className="group flex flex-col rounded-lg border border-gold/50 bg-paper p-1.5 shadow-card transition hover:-translate-y-0.5 hover:shadow-lift">
      <div className="flex flex-1 flex-col rounded border border-gold/35 px-4 pb-4 pt-3 text-center">
        <div className="flex items-center justify-between text-[12px] font-bold">
          <span style={{ color: c.base }}>{TYPE_LABEL[a.type]}</span>
          <span className="flex items-center gap-1.5 text-muted">{l.phase === 'live' && <LiveDot />}{l.status}</span>
        </div>
        <Rule />
        <div className="text-[30px] font-extrabold leading-tight" style={{ color: c.deep }}>{a.name}</div>
        <Rule />
        <div className="text-[12.5px] text-muted">{l.priceLabel}</div>
        <div className="mt-0.5 flex items-baseline justify-center gap-1.5"><span className="num text-[26px] font-extrabold leading-none">{num(l.price)}</span><span className="text-[13px] text-muted">{cur()}</span></div>
        <dl className="mt-4 grid grid-cols-2 divide-x divide-gold/30 border-y border-gold/30 py-2 text-[12.5px] rtl:divide-x-reverse">
          <div><dt className="text-muted">{tr('المزايدات', 'Bids')}</dt><dd className="num font-bold">{num(a.bidCount)}</dd></div>
          <div><dt className="text-muted">{l.timeLabel}</dt><dd className={`font-bold ${l.urgent ? 'text-bad' : ''}`} title={dateTime(l.phase === 'scheduled' ? a.startsAt : a.endsAt)}>{l.timeValue}</dd></div>
        </dl>
        <span className={`mt-4 ${l.phase === 'live' ? 'btn-primary' : 'btn-ghost group-hover:border-pine'} btn-sm w-full py-2`}>{l.cta}</span>
      </div>
    </Link>
  )
}

/** Heritage: warm sand paper, Sadu band, diamond type mark. */
function HeritageCard({ a }: { a: Auction }) {
  const l = useLot(a)
  const c = TYPE_HEX[a.type]
  return (
    <Link to={`/auctions/${a.id}`} className="group flex flex-col overflow-hidden rounded-xl border border-[#E5D7B8] bg-[#FBF6EA] shadow-card transition hover:-translate-y-0.5 hover:shadow-lift">
      <div className="sadu sadu-thin" aria-hidden />
      <div className="px-4 pb-3 pt-4 text-center">
        <div className="flex items-center justify-between text-[12px] font-extrabold">
          <span className="inline-flex items-center gap-1.5" style={{ color: c.deep }}><span className="h-2.5 w-2.5 rotate-45" style={{ background: c.base }} />{TYPE_LABEL[a.type]}</span>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 ${l.phase === 'live' ? 'bg-[#E3EFE6] text-ok' : 'bg-[#EFE5CF] text-[#7A5B2A]'}`}>{l.phase === 'live' && <LiveDot />}{l.status}</span>
        </div>
        <div className="relative mx-auto mt-3 w-fit px-6 py-2">
          <span className="absolute inset-y-0 start-0 w-2 border-y-2 border-s-2" style={{ borderColor: c.base }} aria-hidden />
          <span className="absolute inset-y-0 end-0 w-2 border-y-2 border-e-2" style={{ borderColor: c.base }} aria-hidden />
          <span className="text-[30px] font-extrabold leading-tight text-[#3A2A14]">{a.name}</span>
        </div>
      </div>
      <div className="mx-4 border-t border-dashed border-[#D8C69C]" />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-end justify-between">
          <div><div className="text-[12.5px] text-[#8B7550]">{l.priceLabel}</div><div className="flex items-baseline gap-1.5"><span className="num text-[24px] font-extrabold leading-none text-[#3A2A14]">{num(l.price)}</span><span className="text-[13px] text-[#8B7550]">{cur()}</span></div></div>
          <span className="flex items-center gap-1.5 text-[12px] font-medium text-[#8B7550]"><Icon d={ICON.gavel} />{l.bids}</span>
        </div>
        {l.lastDay
          ? <CountdownBoxes to={a.endsAt} tone={l.urgent ? 'urgent' : 'ink'} />
          : <div className="flex items-center justify-between rounded-md bg-[#F3EAD6] px-3 py-2 text-[13px]"><span className="text-[#8B7550]">{l.timeLabel}</span><b className="text-[#3A2A14]">{l.timeValue}</b></div>}
        <span className={`mt-auto btn-sm w-full py-2 ${l.phase === 'live' ? 'btn-gold' : 'btn border border-[#D8C69C] bg-transparent text-[#5C4520] group-hover:border-gold'}`}>{l.cta}</span>
      </div>
    </Link>
  )
}

/** Luxury: deep green, gold type, for a premium evening-sale feel. */
function LuxuryCard({ a }: { a: Auction }) {
  const l = useLot(a)
  const c = TYPE_HEX[a.type]
  return (
    <Link to={`/auctions/${a.id}`} className="hero-field group flex flex-col overflow-hidden rounded-xl text-paper shadow-lift ring-1 ring-gold/40 transition hover:-translate-y-0.5 hover:ring-gold">
      <div className="px-5 pb-4 pt-4">
        <div className="flex items-center justify-between text-[12px] font-bold">
          <span className="inline-flex items-center gap-1.5 text-paper/85"><span className="h-2.5 w-2.5 rounded-full ring-2 ring-paper/30" style={{ background: c.base }} />{TYPE_LABEL[a.type]}</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 px-2 py-0.5 text-gold-light">{l.phase === 'live' && <LiveDot light />}{l.status}</span>
        </div>
        <div className="mt-5 text-center text-[32px] font-extrabold leading-tight text-gold-light">{a.name}</div>
        <div className="mx-auto mt-3 h-px w-16 bg-gradient-to-r from-transparent via-gold to-transparent" aria-hidden />
      </div>
      <div className="flex flex-1 flex-col gap-3 bg-black/15 p-5">
        <div className="flex items-end justify-between">
          <div><div className="text-[12.5px] text-paper/60">{l.priceLabel}</div><div className="flex items-baseline gap-1.5"><span className="num text-[26px] font-extrabold leading-none">{num(l.price)}</span><span className="text-[13px] text-paper/60">{cur()}</span></div></div>
          <span className="flex items-center gap-1.5 text-[12px] text-paper/70"><Icon d={ICON.gavel} />{l.bids}</span>
        </div>
        {l.lastDay
          ? <CountdownBoxes to={a.endsAt} tone="dark" />
          : <div className="flex items-center justify-between rounded-md bg-paper/[.07] px-3 py-2 text-[13px]"><span className="text-paper/60">{l.timeLabel}</span><b>{l.timeValue}</b></div>}
        <span className={`mt-auto btn-sm w-full py-2 ${l.phase === 'live' ? 'btn-gold' : 'btn border border-paper/25 text-paper group-hover:border-gold'}`}>{l.cta}</span>
      </div>
    </Link>
  )
}

/** Compact list row for scanning many lots quickly. */
function MinimalRow({ a }: { a: Auction }) {
  const l = useLot(a)
  const c = TYPE_HEX[a.type]
  return (
    <Link to={`/auctions/${a.id}`} className="group relative flex items-center gap-4 overflow-hidden rounded-lg border border-line bg-paper py-3 pe-4 ps-5 transition hover:border-pine hover:shadow-card">
      <span className="absolute inset-y-0 start-0 w-1.5" style={{ background: c.base }} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-[20px] font-extrabold leading-tight">{a.name}</span>
          <span className="rounded px-1.5 py-px text-[11.5px] font-extrabold" style={{ background: c.soft, color: c.deep }}>{TYPE_LABEL[a.type]}</span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] text-muted">
          <span className={`inline-flex items-center gap-1.5 font-bold ${l.phase === 'live' ? 'text-ok' : ''}`}>{l.phase === 'live' && <LiveDot />}{l.status}</span>
          <span>·</span><span className={l.urgent ? 'font-bold text-bad' : ''}>{l.timeLabel} {l.timeValue}</span>
          <span>·</span><span>{l.bids}</span>
        </div>
      </div>
      <div className="text-end">
        <div className="text-[11.5px] text-muted">{l.priceLabel}</div>
        <div className="num text-[20px] font-extrabold leading-tight">{num(l.price)} <span className="text-[12px] font-medium text-muted">{cur()}</span></div>
      </div>
      {l.phase === 'live'
        ? <span className="btn-gold btn-sm hidden sm:inline-flex">{tr('زايد', 'Bid')}</span>
        : <Icon d="M5 12h14M13 6l6 6-6 6" className="h-5 w-5 text-muted group-hover:text-pine rtl:rotate-180" />}
    </Link>
  )
}

export function AuctionCard({ a, style }: { a: Auction; style?: CardStyle }) {
  const chosen = useCardStyle()
  switch (style ?? chosen) {
    case 'classic': return <ClassicCard a={a} />
    case 'heritage': return <HeritageCard a={a} />
    case 'luxury': return <LuxuryCard a={a} />
    case 'minimal': return <MinimalRow a={a} />
    default: return <ModernCard a={a} />
  }
}

/** Grid that follows the visitor's chosen design (the compact list uses rows instead of tiles). */
export function AuctionGrid({ list, className = '' }: { list: Auction[]; className?: string }) {
  const style = useCardStyle()
  const grid = style === 'minimal' ? 'grid gap-2.5 lg:grid-cols-2' : 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
  return <div className={`${grid} ${className}`}>{list.map((a) => <AuctionCard key={a.id} a={a} style={style} />)}</div>
}

/** Small thumbnail of each design so the choice is visual, not just a word. */
function Thumb({ s }: { s: CardStyle }) {
  const box = 'h-6 w-8 shrink-0 overflow-hidden rounded-[3px]'
  if (s === 'modern') return <span className={`${box} flex flex-col border border-line bg-paper`}><span className="h-3 bg-qaadan" /><span className="mx-1 mt-1 h-0.5 rounded bg-muted/40" /></span>
  if (s === 'classic') return <span className={`${box} grid place-items-center border border-gold/70 bg-paper p-[2px]`}><span className="grid h-full w-full place-items-center rounded-[2px] border border-gold/50"><span className="h-0.5 w-3 bg-qaadan-deep" /></span></span>
  if (s === 'heritage') return <span className={`${box} flex flex-col border border-[#E5D7B8] bg-[#FBF6EA]`}><span className="sadu h-1.5" style={{ backgroundSize: '12px 6px' }} /><span className="m-auto h-1.5 w-1.5 rotate-45 bg-bakkar" /></span>
  if (s === 'luxury') return <span className={`${box} grid place-items-center bg-pine ring-1 ring-gold/60`}><span className="h-0.5 w-4 bg-gold-light" /></span>
  return <span className={`${box} flex flex-col justify-center gap-[3px] border border-line bg-paper px-1`}>{[0, 1, 2].map((i) => <span key={i} className="flex items-center gap-0.5"><span className={`h-1.5 w-0.5 ${i === 1 ? 'bg-bakkar' : 'bg-qaadan'}`} /><span className="h-0.5 flex-1 bg-muted/40" /></span>)}</span>
}

export function CardStylePicker({ className = '' }: { className?: string }) {
  const style = useCardStyle()
  const ar = getLang() === 'ar'
  return (
    <div className={`-mx-4 flex items-center gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 ${className}`} role="radiogroup" aria-label={tr('شكل بطاقات المزاد', 'Auction card design')}>
      <span className="shrink-0 text-[13px] font-medium text-muted">{tr('شكل البطاقات', 'Card design')}</span>
      {CARD_STYLES.map((s) => (
        <button key={s} type="button" role="radio" aria-checked={style === s} onClick={() => setCardStyle(s)}
          className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md border px-2.5 py-1.5 text-[13px] font-bold transition-colors ${style === s ? 'border-pine bg-pine-soft text-pine' : 'border-line bg-paper text-muted hover:border-pine/40 hover:text-ink'}`}>
          <Thumb s={s} />{CARD_STYLE_LABEL[s][ar ? 0 : 1]}
        </button>
      ))}
    </div>
  )
}
