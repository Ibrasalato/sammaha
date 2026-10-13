import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Loading, Segmented } from '../components/ui'
import { TYPE_LABEL } from '../lib/config'
import { phaseOf } from '../lib/demoApi'
import { EVENT_KIND, daysUntil, eventStatus, kindLabel } from '../lib/events'
import { locale, tr } from '../lib/i18n'
import { api, useLoad } from '../lib/store'
import type { Auction, CamelEvent, EventKind } from '../lib/types'

const monthFmt = () => new Intl.DateTimeFormat(locale(), { month: 'long', timeZone: 'Asia/Riyadh' })
const monthYearFmt = () => new Intl.DateTimeFormat(locale(), { month: 'long', year: 'numeric', timeZone: 'Asia/Riyadh' })
const dayFmt = () => new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'long', timeZone: 'Asia/Riyadh' })

export type CalItem =
  | { kind: 'event'; date: string; event: CamelEvent }
  | { kind: 'auction'; date: string; auction: Auction }

const asDate = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00+03:00` : iso)

export function useCalendar() {
  const events = useLoad(() => api.listEvents(), [])
  const auctions = useLoad(() => api.listAuctions({ phase: 'all' }), [])
  const items: CalItem[] = []
  for (const e of events.data ?? []) if (eventStatus(e) !== 'past') items.push({ kind: 'event', date: e.startsOn, event: e })
  for (const a of auctions.data ?? []) if (phaseOf(a) === 'scheduled') items.push({ kind: 'auction', date: a.startsAt.slice(0, 10), auction: a })
  items.sort((x, y) => x.date.localeCompare(y.date))
  return { items, loading: events.loading || auctions.loading }
}

function DateBlock({ iso, tone = 'navy' }: { iso: string; tone?: 'navy' | 'gold' }) {
  const d = asDate(iso)
  return (
    <div className={`flex w-[68px] shrink-0 flex-col items-center justify-center rounded-lg py-2 text-paper ${tone === 'gold' ? 'bg-gold' : 'bg-navy'}`}>
      <span className="num text-[26px] font-extrabold leading-none">{d.toLocaleDateString('en', { day: 'numeric', timeZone: 'Asia/Riyadh' })}</span>
      <span className="mt-1 text-[12px] font-bold opacity-80">{monthFmt().format(d)}</span>
    </div>
  )
}

function Relative({ startsOn, endsOn }: { startsOn: string; endsOn: string }) {
  const st = eventStatus({ startsOn, endsOn } as CamelEvent)
  if (st === 'ongoing') return <span className="pill bg-[#E2F0E8] text-ok">{tr('جارٍ الآن', 'On now')}</span>
  const n = daysUntil(startsOn)
  return <span className="pill bg-stone-deep text-ink">{n <= 1 ? tr('غدًا', 'Tomorrow') : tr(n <= 10 ? `بعد ${n} أيام` : `بعد ${n} يومًا`, `In ${n} days`)}</span>
}

export function CalendarRow({ item }: { item: CalItem }) {
  if (item.kind === 'auction') {
    const a = item.auction
    return (
      <Link to={`/auctions/${a.id}`} className="panel flex items-center gap-4 p-4 transition-shadow hover:shadow-lift">
        <DateBlock iso={a.startsAt.slice(0, 10)} tone="gold" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="pill bg-gold-soft text-gold-deep">{tr('مزاد سمّها', 'Sammha auction')}</span>
            <span className={`pill ${a.type === 'qaadan' ? 'bg-qaadan-soft text-qaadan-deep' : 'bg-bakkar-soft text-bakkar-deep'}`}>{TYPE_LABEL[a.type]}</span>
          </div>
          <h3 className="mt-1.5 text-[18px]">{tr(`مزاد اسم «${a.name}»`, `Auction for “${a.name}”`)}</h3>
          <p className="text-[14px] text-muted">{tr('يبدأ', 'Starts')} {new Date(a.startsAt).toLocaleTimeString(locale(), { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Riyadh' })} {tr(`بتوقيت الرياض، السعر الافتتاحي ${a.openingPrice} ريال`, `Riyadh time, opening price SAR ${a.openingPrice}`)}</p>
        </div>
        <Relative startsOn={a.startsAt.slice(0, 10)} endsOn={a.endsAt.slice(0, 10)} />
      </Link>
    )
  }
  const e = item.event
  const k = EVENT_KIND[e.kind]
  const sameDay = e.startsOn === e.endsOn
  return (
    <article className="panel flex items-start gap-4 p-4">
      <DateBlock iso={e.startsOn} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`pill ${k.cls}`}>{kindLabel(e.kind)}</span>
          {e.approx && <span className="pill border border-dashed border-gold text-gold-deep" title={tr('الموعد متوقع بناءً على النسخ السابقة، ويُحدَّث عند الإعلان الرسمي', 'Expected date based on previous editions; updated when officially announced')}>{tr('موعد متوقع', 'Expected date')}</span>}
        </div>
        <h3 className="mt-1.5 text-[18px]">{tr(e.title, e.titleEn || e.title)}</h3>
        <p className="text-[14px] font-bold text-muted">
          {sameDay ? dayFmt().format(asDate(e.startsOn)) : `${dayFmt().format(asDate(e.startsOn))} ${tr('إلى', 'to')} ${dayFmt().format(asDate(e.endsOn))}`}{tr('، ', ', ')}{tr(e.city, e.cityEn || e.city)}{tr('، ', ', ')}{tr(e.country, e.countryEn || e.country)}
        </p>
        <p className="mt-1.5 text-[14.5px] leading-7 text-ink/80">{tr(e.description, e.descriptionEn || e.description)}</p>
        {e.url && <a href={e.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[14px] font-bold text-gold-deep hover:underline">{tr('الموقع الرسمي', 'Official website')}</a>}
      </div>
      <Relative startsOn={e.startsOn} endsOn={e.endsOn} />
    </article>
  )
}

export default function Events() {
  const { items, loading } = useCalendar()
  const [f, setF] = useState<'all' | 'auction' | EventKind>('all')
  const list = items.filter((i) => f === 'all' || (i.kind === 'auction' ? f === 'auction' : i.event.kind === f))

  // group by month
  const groups = new Map<string, CalItem[]>()
  for (const i of list) {
    const key = monthYearFmt().format(asDate(i.date))
    groups.set(key, [...(groups.get(key) ?? []), i])
  }

  return (
    <>
      <section className="hero-field text-paper">
        <div className="wrap py-12">
          <h1 className="text-[36px] font-extrabold text-paper sm:text-[44px]">{tr('مواعيد الإبل', 'Camel calendar')}</h1>
          <p className="mt-3 max-w-2xl text-[17px] leading-8 text-paper/75">
            {tr('مهرجانات المزاين وسباقات الهجن والمناسبات الدولية للإبل، ومواعيد مزادات سمّها القادمة، في تقويم واحد.', 'Camel beauty festivals, racing, international camel occasions and upcoming Sammha auctions, in one calendar.')}
          </p>
        </div>
        <div className="sadu sadu-thin" aria-hidden />
      </section>

      <div className="wrap py-10">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <Segmented value={f} onChange={setF} options={[['all', tr('الكل', 'All')], ['auction', tr('مزادات سمّها', 'Sammha auctions')], ['mazayin', tr('المزاين', 'Beauty')], ['race', tr('سباقات الهجن', 'Racing')], ['world_day', tr('أيام عالمية', 'World days')]]} />
          <p className="flex items-center gap-2 text-[13.5px] text-muted">
            <span className="pill border border-dashed border-gold text-gold-deep">{tr('موعد متوقع', 'Expected date')}</span>
            {tr('لم يُعلن رسميًا بعد، ويُحدَّث عند إعلانه', 'Not yet officially announced; updated once it is')}
          </p>
        </div>

        {loading && !items.length ? <Loading /> : list.length ? (
          <div className="space-y-10">
            {[...groups.entries()].map(([month, rows]) => (
              <section key={month}>
                <h2 className="sec-title mb-4 !text-xl">{month}</h2>
                <div className="grid gap-3 lg:grid-cols-2">{rows.map((r) => <CalendarRow key={r.kind === 'event' ? r.event.id : r.auction.id} item={r} />)}</div>
              </section>
            ))}
          </div>
        ) : <p className="panel px-5 py-10 text-center text-muted">{tr('لا توجد مواعيد قادمة بهذه التصفية.', 'No upcoming dates for this filter.')}</p>}
      </div>
    </>
  )
}
