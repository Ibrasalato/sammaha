import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Icon } from '../components/dash'
import type { IconName } from '../components/dash'
import { PayModal } from '../components/PayModal'
import { Loading } from '../components/ui'
import { RULES, TYPE_HEX, TYPE_LABEL } from '../lib/config'
import { useCompact } from '../lib/cardStyle'
import { cur, humanLeft, num } from '../lib/format'
import { tr } from '../lib/i18n'
import { api, useApp, useLoad, useNow } from '../lib/store'
import type { NameListing } from '../lib/types'
import { Approx } from '../components/Region'

const pct = (r: number) => Math.round(r * 100)

function Lock() {
  return (
    <svg viewBox="0 0 64 64" className="h-20 w-20 text-ink/80" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" aria-hidden>
      <path d="M20 28v-8a12 12 0 0124 0v8" /><rect x="12" y="28" width="40" height="28" rx="6" fill="rgba(255,255,255,.55)" /><circle cx="32" cy="40" r="4" /><path d="M32 44v5" />
    </svg>
  )
}

/** Fixed-price name on the market: gold name, big price, «اشتري الآن»; locked once sold or expired. */
export function SaleCard({ l, onBuy }: { l: NameListing; onBuy?: (l: NameListing) => void }) {
  const now = useNow(1000)
  const c = TYPE_HEX[l.type]
  const closed = l.status !== 'live' || now >= Date.parse(l.endsAt)
  const k = useCompact()
  return (
    <div className={`relative flex flex-col rounded-md border text-center shadow-card ${k ? 'mb-4 px-2 pb-7 pt-5' : 'mb-5 px-5 pb-10 pt-6'} ${closed ? 'border-line bg-stone-deep' : 'border-[#C9A55A]/70 bg-gradient-to-b from-paper via-paper to-[#EAD9B4]'}`}>
      <span className={`absolute rounded-full font-extrabold text-paper ${k ? 'end-1.5 top-1.5 px-1.5 text-[10px]' : 'end-3 top-3 px-2.5 py-0.5 text-[12px]'}`} style={{ background: closed ? '#8A8F98' : c.base }}>{TYPE_LABEL[l.type]}</span>
      <div className={`truncate font-extrabold leading-tight ${k ? 'px-1 text-[20px]' : 'px-8 text-[38px]'} ${closed ? 'text-ink/30' : 'text-[#A87C26]'}`}>{l.name}</div>
      <div className="mx-auto mt-2 h-px w-[85%] bg-ink/25" />
      <div className={`flex items-baseline justify-center gap-1.5 ${k ? 'mt-3' : 'mt-6'} ${closed ? 'text-ink/30' : ''}`}>
        <span className={`num font-black leading-none tracking-tight ${k ? 'text-[22px]' : 'text-[44px]'}`}>{num(l.price)}</span><span className={k ? 'text-[11px]' : 'text-[15px]'}>{cur()}</span>{!k && <Approx v={l.price} className="ms-1" />}
      </div>
      <div className={`mt-1 ${k ? 'text-[10.5px]' : 'text-[14px]'} ${closed ? 'text-ink/40' : 'text-ink/80'}`}>{tr('مبلغ الشراء', 'Price')}</div>
      <div className={`text-muted ${k ? 'mt-2 text-[10.5px]' : 'mt-4 text-[13px]'}`}>
        {closed ? (l.status === 'sold' ? tr('تم البيع', 'Sold') : tr('انتهت مدة العرض', 'Offer ended')) : tr(`متاح للشراء ${humanLeft(Date.parse(l.endsAt) - now)}`, `Available for ${humanLeft(Date.parse(l.endsAt) - now)}`)}
      </div>
      {closed && <div className={`absolute inset-0 grid place-items-center rounded-md bg-paper/30 ${k ? '[&_svg]:h-12 [&_svg]:w-12' : ''}`}><Lock /></div>}
      <button type="button" disabled={closed || !onBuy} onClick={() => onBuy?.(l)}
        className={`absolute left-1/2 inline-flex -translate-x-1/2 items-center whitespace-nowrap rounded-full border font-extrabold text-paper shadow-md transition ${k ? '-bottom-4 gap-1 px-3.5 py-1.5 text-[12.5px]' : '-bottom-5 gap-2 px-7 py-2 text-[17px]'} ${closed ? 'border-line bg-[#9CA0A6]' : 'border-[#A87C26]/50 bg-gradient-to-b from-[#D9B867] to-[#B88E3A] hover:brightness-105'}`}>
        <Icon name="coins" className="h-4 w-4" />{tr('اشترِ الآن', 'Buy now')}
      </button>
    </div>
  )
}

export default function Market() {
  const { user, toast } = useApp()
  const nav = useNavigate()
  const loc = useLocation()
  const { data, loading, reload } = useLoad(() => api.marketListings(), [], 15000)
  const [buying, setBuying] = useState<NameListing | null>(null)

  function buy(l: NameListing) {
    if (!user) { nav('/login', { state: { from: loc.pathname } }); return }
    if (user.role !== 'owner') { toast(tr('الشراء لحسابات ملاك الإبل', 'Buying is for owner accounts'), 'bad'); return }
    setBuying(l)
  }

  const steps: [IconName, string, string][] = [
    ['tag', tr('يعرض المالك اسمه', 'The owner lists a name'), tr('من «بيع اسم» في لوحته، اسمًا مسجلًا باسمه.', 'From «Sell a name» in their dashboard.')],
    ['gavel', tr('بالمزاد أو بسعر ثابت', 'Auction or fixed price'), tr(`المزاد يُعلن قبل ${RULES.resaleNoticeHours} ساعة ويستمر ${RULES.resaleAuctionDays} أيام، والبيع الفوري متاح ${RULES.instantSaleHours} ساعة.`, `Auctions are announced ${RULES.resaleNoticeHours} h ahead and run ${RULES.resaleAuctionDays} days; fixed-price offers stay ${RULES.instantSaleHours} h.`)],
    ['wallet', tr('الدفع عبر المنصة', 'Pay through Sammha'), tr('يُنقل الاسم وشهادته باسم المشتري فور السداد.', 'The name and its certificate move to the buyer on payment.')],
    ['coins', tr('يصل الثمن للبائع', 'The seller is paid'), tr(`بعد خصم عمولة سمّها: ${pct(RULES.resaleCommission)}% للمزاد و${pct(RULES.instantCommission)}% للبيع الفوري.`, `Less Sammha’s commission: ${pct(RULES.resaleCommission)}% for auctions, ${pct(RULES.instantCommission)}% for fixed price.`)],
  ]
  const live = (data ?? []).filter((l) => l.status === 'live')

  return (
    <>
      <section className="hero-field text-paper">
        <div className="wrap py-12 sm:py-14">
          <p className="text-[15px] font-bold text-gold-light">{tr('بيع اسم', 'Sell a name')}</p>
          <h1 className="mt-2 text-[36px] font-extrabold leading-tight text-paper sm:text-[44px]">{tr('سوق الأسماء', 'Name market')}</h1>
          <p className="mt-3 max-w-2xl text-[17px] leading-8 text-paper/80">{tr('أسماء يبيعها ملاكها مباشرة بسعر ثابت، وتُنقل باسمك فور الدفع. والأسماء المعروضة بالمزاد تجدها في صفحة المزادات بعلامة «إعادة بيع».', 'Names sold by their owners at a fixed price, transferred to you on payment. Names offered by auction are on the auctions page, marked «Resale».')}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to={user?.role === 'owner' ? '/dashboard/sell' : '/login'} className="btn-gold px-6">{tr('اعرض اسمك للبيع', 'Sell your name')}</Link>
            <Link to="/auctions" className="btn border border-paper/30 text-paper hover:bg-paper/10">{tr('مزادات إعادة البيع', 'Resale auctions')}</Link>
          </div>
        </div>
        <div className="h-1 bg-gold" aria-hidden />
      </section>

      <section className="wrap py-12">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <h2 className="sec-title">{tr('معروض للبيع الفوري', 'On sale now')}</h2>
          <span className="text-[14px] text-muted">{tr(`${num(live.length)} اسم متاح`, `${num(live.length)} available`)}</span>
        </div>
        {loading && !data ? <Loading /> : data?.length ? (
          <div className="grid grid-cols-2 gap-x-2.5 gap-y-6 sm:gap-x-5 sm:gap-y-8 lg:grid-cols-3 xl:grid-cols-4">{data.map((l) => <SaleCard key={l.id} l={l} onBuy={buy} />)}</div>
        ) : <p className="panel px-5 py-12 text-center text-muted">{tr('لا توجد أسماء معروضة للبيع الآن.', 'No names on sale right now.')}</p>}
      </section>

      <section className="border-t border-line bg-paper">
        <div className="wrap py-12">
          <h2 className="sec-title">{tr('كيف يعمل البيع', 'How selling works')}</h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-4">
            {steps.map(([icon, t, d], i) => (
              <li key={t} className="panel relative p-5">
                <span className="num absolute end-4 top-4 text-[13px] font-bold text-muted">{i + 1}</span>
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-pine-soft text-pine"><Icon name={icon} /></span>
                <h3 className="mt-4 text-[17px]">{t}</h3>
                <p className="mt-1.5 text-[14.5px] leading-7 text-ink/75">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {buying && (
        <PayModal open title={tr(`شراء «${buying.name}»`, `Buy “${buying.name}”`)} amount={buying.price} onClose={() => setBuying(null)}
          onPay={async (m) => {
            try { await api.buyListing(buying.id, m); toast(tr(`مبارك، أصبح «${buying.name}» باسمك`, `“${buying.name}” is now yours`)); reload(); nav('/dashboard/names') } catch (e) { toast((e as Error).message, 'bad'); throw e }
          }} />
      )}
    </>
  )
}

