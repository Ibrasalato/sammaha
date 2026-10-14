import { Link } from 'react-router-dom'
import { tr } from '../lib/i18n'
import { TYPE_HEX, TYPE_LABEL } from '../lib/config'
import { phaseOf } from '../lib/demoApi'
import { cur, date, dateTime, humanLeft, num, remaining, time } from '../lib/format'
import { useNow } from '../lib/store'
import type { Auction } from '../lib/types'
import { CARD_STYLES, CARD_STYLE_LABEL, setCardStyle, useCardStyle, useCompact } from '../lib/cardStyle'
import type { CardStyle } from '../lib/cardStyle'
import { getLang } from '../lib/i18n'

const pad = (n: number) => String(n).padStart(2, '0')

/** d / h / m / s boxes — the classic auction-house countdown */
export function CountdownBoxes({ to, tone = 'ink', compact = false }: { to: string; tone?: 'ink' | 'urgent' | 'dark'; compact?: boolean }) {
  const now = useNow(1000)
  const r = remaining(Date.parse(to) - now)
  if (compact) {
    // phones: one line, d:h:m:s
    return (
      <div role="timer" className={`num flex items-center justify-center gap-1.5 rounded-md py-1 text-[13px] font-extrabold ${tone === 'urgent' ? 'bg-bad/10 text-bad' : tone === 'dark' ? 'bg-paper/10 text-paper' : 'bg-stone text-ink'}`}>
        {r.d > 0 && <span>{tr(`${r.d} يوم`, `${r.d}d`)}</span>}
        <span dir="ltr">{pad(r.h)}:{pad(r.m)}:{pad(r.s)}</span>
      </div>
    )
  }
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
function TimeLine({ label, ms, at, k = false }: { label: string; ms: number; at: string; k?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-2 rounded-md bg-stone ${k ? 'flex-wrap px-2 py-1.5 text-[11.5px]' : 'px-3 py-2.5 text-[13.5px]'}`}>
      <span className="flex items-center gap-1.5 text-muted"><Icon d={ICON.clock} className="h-3.5 w-3.5" />{label}</span>
      <span className="font-bold" title={dateTime(at)}>{humanLeft(ms)}</span>
    </div>
  )
}

function ModernCard({ a }: { a: Auction }) {
  const now = useNow(1000)
  const phase = phaseOf(a, now)
  const price = phase === 'ended' && a.finalPrice ? a.finalPrice : a.currentPrice
  const start = Date.parse(a.startsAt)
  const end = Date.parse(a.endsAt)
  const elapsed = phase === 'live' ? Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100)) : phase === 'ended' ? 100 : 0
  const urgent = phase === 'live' && end - now < 3600_000
  const lastDay = phase === 'live' && end - now < 86_400_000
  const k = useCompact()

  return (
    <Link to={`/auctions/${a.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-line bg-paper shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift">
      {/* Lot visual */}
      <div className={`lot-field lot-${a.type} relative flex flex-col items-center justify-center text-paper ${k ? 'h-[84px] pt-4' : 'h-28'}`}>
        <span className={`absolute rounded bg-paper/95 font-extrabold ${k ? 'start-1.5 top-1.5 px-1.5 py-px text-[10.5px]' : 'start-3 top-3 px-2 py-0.5 text-[12px]'}`} style={{ color: TYPE_HEX[a.type].deep }}>{TYPE_LABEL[a.type]}</span>
        <span className={`absolute ${k ? 'end-1.5 top-1.5 [&>span]:px-1.5 [&>span]:text-[10.5px]' : 'end-3 top-3'}`}>
          {phase === 'live' && <span className="flex items-center gap-1.5 rounded bg-ink/35 px-2 py-0.5 text-[12px] font-bold backdrop-blur-sm"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#5BE39B]" />{tr('مباشر', 'Live')}</span>}
          {phase === 'scheduled' && <span className="rounded bg-ink/35 px-2 py-0.5 text-[12px] font-bold backdrop-blur-sm">{tr('قريبًا', 'Soon')}</span>}
          {phase === 'ended' && <span className="rounded bg-ink/45 px-2 py-0.5 text-[12px] font-bold backdrop-blur-sm">{tr('منتهٍ', 'Ended')}</span>}
        </span>
        <span className={`max-w-full truncate px-2 font-extrabold leading-none drop-shadow-sm ${k ? 'text-[19px]' : 'text-[30px]'}`}>{a.name}</span>
        {phase === 'ended' && a.settled && (
          <span className="absolute bottom-2 flex items-center gap-1 rounded-full bg-paper px-2.5 py-px text-[11.5px] font-extrabold text-ok">
            <Icon d={ICON.check} className="h-3.5 w-3.5" />{tr('تمت الترسية', 'Awarded')}
          </span>
        )}
      </div>
      {/* time progress */}
      <div className="h-1 bg-stone-deep"><div className={`h-full ${urgent ? 'bg-bad' : 'bg-gold'}`} style={{ width: `${elapsed}%` }} /></div>

      <div className={`flex flex-1 flex-col ${k ? 'gap-2 p-2.5' : 'gap-3 p-4'}`}>
        <div className={`flex justify-between gap-3 ${k ? 'flex-col items-start gap-1' : 'items-end'}`}>
          <div>
            <div className={`font-medium text-muted ${k ? 'text-[11px]' : 'text-[12.5px]'}`}>{phase === 'ended' ? tr('سعر الترسية', 'Hammer price') : a.bidCount ? tr('أعلى مزايدة', 'Top bid') : tr('السعر الافتتاحي', 'Opening price')}</div>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <span className={`num font-extrabold leading-none text-ink ${k ? 'text-[18px]' : 'text-[24px]'}`}>{num(price)}</span>
              <span className="text-[13px] font-medium text-muted">{cur()}</span>
            </div>
          </div>
          <div className={`flex flex-col gap-1 font-medium text-muted ${k ? 'items-start text-[11px] [&_svg]:h-3 [&_svg]:w-3' : 'items-end text-[12px]'}`}>
            <span className="flex items-center gap-1.5"><Icon d={ICON.gavel} />{a.bidCount ? tr(`${num(a.bidCount)} مزايدة`, `${num(a.bidCount)} bids`) : tr('لا مزايدات', 'No bids')}</span>
            {a.leaderLabel && phase === 'live' && <span className="flex items-center gap-1.5"><Icon d={ICON.users} />{a.leaderLabel}</span>}
          </div>
        </div>

        {phase === 'live' && (lastDay ? (
          <div>
            {!k && <div className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-medium text-muted"><Icon d={ICON.clock} className="h-3.5 w-3.5" />{tr('ينتهي خلال', 'Ends in')}</div>}
            <CountdownBoxes to={a.endsAt} tone={urgent ? 'urgent' : 'ink'} compact={k} />
          </div>
        ) : (
          <TimeLine label={tr('ينتهي خلال', 'Ends in')} ms={end - now} at={a.endsAt} k={k} />
        ))}
        {phase === 'scheduled' && <TimeLine label={tr('يبدأ خلال', 'Starts in')} ms={start - now} at={a.startsAt} k={k} />}
        {phase === 'ended' && (
          <div className={`rounded-md bg-stone ${k ? 'px-2 py-1.5 text-[11.5px] [&>span:last-child]:hidden' : 'px-3 py-2 text-[13px]'}`}>
            <span className="font-bold">{a.settled ? (a.wonByRequester ? tr('رسا على مقدم الطلب', 'Awarded to the applicant') : tr('رسا على أعلى مزايد', 'Awarded to top bidder')) : tr('جارٍ الترسية', 'Awarding')}</span>
            <span className="text-muted">{tr('، انتهى', ', ended')} {date(a.endsAt)} {time(a.endsAt)}</span>
          </div>
        )}

        <div className="mt-auto">
          {phase === 'live'
            ? <span className={`btn-gold btn-sm w-full ${k ? 'min-h-0 py-1.5 text-[13px]' : 'py-2'}`}>{tr('زايد الآن', 'Bid now')}</span>
            : <span className={`btn-ghost btn-sm w-full group-hover:border-pine ${k ? 'min-h-0 py-1.5 text-[13px]' : 'py-2'}`}>{phase === 'scheduled' ? tr('تفاصيل المزاد', 'View auction') : tr('عرض النتيجة', 'View result')}</span>}
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
  const k = useCompact()
  return {
    now, phase, start, end, k,
    /** size classes: phones (k) get a compact two-per-row card */
    z: {
      name: k ? 'text-[19px]' : 'text-[30px]',
      price: k ? 'text-[18px]' : 'text-[26px]',
      label: k ? 'text-[11px]' : 'text-[12.5px]',
      meta: k ? 'text-[11px]' : 'text-[12px]',
      body: k ? 'gap-2 p-2.5' : 'gap-3 p-4',
      row: k ? 'flex-col items-start gap-1' : 'items-end',
      line: k ? 'flex-wrap gap-x-1 px-2 py-1.5 text-[11.5px]' : 'px-3 py-2 text-[13px]',
      btn: k ? 'min-h-0 py-1.5 text-[13px]' : 'py-2',
    },
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


function LiveDot({ light }: { light?: boolean }) {
  return <span className={`h-1.5 w-1.5 animate-pulse rounded-full ${light ? 'bg-[#5BE39B]' : 'bg-ok'}`} />
}

/** Sammha identity: logo green and gold with the category colours — qaadan purple, bakkar green, manqiya gold. */
const BRAND = {
  qaadan: { head: '#5A3F7A', glow: 'rgba(226,194,126,.22)', rule: 'from-[#AE832C] via-[#E2C27E] to-[#AE832C]', price: '#5A3F7A', ink: '#3B2752', soft: '#F1ECF7', btn: '#5A3F7A', btnHover: 'group-hover:bg-[#4A3366]', btnRing: 'ring-[#E2C27E]/60', status: '#F1DDA8' },
  bakkar: { head: '#1D5C2F', glow: 'rgba(226,194,126,.22)', rule: 'from-[#AE832C] via-[#E2C27E] to-[#AE832C]', price: '#1D5C2F', ink: '#123D20', soft: '#EAF2EC', btn: '#1D5C2F', btnHover: 'group-hover:bg-[#164A25]', btnRing: 'ring-[#E2C27E]/60', status: '#F1DDA8' },
  manqiya: { head: '#9C7425', glow: 'rgba(255,255,255,.20)', rule: 'from-[#1D5C2F] via-[#3E8550] to-[#1D5C2F]', price: '#8C6A22', ink: '#5C4413', soft: '#F6EEDB', btn: '#8C6A22', btnHover: 'group-hover:bg-[#765817]', btnRing: 'ring-[#1D5C2F]/40', status: '#FFF3D6' },
} as const

function BrandCard({ a }: { a: Auction }) {
  const l = useLot(a)
  const b = BRAND[a.type]
  return (
    <Link to={`/auctions/${a.id}`} className="group flex flex-col overflow-hidden rounded-xl border bg-paper shadow-card transition hover:-translate-y-0.5 hover:shadow-lift" style={{ borderColor: `${b.head}40` }}>
      <div className={`relative overflow-hidden text-paper ${l.k ? 'px-2 pb-3 pt-2' : 'px-4 pb-5 pt-3'}`} style={{ backgroundColor: b.head, backgroundImage: `radial-gradient(ellipse 90% 80% at 100% 0%, ${b.glow}, transparent 60%)` }}>
        <img src="./sammha-logo-light.png" alt="" aria-hidden className={`pointer-events-none absolute -bottom-3 end-2 w-auto max-w-none opacity-[.14] ${l.k ? 'h-12' : 'h-20'}`} />
        <div className={`relative flex items-center justify-between font-bold ${l.k ? 'text-[10.5px]' : 'text-[12px]'}`}>
          <span className={`inline-flex items-center gap-1.5 rounded-full bg-paper font-extrabold ${l.k ? 'px-1.5 py-px' : 'px-2 py-0.5'}`} style={{ color: b.ink }}><span className="h-2 w-2 rounded-full" style={{ background: b.head }} />{TYPE_LABEL[a.type]}</span>
          <span className="inline-flex items-center gap-1.5" style={{ color: b.status }}>{l.phase === 'live' && <LiveDot light />}{l.status}</span>
        </div>
        <div className={`relative truncate text-center font-extrabold leading-tight drop-shadow-sm ${l.k ? 'mt-2' : 'mt-4'} ${l.z.name}`}>{a.name}</div>
      </div>
      <div className={`h-1 bg-gradient-to-l ${b.rule}`} aria-hidden />
      <div className={`flex flex-1 flex-col ${l.z.body}`}>
        <div className={`flex justify-between ${l.z.row}`}>
          <div><div className={`text-muted ${l.z.label}`}>{l.priceLabel}</div><div className="flex items-baseline gap-1.5"><span className={`num font-extrabold leading-none ${l.z.price}`} style={{ color: b.price }}>{num(l.price)}</span><span className="text-[13px] text-muted">{cur()}</span></div></div>
          <span className={`flex items-center gap-1.5 font-medium ${l.z.meta}`} style={{ color: b.price }}><Icon d={ICON.gavel} className={l.k ? 'h-3 w-3' : 'h-4 w-4'} />{l.bids}</span>
        </div>
        {l.lastDay
          ? <CountdownBoxes to={a.endsAt} tone={l.urgent ? 'urgent' : 'ink'} compact={l.k} />
          : <div className={`flex items-center justify-between rounded-md ${l.z.line}`} style={{ background: b.soft }}><span style={{ color: b.price }}>{l.timeLabel}</span><b style={{ color: b.ink }}>{l.timeValue}</b></div>}
        {l.phase === 'live'
          ? <span className={`mt-auto btn btn-sm w-full text-paper ring-1 ring-inset ${l.z.btn} ${b.btnRing} ${b.btnHover}`} style={{ backgroundColor: b.btn }}>{l.cta}</span>
          : <span className={`mt-auto btn btn-sm w-full border ${l.z.btn}`} style={{ borderColor: `${b.head}55`, color: b.price }}>{l.cta}</span>}
      </div>
    </Link>
  )
}

/** Classic: an auction-house catalogue entry — double gold frame, ornament rules, centred name. */
function ClassicCard({ a }: { a: Auction }) {
  const l = useLot(a)
  const c = TYPE_HEX[a.type]
  const Rule = () => (
    <div className={`flex items-center justify-center gap-2 text-gold ${l.k ? 'my-1' : 'my-2'}`} aria-hidden>
      <span className={`h-px bg-gold/60 ${l.k ? 'w-6' : 'w-10'}`} /><span className="h-1.5 w-1.5 rotate-45 bg-gold" /><span className={`h-px bg-gold/60 ${l.k ? 'w-6' : 'w-10'}`} />
    </div>
  )
  return (
    <Link to={`/auctions/${a.id}`} className="group flex flex-col rounded-lg border border-gold/50 bg-paper p-1.5 shadow-card transition hover:-translate-y-0.5 hover:shadow-lift">
      <div className={`flex flex-1 flex-col rounded border border-gold/35 text-center ${l.k ? 'px-2 pb-2.5 pt-2' : 'px-4 pb-4 pt-3'}`}>
        <div className={`flex items-center justify-between font-bold ${l.k ? 'text-[10.5px]' : 'text-[12px]'}`}>
          <span style={{ color: c.base }}>{TYPE_LABEL[a.type]}</span>
          <span className="flex items-center gap-1.5 text-muted">{l.phase === 'live' && <LiveDot />}{l.status}</span>
        </div>
        <Rule />
        <div className={`truncate font-extrabold leading-tight ${l.z.name}`} style={{ color: c.deep }}>{a.name}</div>
        <Rule />
        <div className={`text-muted ${l.z.label}`}>{l.priceLabel}</div>
        <div className="mt-0.5 flex items-baseline justify-center gap-1.5"><span className={`num font-extrabold leading-none ${l.z.price}`}>{num(l.price)}</span><span className="text-[13px] text-muted">{cur()}</span></div>
        <dl className={`grid grid-cols-2 divide-x divide-gold/30 border-y border-gold/30 rtl:divide-x-reverse ${l.k ? 'mt-2.5 py-1.5 text-[11px]' : 'mt-4 py-2 text-[12.5px]'}`}>
          <div><dt className="text-muted">{tr('المزايدات', 'Bids')}</dt><dd className="num font-bold">{num(a.bidCount)}</dd></div>
          <div><dt className="text-muted">{l.timeLabel}</dt><dd className={`font-bold ${l.urgent ? 'text-bad' : ''}`} title={dateTime(l.phase === 'scheduled' ? a.startsAt : a.endsAt)}>{l.timeValue}</dd></div>
        </dl>
        <span className={`${l.k ? 'mt-2.5' : 'mt-4'} ${l.phase === 'live' ? 'btn-primary' : 'btn-ghost group-hover:border-pine'} btn-sm w-full ${l.z.btn}`}>{l.cta}</span>
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
      <div className={`text-center ${l.k ? 'px-2 pb-2 pt-2.5' : 'px-4 pb-3 pt-4'}`}>
        <div className={`flex items-center justify-between font-extrabold ${l.k ? 'text-[10.5px]' : 'text-[12px]'}`}>
          <span className="inline-flex items-center gap-1.5" style={{ color: c.deep }}><span className="h-2.5 w-2.5 rotate-45" style={{ background: c.base }} />{TYPE_LABEL[a.type]}</span>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 ${l.phase === 'live' ? 'bg-[#E3EFE6] text-ok' : 'bg-[#EFE5CF] text-[#7A5B2A]'}`}>{l.phase === 'live' && <LiveDot />}{l.status}</span>
        </div>
        <div className={`relative mx-auto w-fit max-w-full ${l.k ? 'mt-2 px-3 py-1' : 'mt-3 px-6 py-2'}`}>
          <span className="absolute inset-y-0 start-0 w-2 border-y-2 border-s-2" style={{ borderColor: c.base }} aria-hidden />
          <span className="absolute inset-y-0 end-0 w-2 border-y-2 border-e-2" style={{ borderColor: c.base }} aria-hidden />
          <span className={`block truncate font-extrabold leading-tight text-[#3A2A14] ${l.z.name}`}>{a.name}</span>
        </div>
      </div>
      <div className={`border-t border-dashed border-[#D8C69C] ${l.k ? 'mx-2' : 'mx-4'}`} />
      <div className={`flex flex-1 flex-col ${l.z.body}`}>
        <div className={`flex justify-between ${l.z.row}`}>
          <div><div className={`text-[#8B7550] ${l.z.label}`}>{l.priceLabel}</div><div className="flex items-baseline gap-1.5"><span className={`num font-extrabold leading-none text-[#3A2A14] ${l.z.price}`}>{num(l.price)}</span><span className="text-[13px] text-[#8B7550]">{cur()}</span></div></div>
          <span className={`flex items-center gap-1.5 font-medium text-[#8B7550] ${l.z.meta}`}><Icon d={ICON.gavel} className={l.k ? 'h-3 w-3' : 'h-4 w-4'} />{l.bids}</span>
        </div>
        {l.lastDay
          ? <CountdownBoxes to={a.endsAt} tone={l.urgent ? 'urgent' : 'ink'} compact={l.k} />
          : <div className={`flex items-center justify-between rounded-md bg-[#F3EAD6] ${l.z.line}`}><span className="text-[#8B7550]">{l.timeLabel}</span><b className="text-[#3A2A14]">{l.timeValue}</b></div>}
        <span className={`mt-auto btn-sm w-full ${l.z.btn} ${l.phase === 'live' ? 'btn-gold' : 'btn border border-[#D8C69C] bg-transparent text-[#5C4520] group-hover:border-gold'}`}>{l.cta}</span>
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
      <div className={l.k ? 'px-2 pb-2.5 pt-2.5' : 'px-5 pb-4 pt-4'}>
        <div className={`flex items-center justify-between font-bold ${l.k ? 'text-[10.5px]' : 'text-[12px]'}`}>
          <span className="inline-flex items-center gap-1.5 text-paper/85"><span className="h-2.5 w-2.5 rounded-full ring-2 ring-paper/30" style={{ background: c.base }} />{TYPE_LABEL[a.type]}</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 px-2 py-0.5 text-gold-light">{l.phase === 'live' && <LiveDot light />}{l.status}</span>
        </div>
        <div className={`truncate text-center font-extrabold leading-tight text-gold-light ${l.k ? 'mt-2.5 text-[20px]' : 'mt-5 text-[32px]'}`}>{a.name}</div>
        <div className={`mx-auto h-px w-16 ${l.k ? 'mt-2' : 'mt-3'} bg-gradient-to-r from-transparent via-gold to-transparent`} aria-hidden />
      </div>
      <div className={`flex flex-1 flex-col bg-black/15 ${l.k ? 'gap-2 p-2.5' : 'gap-3 p-5'}`}>
        <div className={`flex justify-between ${l.z.row}`}>
          <div><div className={`text-paper/60 ${l.z.label}`}>{l.priceLabel}</div><div className="flex items-baseline gap-1.5"><span className={`num font-extrabold leading-none ${l.z.price}`}>{num(l.price)}</span><span className="text-[13px] text-paper/60">{cur()}</span></div></div>
          <span className={`flex items-center gap-1.5 text-paper/70 ${l.z.meta}`}><Icon d={ICON.gavel} className={l.k ? 'h-3 w-3' : 'h-4 w-4'} />{l.bids}</span>
        </div>
        {l.lastDay
          ? <CountdownBoxes to={a.endsAt} tone="dark" compact={l.k} />
          : <div className={`flex items-center justify-between rounded-md bg-paper/[.07] ${l.z.line}`}><span className="text-paper/60">{l.timeLabel}</span><b>{l.timeValue}</b></div>}
        <span className={`mt-auto btn-sm w-full ${l.z.btn} ${l.phase === 'live' ? 'btn-gold' : 'btn border border-paper/25 text-paper group-hover:border-gold'}`}>{l.cta}</span>
      </div>
    </Link>
  )
}

/** Compact list row for scanning many lots quickly. */
function MinimalRow({ a }: { a: Auction }) {
  const l = useLot(a)
  const c = TYPE_HEX[a.type]
  return (
    <Link to={`/auctions/${a.id}`} className={`group relative flex items-center overflow-hidden rounded-lg border border-line bg-paper transition hover:border-pine hover:shadow-card ${l.k ? 'gap-2.5 py-2 pe-3 ps-4' : 'gap-4 py-3 pe-4 ps-5'}`}>
      <span className="absolute inset-y-0 start-0 w-1.5" style={{ background: c.base }} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`truncate font-extrabold leading-tight ${l.k ? 'text-[17px]' : 'text-[20px]'}`}>{a.name}</span>
          <span className="rounded px-1.5 py-px text-[11.5px] font-extrabold" style={{ background: c.soft, color: c.deep }}>{TYPE_LABEL[a.type]}</span>
        </div>
        <div className={`mt-0.5 flex flex-wrap items-center gap-x-2 text-muted ${l.k ? 'text-[11.5px]' : 'text-[13px]'}`}>
          <span className={`inline-flex items-center gap-1.5 font-bold ${l.phase === 'live' ? 'text-ok' : ''}`}>{l.phase === 'live' && <LiveDot />}{l.status}</span>
          <span>·</span><span className={l.urgent ? 'font-bold text-bad' : ''}>{l.timeLabel} {l.timeValue}</span>
          <span>·</span><span>{l.bids}</span>
        </div>
      </div>
      <div className="text-end">
        <div className="text-[11.5px] text-muted">{l.priceLabel}</div>
        <div className={`num font-extrabold leading-tight ${l.k ? 'text-[16px]' : 'text-[20px]'}`}>{num(l.price)} <span className="text-[12px] font-medium text-muted">{cur()}</span></div>
      </div>
      {l.phase === 'live'
        ? <span className="btn-gold btn-sm hidden sm:inline-flex">{tr('زايد', 'Bid')}</span>
        : <Icon d="M5 12h14M13 6l6 6-6 6" className="h-5 w-5 text-muted group-hover:text-pine rtl:rotate-180" />}
    </Link>
  )
}

/** Corner ribbon carrying the category, in the category colour. */
function CornerRibbon({ label, color, deep, small = false }: { label: string; color: string; deep: string; small?: boolean }) {
  return (
    <span className={`pointer-events-none absolute -right-[5px] -top-[5px] overflow-hidden ${small ? 'h-[66px] w-[66px]' : 'h-[104px] w-[104px] -right-[7px] -top-[7px]'}`} aria-hidden>
      <span className={`absolute left-0 top-0 ${small ? 'h-[5px] w-[5px]' : 'h-[7px] w-[7px]'}`} style={{ background: deep }} />
      <span className={`absolute bottom-0 right-0 ${small ? 'h-[5px] w-[5px]' : 'h-[7px] w-[7px]'}`} style={{ background: deep }} />
      <span className={`absolute rotate-45 text-center font-extrabold text-paper shadow-md ${small ? '-right-[26px] top-[13px] w-[104px] py-0.5 text-[9.5px]' : '-right-[34px] top-[24px] w-[150px] py-1.5 text-[13px]'}`}
        style={{ background: `linear-gradient(180deg, ${color}, ${deep})` }}>{label}</span>
    </span>
  )
}
/** Round medal for a resale («بيع اسم») auction. */
export function ResaleMedal({ className = '' }: { className?: string }) {
  return (
    <span className={`pointer-events-none absolute grid h-12 w-12 place-items-center rounded-full border-[3px] border-[#D9BD82] bg-gradient-to-b from-[#1F7A3A] to-[#145227] text-paper shadow-lg ${className}`} title={tr('إعادة بيع', 'Resale')} aria-hidden>
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 01-15.3 6.4M3 12A9 9 0 0118.3 5.6M18 2v4h-4M6 22v-4h4" /></svg>
    </span>
  )
}

/** Ribbon: a white-to-sand catalogue card, gold name, the category on a corner ribbon, gold pill button on the edge. */
function RibbonCard({ a }: { a: Auction }) {
  const l = useLot(a)
  const c = TYPE_HEX[a.type]
  return (
    <Link to={`/auctions/${a.id}`} className={`group relative flex flex-col rounded-md border border-[#C9A55A]/70 bg-gradient-to-b from-paper via-paper to-[#EAD9B4] text-center shadow-card transition hover:-translate-y-0.5 hover:shadow-lift ${l.k ? 'mb-4 px-2 pb-6 pt-4' : 'mb-5 px-5 pb-9 pt-6'}`}>
      <CornerRibbon label={TYPE_LABEL[a.type]} color={c.base} deep={c.deep} small={l.k} />
      {a.listingId && <ResaleMedal className={l.k ? '-left-2 -top-2 scale-75' : '-left-3 -top-3'} />}
      {a.investment && <span className={`absolute rounded-full bg-[#F3EBDA] font-extrabold text-[#80601E] ${l.k ? 'left-1.5 top-1.5 px-1.5 text-[9.5px]' : 'left-3 top-3 px-2 py-0.5 text-[11px]'}`}>{tr('استثمار', 'Investment')}</span>}
      <div className={`truncate font-extrabold leading-tight text-[#A87C26] ${l.k ? 'px-4 text-[20px]' : 'px-6 text-[38px]'}`}>{a.name}</div>
      <div className={`mx-auto h-px w-[85%] bg-ink/25 ${l.k ? 'mt-1.5' : 'mt-2'}`} />
      <div className={`text-ink/80 ${l.k ? 'mt-1.5 text-[10.5px]' : 'mt-2 text-[13px]'}`}>{l.phase === 'live' ? tr('الوقت المتبقي حتى نهاية المزاد', 'Time left') : l.phase === 'scheduled' ? tr('يبدأ المزاد خلال', 'Starts in') : tr('انتهى المزاد', 'Auction ended')}</div>
      <div className="mt-2">
        {l.phase === 'ended'
          ? <div className={`rounded-md bg-paper/80 font-bold ${l.k ? 'py-1 text-[12px]' : 'py-2 text-[14px]'}`}>{date(a.endsAt)}</div>
          : <CountdownBoxes to={l.phase === 'live' ? a.endsAt : a.startsAt} tone={l.urgent ? 'urgent' : 'ink'} compact={l.k} />}
      </div>
      <div className={`flex items-baseline justify-center gap-1.5 ${l.k ? 'mt-2.5' : 'mt-4'}`}>
        <span className={`num font-black leading-none tracking-tight ${l.k ? 'text-[22px]' : 'text-[44px]'}`}>{num(l.price)}</span><span className={l.k ? 'text-[11px]' : 'text-[15px]'}>{cur()}</span>
      </div>
      <div className={`mt-1 text-ink/80 ${l.k ? 'text-[10.5px]' : 'text-[14px]'}`}>{l.phase === 'ended' ? tr('سعر الترسية', 'Hammer price') : a.bidCount ? tr('مبلغ الأعلى مزايدة', 'Highest bid') : tr('السعر الافتتاحي', 'Opening price')}</div>
      <span className={`absolute left-1/2 inline-flex -translate-x-1/2 items-center whitespace-nowrap rounded-full border border-[#A87C26]/50 bg-gradient-to-b from-[#D9B867] to-[#B88E3A] font-extrabold text-paper shadow-md transition group-hover:brightness-105 ${l.k ? '-bottom-4 gap-1 px-3.5 py-1.5 text-[12.5px]' : '-bottom-5 gap-2 px-7 py-2 text-[17px]'}`}>
        <Icon d={ICON.gavel} className={l.k ? 'h-3 w-3' : 'h-4 w-4'} />{l.phase === 'live' ? tr('زايد الآن', 'Bid now') : l.phase === 'scheduled' ? tr('تفاصيل المزاد', 'View auction') : tr('عرض النتيجة', 'View result')}
      </span>
    </Link>
  )
}

export function AuctionCard({ a, style }: { a: Auction; style?: CardStyle }) {
  const chosen = useCardStyle()
  switch (style ?? chosen) {
    case 'brand': return <BrandCard a={a} />
    case 'ribbon': return <RibbonCard a={a} />
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
  // phones: two compact cards per row; ribbon cards need extra row gap for the button on their edge
  const grid = style === 'minimal' ? 'grid gap-2.5 lg:grid-cols-2'
    : `grid grid-cols-2 gap-x-2.5 ${style === 'ribbon' ? 'gap-y-6' : 'gap-y-2.5'} sm:gap-4 lg:grid-cols-3 xl:grid-cols-4`
  return <div className={`${grid} ${className}`}>{list.map((a) => <AuctionCard key={a.id} a={a} style={style} />)}</div>
}

/** Small thumbnail of each design so the choice is visual, not just a word. */
function Thumb({ s }: { s: CardStyle }) {
  const box = 'h-6 w-8 shrink-0 overflow-hidden rounded-[3px]'
  if (s === 'modern') return <span className={`${box} flex flex-col border border-line bg-paper`}><span className="h-3 bg-qaadan" /><span className="mx-1 mt-1 h-0.5 rounded bg-muted/40" /></span>
  if (s === 'brand') return <span className={`${box} flex border border-[#1D5C2F]/30 bg-paper`}><span className="h-3 flex-1 bg-[#5A3F7A]" /><span className="h-3 flex-1 bg-[#1D5C2F]" /><span className="h-3 flex-1 bg-[#9C7425]" /></span>
  if (s === 'ribbon') return <span className={`${box} relative overflow-hidden border border-[#C9A55A] bg-gradient-to-b from-paper to-[#EAD9B4]`}><span className="absolute -right-2 top-1 h-1.5 w-6 rotate-45 bg-[#1F6B3A]" /><span className="absolute inset-x-1.5 top-2.5 h-0.5 bg-[#A87C26]" /></span>
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
