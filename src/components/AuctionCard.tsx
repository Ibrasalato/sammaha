import { Link } from 'react-router-dom'
import { phaseOf } from '../lib/demoApi'
import { dateTime, num } from '../lib/format'
import { useNow } from '../lib/store'
import type { Auction } from '../lib/types'
import { Countdown, PhasePill, TypeBadge } from './ui'

export function AuctionCard({ a }: { a: Auction }) {
  const now = useNow(5000)
  const phase = phaseOf(a, now)
  const q = a.type === 'qaadan'
  const price = phase === 'ended' && a.finalPrice ? a.finalPrice : a.currentPrice
  return (
    <Link to={`/auctions/${a.id}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-line bg-paper shadow-card transition-shadow hover:shadow-lift">
      <div className={`h-1.5 ${q ? 'bg-qaadan' : 'bg-bakkar'}`} />
      <div className="flex items-center justify-between gap-2 px-5 pt-4">
        <TypeBadge type={a.type} />
        <PhasePill phase={phase} />
      </div>
      <div className={`px-5 py-6 text-center text-[34px] font-extrabold leading-none ${q ? 'text-qaadan-deep' : 'text-bakkar-deep'}`}>{a.name}</div>
      <dl className="mx-5 grid grid-cols-2 border-y border-line text-center">
        <div className="border-e border-line py-3">
          <dt className="text-[12.5px] font-bold text-muted">{phase === 'ended' ? 'سعر الترسية' : a.bidCount ? 'أعلى مزايدة' : 'السعر الافتتاحي'}</dt>
          <dd className="num text-xl font-extrabold text-ink">{num(price)} <span className="text-[13px] font-bold text-muted">ر.س</span></dd>
        </div>
        <div className="py-3">
          <dt className="text-[12.5px] font-bold text-muted">المزايدات</dt>
          <dd className="num text-xl font-extrabold text-ink">{num(a.bidCount)}</dd>
        </div>
      </dl>
      <div className="flex min-h-[52px] items-center justify-between gap-2 px-5 py-3 text-[14px]">
        {phase === 'live' && <Countdown to={a.endsAt} prefix="ينتهي خلال" className="font-bold" />}
        {phase === 'scheduled' && <span className="text-muted">يبدأ {dateTime(a.startsAt)}</span>}
        {phase === 'ended' && <span className="text-muted">{a.winnerName ? (a.wonByRequester ? 'رسا على مقدم الطلب' : 'رسا على أعلى مزايد') : `انتهى ${dateTime(a.endsAt)}`}</span>}
        {phase === 'live' && <span className="font-bold text-gold-deep group-hover:underline">زايد الآن</span>}
      </div>
    </Link>
  )
}
