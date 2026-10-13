import { Link } from 'react-router-dom'
import { phaseOf } from '../lib/demoApi'
import { dateTime, num } from '../lib/format'
import { useNow } from '../lib/store'
import type { Auction } from '../lib/types'
import { Countdown, NameSeal, PhasePill, TypeBadge } from './ui'

export function AuctionCard({ a }: { a: Auction }) {
  const now = useNow(5000)
  const phase = phaseOf(a, now)
  const edge = a.type === 'qaadan' ? 'before:bg-qaadan' : 'before:bg-bakkar'
  return (
    <Link to={`/auctions/${a.id}`}
      className={`panel group relative flex gap-4 overflow-hidden p-4 transition-colors hover:border-ink before:absolute before:inset-y-0 before:start-0 before:w-1 ${edge}`}>
      <NameSeal name={a.name} type={a.type} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <TypeBadge type={a.type} />
          <PhasePill phase={phase} />
        </div>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="num font-kufi text-2xl font-semibold">{num(phase === 'ended' && a.finalPrice ? a.finalPrice : a.currentPrice)}</span>
          <span className="text-sm text-muted">ر.س</span>
          <span className="ms-auto text-sm text-muted">{a.bidCount ? `${num(a.bidCount)} مزايدة` : 'بلا مزايدات'}</span>
        </div>
        <div className="mt-1 text-sm">
          {phase === 'live' && <Countdown to={a.endsAt} prefix="ينتهي خلال" />}
          {phase === 'scheduled' && <span className="text-muted">يبدأ {dateTime(a.startsAt)}</span>}
          {phase === 'ended' && <span className="text-muted">انتهى {dateTime(a.endsAt)}{a.winnerName ? `، رسا على ${a.wonByRequester ? 'مقدم الطلب' : 'أعلى مزايد'}` : ''}</span>}
        </div>
      </div>
    </Link>
  )
}
