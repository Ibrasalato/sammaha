import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AuctionCard } from '../components/AuctionCard'
import { Countdown, Loading, NameSeal, Segmented, TypeBadge } from '../components/ui'
import { RULES, TYPE_LABEL } from '../lib/config'
import { num } from '../lib/format'
import { api, useApp, useLoad } from '../lib/store'
import type { NameType } from '../lib/types'

/** Leaderboards as published on the current platform (sammha.ico.org.sa). Replace with live queries once data is migrated. */
const TOP_VALUE = ['دبوس مبارك عبدالله الدبوس', 'هيف محمد عبود القحطاني', 'الأمير سلطان بن محمد بن سعود الكبير آل سعود']
const TOP_OWNERS = ['تركي بن أحمد بن راجس الشرافي', 'فهد بن فلاح بن سلطان بن حثلين', 'احمد فهد عبدالله الشريع']

const STEPS: [string, string][] = [
  ['أنشئ حسابك', 'سجّل برقم جوالك وبريدك الإلكتروني.'],
  ['اطلب شعارًا', `اختر النوع (قعدان أو بكار) واكتب ${RULES.namesPerRequest} أسماء. نتحقق فورًا من عدم تطابقها مع أسماء مسجلة.`],
  ['ادفع الضمان', `ضمان المزاد ${RULES.depositAmount} ريال، ويعود إلى محفظتك إن لم يُقبل الطلب.`],
  ['مراجعة اللجنة', 'تدقق لجنة الاعتماد في الأسماء الشبيهة وتقبل أو ترفض كل اسم.'],
  ['المزاد العلني', `يُفتح المزاد للأسماء المقبولة بسعر افتتاحي ${RULES.openingPrice} ريال وموعد بداية ونهاية محدد.`],
  ['الترسية والفاتورة', `يرسو الاسم على أعلى مزايد، وإن لم يزايد أحد فهو لك بمبلغ الضمان. تصلك فاتورة إلكترونية.`],
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
      {/* Hero: the auction closing soonest, as a stamped seal */}
      <section className="border-b border-line bg-paper">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 md:grid-cols-[1.1fr_1fr] md:py-16">
          <div>
            <h1 className="text-4xl leading-[1.25] sm:text-5xl">سمّ إبلك باسمٍ لا يحمله غيرها</h1>
            <p className="mt-4 max-w-lg text-lg leading-8 text-muted">
              منصة المنظمة الدولية للإبل لاقتناء أسماء الشعارات عبر مزاد علني، وتسجيلها باسمك على المستوى المحلي والدولي.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to={ctaTo} className="btn-gold px-6 py-3 text-base">اطلب اسم شعار</Link>
              <Link to="/auctions" className="btn-ghost px-6 py-3 text-base">تصفّح المزادات</Link>
            </div>
            {stats.data && (
              <dl className="mt-10 grid max-w-md grid-cols-3 gap-4 border-t border-line pt-5">
                <div><dt className="text-sm text-muted">مزاد جارٍ</dt><dd className="num font-kufi text-2xl">{num(stats.data.live)}</dd></div>
                <div><dt className="text-sm text-muted">اسم محجوز</dt><dd className="num font-kufi text-2xl">{num(stats.data.reserved)}</dd></div>
                <div><dt className="text-sm text-muted">مالك</dt><dd className="num font-kufi text-2xl">{num(stats.data.owners)}</dd></div>
              </dl>
            )}
          </div>

          <div className="flex justify-center md:justify-end">
            {spot ? (
              <Link to={`/auctions/${spot.id}`} className="group flex flex-col items-center gap-5 text-center">
                <NameSeal name={spot.name} type={spot.type} size="xl" />
                <div>
                  <div className="flex items-center justify-center gap-2"><TypeBadge type={spot.type} /><span className="text-sm text-muted">أقرب مزاد على الإغلاق</span></div>
                  <div className="mt-2 flex items-baseline justify-center gap-2">
                    <span className="num font-kufi text-4xl font-semibold">{num(spot.currentPrice)}</span>
                    <span className="text-muted">ر.س</span>
                  </div>
                  <Countdown to={spot.endsAt} prefix="يُغلق بعد" className="mt-1 block font-semibold" />
                  <span className="mt-3 inline-block font-semibold text-gold-deep underline-offset-4 group-hover:underline">زايد على «{spot.name}»</span>
                </div>
              </Link>
            ) : (
              <div className="seal seal-qaadan w-56 font-kufi text-3xl"><span>سمّها</span></div>
            )}
          </div>
        </div>
      </section>

      {/* Live auctions */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl">المزادات الجارية</h2>
            <p className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted">
              <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-qaadan" />{TYPE_LABEL.qaadan}</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-bakkar" />{TYPE_LABEL.bakkar}</span>
            </p>
          </div>
          <Segmented value={type} onChange={setType} options={[['all', 'الكل'], ['qaadan', 'قعدان'], ['bakkar', 'بكار']]} />
        </div>
        {live.loading && !live.data ? <Loading /> : list.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{list.map((a) => <AuctionCard key={a.id} a={a} />)}</div>
        ) : (
          <p className="panel px-5 py-8 text-center text-muted">لا توجد مزادات جارية الآن{type !== 'all' ? ` لـ${TYPE_LABEL[type]}` : ''}. تابع المزادات القادمة.</p>
        )}

        {!!upcoming.data?.length && (
          <div className="mt-10">
            <h3 className="mb-4 text-xl">تبدأ قريبًا</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{upcoming.data.slice(0, 3).map((a) => <AuctionCard key={a.id} a={a} />)}</div>
          </div>
        )}
        <div className="mt-6"><Link to="/auctions" className="font-semibold text-gold-deep underline underline-offset-4">كل المزادات</Link></div>
      </section>

      {/* How it works — a real sequence, so it is numbered */}
      <section className="border-y border-line bg-paper">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <h2 className="text-2xl">كيف تقتني اسمًا</h2>
          <ol className="mt-6 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            {STEPS.map(([t, d], i) => (
              <li key={t} className="flex gap-4">
                <span className="num flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-gold font-kufi text-gold-deep">{i + 1}</span>
                <div><h3 className="text-lg">{t}</h3><p className="mt-1 text-[15px] leading-7 text-muted">{d}</p></div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Leaderboards */}
      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-12 md:grid-cols-2">
        <Leaderboard title="أعلى قيمة للمزادات" names={TOP_VALUE} />
        <Leaderboard title="أكثر ملكية للأسماء" names={TOP_OWNERS} />
      </section>
    </>
  )
}

function Leaderboard({ title, names }: { title: string; names: string[] }) {
  return (
    <div className="panel p-5">
      <h2 className="text-xl">{title}</h2>
      <ol className="mt-4 divide-y divide-line/70">
        {names.map((n, i) => (
          <li key={n} className="flex items-center gap-4 py-3">
            <span className={`num flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-kufi text-sm ${i === 0 ? 'bg-gold text-paper' : 'bg-stone-deep text-ink'}`}>{i + 1}</span>
            <Link to={`/names?q=${encodeURIComponent(n)}`} className="font-semibold hover:text-gold-deep">{n}</Link>
          </li>
        ))}
      </ol>
    </div>
  )
}
