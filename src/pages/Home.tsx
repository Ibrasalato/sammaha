import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AuctionGrid, CardStylePicker } from '../components/AuctionCard'
import { useCardStyle } from '../lib/cardStyle'
import { Avatar } from '../components/Avatar'
import { HeroSlides } from '../components/HeroSlides'
import { CalendarRow, useCalendar } from './Events'
import { Countdown, Loading, NameSeal, Segmented } from '../components/ui'
import { RULES, TYPE_LABEL, typeOptions, TYPE_CLS } from '../lib/config'
import { num, sar } from '../lib/format'
import { getLang, tr } from '../lib/i18n'
import { api, useApp, useLoad } from '../lib/store'
import type { NameCheck, NameType } from '../lib/types'


const STEPS = (): [string, string][] => [
  [tr('إنشاء الحساب', 'Create an account'), tr('بالجوال والبريد الإلكتروني.', 'With your mobile number and email.')],
  [tr('طلب الشعار', 'Request a name'), tr(`${RULES.namesPerRequest} أسماء مقترحة مع تحقق فوري من التطابق.`, `${RULES.namesPerRequest} proposed names, checked instantly for matches.`)],
  [tr('سداد الضمان', 'Pay the guarantee'), tr(`${RULES.depositAmount} ريال، تُعاد إن لم يُقبل الطلب.`, `SAR ${RULES.depositAmount}, refunded if the request is not approved.`)],
  [tr('مراجعة اللجنة', 'Committee review'), tr('تدقيق الأسماء الشبيهة وقبول كل اسم أو رفضه.', 'Similar names are reviewed; each name is approved or declined.')],
  [tr('المزاد العلني', 'Public auction'), tr(`سعر افتتاحي ${RULES.openingPrice} ريال وموعد محدد.`, `Opening price SAR ${RULES.openingPrice}, on a set schedule.`)],
  [tr('الترسية والفاتورة', 'Award and invoice'), tr('تسجيل الاسم للفائز وإصدار فاتورة إلكترونية.', 'The name is registered to the winner with an e-invoice.')],
]

export default function Home() {
  const { user } = useApp()
  const [type, setType] = useState<NameType | 'all'>('all')
  const cardStyle = useCardStyle()
  const live = useLoad(() => api.listAuctions({ phase: 'live' }), [], 15000)
  const upcoming = useLoad(() => api.listAuctions({ phase: 'scheduled' }), [])
  const stats = useLoad(() => api.stats(), [])

  // spotlight: the live name with the highest bid right now
  const spot = [...(live.data ?? [])].sort((a, b) => b.currentPrice - a.currentPrice || b.bidCount - a.bidCount)[0]
  const list = (live.data ?? []).filter((a) => type === 'all' || a.type === type)
  const ctaTo = user ? (user.role === 'owner' ? '/dashboard/requests/new' : '/admin') : '/signup'

  return (
    <>
      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden bg-pine text-paper">
        <HeroSlides />
        <div className="wrap relative z-10 grid items-center gap-12 py-16 lg:grid-cols-[1.15fr_1fr] lg:py-24">
          <div>
            <p className="text-[15px] font-bold text-gold-light">{tr('المنظمة الدولية للإبل', 'International Camel Organization')}</p>
            <h1 className="mt-3 text-[40px] font-extrabold leading-[1.2] text-paper sm:text-[54px]">{getLang() === 'ar' ? <>السجل الدولي<br />لأسماء الإبل وشعاراتها</> : <span className="block text-[38px] sm:text-[48px]">The international registry of camel names and marks</span>}</h1>
            <p className="mt-5 max-w-xl text-[18px] leading-8 text-paper/75">
              {tr('اطلب اسمًا لمنقياتك وفردياتك، وتابع مزاده العلني، وسجّله باسمك معتمدًا على المستوى المحلي والدولي.', 'Request a name for your camels, follow its public auction, and have it registered to you, recognised locally and internationally.')}
            </p>
            <NameChecker ctaTo={ctaTo} />
          </div>

          <div className="w-full max-w-md lg:justify-self-end">
            {spot ? (
              <Link to={`/auctions/${spot.id}`} className="block rounded-xl bg-paper/95 p-6 text-ink shadow-lift backdrop-blur">
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-medium text-muted">{tr('الشعار صاحب أعلى مزايدة', 'Highest bid right now')}</span>
                  <span className="flex items-center gap-1.5 text-[13px] font-bold text-ok"><span className="h-2 w-2 animate-pulse rounded-full bg-ok" />{tr('مباشر', 'Live')}</span>
                </div>
                <div className="mt-4"><NameSeal name={spot.name} type={spot.type} size="xl" palette={cardStyle === 'brand' ? 'brand' : 'standard'} /></div>
                <dl className="mt-6 grid grid-cols-3 divide-x divide-line rtl:divide-x-reverse text-center">
                  <div><dt className="text-[12.5px] font-medium text-muted">{tr('أعلى مزايدة', 'Top bid')}</dt><dd className="num text-2xl font-extrabold">{num(spot.currentPrice)}</dd></div>
                  <div><dt className="text-[12.5px] font-medium text-muted">{tr('المزايدات', 'Bids')}</dt><dd className="num text-2xl font-extrabold">{num(spot.bidCount)}</dd></div>
                  <div><dt className="text-[12.5px] font-medium text-muted">{tr('يُغلق بعد', 'Closes in')}</dt><dd><Countdown to={spot.endsAt} className="text-lg font-extrabold" /></dd></div>
                </dl>
                <span className={`${cardStyle === 'brand' && spot.type === 'bakkar' ? 'btn bg-[#1D5C2F] text-paper ring-1 ring-inset ring-[#E2C27E]/60 group-hover:bg-[#164A25]' : 'btn-gold'} mt-6 w-full`}>{tr(`زايد على «${spot.name}»`, `Bid on “${spot.name}”`)}</span>
              </Link>
            ) : (
              <div className="rounded-xl border border-paper/15 p-8 text-center text-paper/70">{tr('لا يوجد مزاد جارٍ الآن', 'No live auction right now')}</div>
            )}
          </div>
        </div>

        {stats.data && (
          <div className="relative z-10 border-t border-paper/15 bg-pine/60 backdrop-blur-sm">
            <dl className="wrap grid grid-cols-2 gap-y-6 py-7 sm:grid-cols-4">
              {([[tr('مزاد جارٍ', 'Live auctions'), stats.data.live], [tr('مزاد قادم', 'Upcoming auctions'), stats.data.upcoming], [tr('اسم مسجّل', 'Registered names'), stats.data.reserved], [tr('مالك', 'Owners'), stats.data.owners]] as [string, number][]).map(([l, v], i) => (
                <div key={l} className={`px-4 ${i ? 'sm:border-s sm:border-paper/15' : ''}`}>
                  <dd className="num text-[34px] font-extrabold leading-none text-paper">{num(v)}</dd>
                  <dt className="mt-2 text-[14px] text-paper/60">{l}</dt>
                </div>
              ))}
            </dl>
          </div>
        )}
        <div className="sadu relative z-10" aria-hidden />
      </section>

      {/* ─── Live auctions ─── */}
      <section className="wrap py-16">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="sec-title">{tr('المزادات الجارية', 'Live auctions')}</h2>
            <p className="mt-2 flex flex-wrap items-center gap-4 ps-4 text-[14px] text-muted">
              <span className="inline-flex items-center gap-2"><span className={`h-3 w-3 rounded-sm ${cardStyle === 'brand' ? 'bg-[#1D5C2F]' : 'bg-qaadan'}`} />{TYPE_LABEL.qaadan}</span>
              <span className="inline-flex items-center gap-2"><span className={`h-3 w-3 rounded-sm ${cardStyle === 'brand' ? 'bg-[#9C7425]' : 'bg-bakkar'}`} />{TYPE_LABEL.bakkar}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Segmented value={type} onChange={setType} options={typeOptions('all', tr('الكل', 'All'))} />
            <Link to="/auctions" className="btn-ghost btn-sm hidden sm:inline-flex">{tr('كل المزادات', 'All auctions')}</Link>
          </div>
        </div>
        {live.loading && !live.data ? <Loading /> : list.length ? (
          <>
            <CardStylePicker className="mb-4" />
            <AuctionGrid list={list} />
          </>
        ) : (
          <p className="panel px-5 py-10 text-center text-muted">{tr('لا توجد مزادات جارية الآن', 'No live auctions right now')}{type !== 'all' ? ` (${TYPE_LABEL[type]})` : ''}.</p>
        )}
      </section>

      {/* ─── Upcoming dates ─── */}
      <UpcomingDates />

      {/* ─── Process ─── */}
      <section className="border-y border-line bg-paper">
        <div className="wrap py-16">
          <h2 className="sec-title">{tr('مراحل اقتناء الاسم', 'How to acquire a name')}</h2>
          <ol className="relative mt-10 grid gap-8 sm:grid-cols-3 lg:grid-cols-6 lg:gap-4">
            <span className="absolute inset-x-[8%] top-5 hidden h-px bg-line lg:block" aria-hidden />
            {STEPS().map(([t, d], i) => (
              <li key={t} className="relative flex gap-4 lg:flex-col lg:items-center lg:gap-3 lg:text-center">
                <span className="num relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-gold bg-paper text-[16px] font-extrabold text-gold-deep">{i + 1}</span>
                <div>
                  <h3 className="text-[17px]">{t}</h3>
                  <p className="mt-1 text-[14.5px] leading-7 text-muted">{d}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link to={ctaTo} className="btn-primary">{tr('ابدأ طلب اسم شعار', 'Start a name request')}</Link>
            <Link to="/terms" className="btn-ghost">{tr('الشروط والضوابط', 'Terms and rules')}</Link>
          </div>
        </div>
      </section>

      {/* ─── Name investment ─── */}
      <section className="wrap pt-16">
        <Link to="/invest" className="group grid overflow-hidden rounded-2xl bg-pine text-paper shadow-card sm:grid-cols-[1fr_auto]">
          <div className="p-6 sm:p-8">
            <span className="pill bg-gold text-pine">{tr('خدمة جديدة', 'New service')}</span>
            <h2 className="mt-3 text-[26px] text-paper sm:text-[30px]">{tr('استثمار الاسم', 'Name investment')}</h2>
            <p className="mt-2 max-w-xl leading-8 text-paper/75">{tr(`اقترح اسمًا جديدًا مبتكرًا. إن اعتمدته اللجنة يُطرح في مزاد عام ولك ${Math.round(RULES.investOwnerShare * 100)}% من قيمة بيعه.`, `Propose a new, original name. If the committee approves it, it goes to a public auction and you get ${Math.round(RULES.investOwnerShare * 100)}% of the sale.`)}</p>
            <span className="mt-4 inline-flex items-center gap-2 font-bold text-gold-light group-hover:underline">{tr('اعرف أكثر وقدّم اسمك', 'Learn more and submit')} <span aria-hidden>←</span></span>
          </div>
          <div className="hidden items-center gap-3 border-s border-paper/10 bg-paper/5 px-8 sm:flex">
            {[[`${100 - Math.round(RULES.investOwnerShare * 100)}%`, tr('للمنظمة', 'Organization')], [`${Math.round(RULES.investOwnerShare * 100)}%`, tr('لصاحب الاسم', 'Name owner')]].map(([v, l], i) => (
              <div key={l} className={`grid h-28 w-28 place-items-center rounded-full text-center ${i ? 'bg-gold text-pine' : 'border-2 border-paper/25'}`}><span><b className="num block text-[28px] leading-none">{v}</b><span className="text-[13px]">{l}</span></span></div>
            ))}
          </div>
        </Link>
      </section>

      {/* ─── Upcoming ─── */}
      {!!upcoming.data?.length && (
        <section className="wrap pt-16">
          <h2 className="sec-title">{tr('مزادات قادمة', 'Upcoming auctions')}</h2>
          <AuctionGrid list={upcoming.data.slice(0, 3)} className="mt-8" />
        </section>
      )}

      {/* ─── Leaderboards ─── */}
      <Leaderboards />
    </>
  )
}

function UpcomingDates() {
  const { items } = useCalendar()
  if (!items.length) return null
  return (
    <section className="border-t border-line bg-paper">
      <div className="wrap py-16">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="sec-title">{tr('مواعيد قادمة', 'Upcoming dates')}</h2>
            <p className="mt-2 ps-4 text-[15px] text-muted">{tr('مهرجانات الإبل وسباقات الهجن ومزادات سمّها القادمة.', 'Camel festivals, racing and upcoming Sammha auctions.')}</p>
          </div>
          <Link to="/events" className="btn-ghost btn-sm">{tr('التقويم الكامل', 'Full calendar')}</Link>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {items.slice(0, 6).map((i) => <CalendarRow key={i.kind === 'event' ? i.event.id : i.auction.id} item={i} />)}
        </div>
      </div>
    </section>
  )
}

function NameChecker({ ctaTo }: { ctaTo: string }) {
  const [name, setName] = useState('')
  const [t, setT] = useState<NameType>('qaadan')
  const [res, setRes] = useState<NameCheck | null>(null)
  const [busy, setBusy] = useState(false)

  async function check(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    try { setRes((await api.checkNames([name], t))[0]) } finally { setBusy(false) }
  }

  const tone = res ? (res.verdict === 'available' ? 'border-ok/40 bg-ok/10' : res.verdict === 'similar' ? 'border-gold/40 bg-gold/10' : 'border-bad/40 bg-bad/15') : ''

  return (
    <div className="mt-8 max-w-xl">
      <form onSubmit={check} className="rounded-lg bg-paper p-2 shadow-lift">
        <div className="flex flex-col gap-2 sm:flex-row">
          <label htmlFor="chk" className="sr-only">{tr('الاسم', 'Name')}</label>
          <input id="chk" className="min-w-0 flex-1 rounded-md px-3.5 py-3 text-[17px] font-bold text-ink outline-none placeholder:font-normal placeholder:text-muted/70"
            placeholder={tr('اكتب الاسم للتحقق من توفّره', 'Type a name (in Arabic) to check availability')} value={name} maxLength={30} onChange={(e) => { setName(e.target.value); setRes(null) }} />
          <div className="flex gap-2">
            <select aria-label={tr('النوع', 'Type')} className="rounded-md border border-line bg-stone px-3 text-[15px] font-bold text-pine" value={t} onChange={(e) => { setT(e.target.value as NameType); setRes(null) }}>
              <option value="qaadan">{TYPE_LABEL.qaadan}</option>
              <option value="bakkar">{TYPE_LABEL.bakkar}</option>
            </select>
            <button className="btn-gold flex-1 px-6 sm:flex-none" disabled={busy || !name.trim()}>{tr('تحقق', 'Check')}</button>
          </div>
        </div>
      </form>
      {res && (
        <div className={`mt-3 flex flex-wrap items-center gap-3 rounded-md border px-4 py-3 text-[15px] ${tone}`} role="status">
          <span className="flex-1 font-bold text-paper">
            {res.verdict === 'available' ? tr(`«${res.name}» متاح للطلب`, `“${res.name}” is available`) : getLang() === 'ar' ? res.message : ({ similar: 'Available, but similar to existing names; the committee will review it', exact: 'Already registered or under request', invalid: 'Use Arabic letters only (2 to 30)', duplicate: 'Duplicate name' } as Record<string, string>)[res.verdict]}
            {res.verdict === 'similar' && <span className="font-normal text-paper/70"> ({res.hits.slice(0, 3).map((h) => h.name).join('، ')})</span>}
          </span>
          {(res.verdict === 'available' || res.verdict === 'similar') && <Link to={ctaTo} className="btn-on-dark btn-sm">{tr('اطلبه الآن', 'Request it')}</Link>}
        </div>
      )}
    </div>
  )
}

function Leaderboards() {
  const { data } = useLoad(() => api.listReservedNames('', 'all'), [])
  if (!data?.length) return null
  const topValue = [...data].sort((a, b) => b.price - a.price).slice(0, 5)
  const byOwner = new Map<string, { n: number; avatar?: string }>()
  for (const r of data) {
    const cur = byOwner.get(r.ownerName) ?? { n: 0 }
    byOwner.set(r.ownerName, { n: cur.n + 1, avatar: cur.avatar ?? r.ownerAvatar })
  }
  const topOwners = [...byOwner.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 5)
  return (
    <section className="wrap grid gap-6 py-16 lg:grid-cols-2">
      <Leaderboard title={tr('أعلى قيمة للمزادات', 'Highest auction values')}
        rows={topValue.map((r) => ({ key: r.id, to: `/names?q=${encodeURIComponent(r.name)}`, main: r.name, type: r.type, sub: r.ownerName, subAvatar: r.ownerAvatar, value: sar(r.price) }))} />
      <Leaderboard title={tr('أكثر ملكية للأسماء', 'Most names owned')}
        rows={topOwners.map(([o, { n, avatar }]) => ({ key: o, to: `/names?q=${encodeURIComponent(o)}`, main: o, avatar: { src: avatar }, value: tr(n === 1 ? 'اسم واحد' : n === 2 ? 'اسمان' : n <= 10 ? `${n} أسماء` : `${n} اسمًا`, `${n} name${n > 1 ? 's' : ''}`) }))} />
    </section>
  )
}

interface Row { key: string; to: string; main: string; sub?: string; subAvatar?: string; value: string; type?: NameType; avatar?: { src?: string } }

function Leaderboard({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-6 py-4">
        <h2 className="text-xl">{title}</h2>
        <Link to="/names" className="text-[14px] font-bold text-gold-deep hover:underline">{tr('سجل الأسماء', 'Registry')}</Link>
      </div>
      <ol>
        {rows.map((r, i) => (
          <li key={r.key} className="border-b border-line/70 last:border-0">
            <Link to={r.to} className="flex items-center gap-4 px-6 py-3.5 hover:bg-stone">
              <span className={`num flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[14px] font-extrabold ${i === 0 ? 'bg-gold text-paper' : 'bg-pine-soft text-pine'}`}>{i + 1}</span>
              {r.avatar && <Avatar name={r.main} src={r.avatar.src} size={46} ring={i === 0} />}
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-[16px] font-bold">
                  {r.type && <span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${TYPE_CLS[r.type].dot}`} />}
                  <span className="truncate">{r.main}</span>
                </span>
                {r.sub && <span className="mt-0.5 flex items-center gap-1.5 truncate text-[13.5px] text-muted"><Avatar name={r.sub} src={r.subAvatar} size={20} />{r.sub}</span>}
              </span>
              <span className="num shrink-0 text-[15px] font-extrabold text-ink">{r.value}</span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  )
}
