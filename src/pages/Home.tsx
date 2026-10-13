import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AuctionCard } from '../components/AuctionCard'
import { Countdown, Loading, NameSeal, Segmented } from '../components/ui'
import { RULES, TYPE_LABEL } from '../lib/config'
import { num } from '../lib/format'
import { api, useApp, useLoad } from '../lib/store'
import type { NameCheck, NameType } from '../lib/types'

/** Leaderboards as published on the current platform (sammha.ico.org.sa). Replace with live queries once data is migrated. */
const TOP_VALUE = ['دبوس مبارك عبدالله الدبوس', 'هيف محمد عبود القحطاني', 'الأمير سلطان بن محمد بن سعود الكبير آل سعود']
const TOP_OWNERS = ['تركي بن أحمد بن راجس الشرافي', 'فهد بن فلاح بن سلطان بن حثلين', 'احمد فهد عبدالله الشريع']

const STEPS: [string, string][] = [
  ['إنشاء الحساب', 'بالجوال والبريد الإلكتروني.'],
  ['طلب الشعار', `${RULES.namesPerRequest} أسماء مقترحة مع تحقق فوري من التطابق.`],
  ['سداد الضمان', `${RULES.depositAmount} ريال، تُعاد إن لم يُقبل الطلب.`],
  ['مراجعة اللجنة', 'تدقيق الأسماء الشبيهة وقبول كل اسم أو رفضه.'],
  ['المزاد العلني', `سعر افتتاحي ${RULES.openingPrice} ريال وموعد محدد.`],
  ['الترسية والفاتورة', 'تسجيل الاسم للفائز وإصدار فاتورة إلكترونية.'],
]

export default function Home() {
  const { user } = useApp()
  const [type, setType] = useState<NameType | 'all'>('all')
  const live = useLoad(() => api.listAuctions({ phase: 'live' }), [], 15000)
  const upcoming = useLoad(() => api.listAuctions({ phase: 'scheduled' }), [])
  const stats = useLoad(() => api.stats(), [])

  const spot = live.data?.[0]
  const list = (live.data ?? []).filter((a) => type === 'all' || a.type === type)
  const ctaTo = user ? (user.role === 'owner' ? '/dashboard/requests/new' : '/admin') : '/signup'

  return (
    <>
      {/* ─── Hero ─── */}
      <section className="hero-field text-paper">
        <div className="wrap grid items-center gap-12 py-14 lg:grid-cols-[1.15fr_1fr] lg:py-20">
          <div>
            <p className="text-[15px] font-bold text-gold-light">المنظمة الدولية للإبل</p>
            <h1 className="mt-3 text-[40px] font-extrabold leading-[1.2] text-paper sm:text-[54px]">السجل الدولي<br />لأسماء الإبل وشعاراتها</h1>
            <p className="mt-5 max-w-xl text-[18px] leading-8 text-paper/75">
              اطلب اسمًا لمنقياتك وفردياتك، وتابع مزاده العلني، وسجّله باسمك معتمدًا على المستوى المحلي والدولي.
            </p>
            <NameChecker ctaTo={ctaTo} />
          </div>

          <div className="w-full lg:justify-self-end">
            {spot ? (
              <Link to={`/auctions/${spot.id}`} className="block rounded-xl bg-paper p-6 text-ink shadow-lift sm:p-8">
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-bold text-muted">أقرب مزاد على الإغلاق</span>
                  <span className="flex items-center gap-1.5 text-[13px] font-bold text-ok"><span className="h-2 w-2 animate-pulse rounded-full bg-ok" />مباشر</span>
                </div>
                <div className="mt-5 flex justify-center"><NameSeal name={spot.name} type={spot.type} size="xl" /></div>
                <dl className="mt-6 grid grid-cols-3 divide-x divide-x-reverse divide-line text-center">
                  <div><dt className="text-[12.5px] font-bold text-muted">أعلى مزايدة</dt><dd className="num text-2xl font-extrabold">{num(spot.currentPrice)}</dd></div>
                  <div><dt className="text-[12.5px] font-bold text-muted">المزايدات</dt><dd className="num text-2xl font-extrabold">{num(spot.bidCount)}</dd></div>
                  <div><dt className="text-[12.5px] font-bold text-muted">يُغلق بعد</dt><dd><Countdown to={spot.endsAt} className="text-lg font-extrabold" /></dd></div>
                </dl>
                <span className="btn-gold mt-6 w-full">زايد على «{spot.name}»</span>
              </Link>
            ) : (
              <div className="rounded-xl border border-paper/15 p-8 text-center text-paper/70">لا يوجد مزاد جارٍ الآن</div>
            )}
          </div>
        </div>

        {stats.data && (
          <div className="border-t border-paper/10">
            <dl className="wrap grid grid-cols-2 gap-y-6 py-7 sm:grid-cols-4">
              {([['مزاد جارٍ', stats.data.live], ['مزاد قادم', stats.data.upcoming], ['اسم مسجّل', stats.data.reserved], ['مالك', stats.data.owners]] as [string, number][]).map(([l, v], i) => (
                <div key={l} className={`px-4 ${i ? 'sm:border-s sm:border-paper/15' : ''}`}>
                  <dd className="num text-[34px] font-extrabold leading-none text-paper">{num(v)}</dd>
                  <dt className="mt-2 text-[14px] text-paper/60">{l}</dt>
                </div>
              ))}
            </dl>
          </div>
        )}
        <div className="sadu" aria-hidden />
      </section>

      {/* ─── Live auctions ─── */}
      <section className="wrap py-16">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="sec-title">المزادات الجارية</h2>
            <p className="mt-2 flex flex-wrap items-center gap-4 ps-4 text-[14px] text-muted">
              <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-qaadan" />{TYPE_LABEL.qaadan}</span>
              <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-bakkar" />{TYPE_LABEL.bakkar}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Segmented value={type} onChange={setType} options={[['all', 'الكل'], ['qaadan', 'قعدان'], ['bakkar', 'بكار']]} />
            <Link to="/auctions" className="btn-ghost btn-sm hidden sm:inline-flex">كل المزادات</Link>
          </div>
        </div>
        {live.loading && !live.data ? <Loading /> : list.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{list.map((a) => <AuctionCard key={a.id} a={a} />)}</div>
        ) : (
          <p className="panel px-5 py-10 text-center text-muted">لا توجد مزادات جارية الآن{type !== 'all' ? ` لـ${TYPE_LABEL[type]}` : ''}.</p>
        )}
      </section>

      {/* ─── Process ─── */}
      <section className="border-y border-line bg-paper">
        <div className="wrap py-16">
          <h2 className="sec-title">مراحل اقتناء الاسم</h2>
          <ol className="relative mt-10 grid gap-8 sm:grid-cols-3 lg:grid-cols-6 lg:gap-4">
            <span className="absolute inset-x-[8%] top-5 hidden h-px bg-line lg:block" aria-hidden />
            {STEPS.map(([t, d], i) => (
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
            <Link to={ctaTo} className="btn-primary">ابدأ طلب اسم شعار</Link>
            <Link to="/about" className="btn-ghost">الشروط والضوابط</Link>
          </div>
        </div>
      </section>

      {/* ─── Upcoming ─── */}
      {!!upcoming.data?.length && (
        <section className="wrap pt-16">
          <h2 className="sec-title">مزادات قادمة</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{upcoming.data.slice(0, 3).map((a) => <AuctionCard key={a.id} a={a} />)}</div>
        </section>
      )}

      {/* ─── Leaderboards ─── */}
      <section className="wrap grid gap-6 py-16 lg:grid-cols-2">
        <Leaderboard title="أعلى قيمة للمزادات" names={TOP_VALUE} />
        <Leaderboard title="أكثر ملكية للأسماء" names={TOP_OWNERS} />
      </section>
    </>
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
          <label htmlFor="chk" className="sr-only">الاسم</label>
          <input id="chk" className="min-w-0 flex-1 rounded-md px-3.5 py-3 text-[17px] font-bold text-ink outline-none placeholder:font-normal placeholder:text-muted/70"
            placeholder="اكتب الاسم للتحقق من توفّره" value={name} maxLength={30} onChange={(e) => { setName(e.target.value); setRes(null) }} />
          <div className="flex gap-2">
            <select aria-label="النوع" className="rounded-md border border-line bg-stone px-3 text-[15px] font-bold text-navy" value={t} onChange={(e) => { setT(e.target.value as NameType); setRes(null) }}>
              <option value="qaadan">قعدان</option>
              <option value="bakkar">بكار</option>
            </select>
            <button className="btn-gold flex-1 px-6 sm:flex-none" disabled={busy || !name.trim()}>تحقق</button>
          </div>
        </div>
      </form>
      {res && (
        <div className={`mt-3 flex flex-wrap items-center gap-3 rounded-md border px-4 py-3 text-[15px] ${tone}`} role="status">
          <span className="flex-1 font-bold text-paper">
            {res.verdict === 'available' ? `«${res.name}» متاح للطلب` : res.message}
            {res.verdict === 'similar' && <span className="font-normal text-paper/70"> ({res.hits.slice(0, 3).map((h) => h.name).join('، ')})</span>}
          </span>
          {(res.verdict === 'available' || res.verdict === 'similar') && <Link to={ctaTo} className="btn-on-dark btn-sm">اطلبه الآن</Link>}
        </div>
      )}
    </div>
  )
}

function Leaderboard({ title, names }: { title: string; names: string[] }) {
  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-6 py-4">
        <h2 className="text-xl">{title}</h2>
        <Link to="/names" className="text-[14px] font-bold text-gold-deep hover:underline">سجل الأسماء</Link>
      </div>
      <ol>
        {names.map((n, i) => (
          <li key={n} className="border-b border-line/70 last:border-0">
            <Link to={`/names?q=${encodeURIComponent(n)}`} className="flex items-center gap-4 px-6 py-4 hover:bg-stone">
              <span className={`num flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[15px] font-extrabold ${i === 0 ? 'bg-gold text-paper' : 'bg-navy-soft text-navy'}`}>{i + 1}</span>
              <span className="text-[16px] font-bold">{n}</span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  )
}
