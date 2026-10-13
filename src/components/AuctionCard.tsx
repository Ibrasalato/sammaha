import { Link } from 'react-router-dom'
import { tr } from '../lib/i18n'
import { TYPE_LABEL } from '../lib/config'
import { phaseOf } from '../lib/demoApi'
import { cur, date, dateTime, humanLeft, num, remaining, time } from '../lib/format'
import { useNow } from '../lib/store'
import type { Auction } from '../lib/types'

const pad = (n: number) => String(n).padStart(2, '0')

/** d / h / m / s boxes — the classic auction-house countdown */
export function CountdownBoxes({ to, tone = 'ink' }: { to: string; tone?: 'ink' | 'urgent' }) {
  const now = useNow(1000)
  const r = remaining(Date.parse(to) - now)
  const cells: [number, string][] = [[r.d, tr('يوم', 'Days')], [r.h, tr('ساعة', 'Hrs')], [r.m, tr('دقيقة', 'Min')], [r.s, tr('ثانية', 'Sec')]]
  return (
    <div className="grid grid-cols-4 gap-1.5" role="timer" aria-label={tr(`متبقٍ ${r.d} يوم ${r.h} ساعة ${r.m} دقيقة`, `${r.d} days ${r.h} hours ${r.m} minutes left`)}>
      {cells.map(([v, l]) => (
        <div key={l} className={`rounded-md py-1 text-center ${tone === 'urgent' ? 'bg-bad/10 text-bad' : 'bg-stone text-ink'}`}>
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

export function AuctionCard({ a }: { a: Auction }) {
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
