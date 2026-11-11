import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { locale, tr } from '../lib/i18n'
import { AuctionStatePill, Countdown, ErrorBox, NameSeal, TypeBadge } from '../components/ui'
import { Skeleton } from '../components/Skeleton'
import { PriceChart } from '../components/PriceChart'
import { CountdownBoxes } from '../components/AuctionCard'
import { PayModal } from '../components/PayModal'
import { RULES, TYPE_CLS, TYPE_HINT, TYPE_LABEL } from '../lib/config'
import { phaseOf } from '../lib/demoApi'
import { cur, date, dateTimeRef, humanLeft, num, sar, time } from '../lib/format'
import { api, useApp, useLoad, useNow } from '../lib/store'
import { usePageTitle } from '../lib/usePageTitle'
import { Approx } from '../components/Region'
import { IS_NATIVE } from '../lib/native'
import { Icon } from '../components/dash'
import { Sheet } from '../components/AppChrome'
import { FollowBell } from '../components/Follow'
import { BIG_BID, haptic, lockEnabled, verifyOwner } from '../lib/device'
import { Avatar } from '../components/Avatar'

/** in the app the long sections fold away; on the website they are plain sections */
function Fold({ title, open, children }: { title: string; open?: boolean; children: React.ReactNode }) {
  return IS_NATIVE ? <details className="app-fold" open={open}><summary>{title}</summary>{children}</details> : <>{children}</>
}
import { userTzLabel } from '../lib/region'

function Heart({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 21s-7.5-4.6-9.6-9.2C.8 8.4 2.9 4.5 6.6 4.5c2.1 0 3.6 1.2 4.4 2.5.8-1.3 2.3-2.5 4.4-2.5 3.7 0 5.8 3.9 4.2 7.3C19.5 16.4 12 21 12 21z" />
    </svg>
  )
}

export default function AuctionDetail() {
  const { id = '' } = useParams()
  const { user, toast, settings } = useApp()
  const loc = useLocation()
  const { data, error, loading, setData, reload } = useLoad(() => api.getAuction(id), [id, user?.id], 5000)
  const now = useNow(1000)
  const [amount, setAmount] = useState('')
  const [autoMax, setAutoMax] = useState('')
  const [confirm, setConfirm] = useState<number | null>(null)
  const [ask, setAsk] = useState<number | null>(null)
  const [dtab, setDtab] = useState<'bids' | 'info'>('bids')
  const [busy, setBusy] = useState(false)
  const [payingDeposit, setPayingDeposit] = useState(false)
  const [flash, setFlash] = useState(0)
  const lastPrice = useRef<number | null>(null)
  const panel = useRef<HTMLElement>(null)

  const a = data?.auction
  usePageTitle(a ? tr(`مزاد «${a.name}»`, `“${a.name}” auction`) : tr('المزاد', 'Auction'))
  useEffect(() => api.subscribeAuction(id, () => { reload() }), [id, reload])
  useEffect(() => {
    if (!a) return
    if (lastPrice.current !== null && a.currentPrice !== lastPrice.current) setFlash((f) => f + 1)
    lastPrice.current = a.currentPrice
  }, [a?.currentPrice]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading && !data) return <AuctionSkeleton />
  if (error || !a) return <div className="mx-auto max-w-3xl px-4 py-10"><ErrorBox text={error || tr('المزاد غير موجود', 'Auction not found')} /></div>

  // a paused auction takes no bids until it resumes; a cancelled one is closed
  const phase = a.paused ? 'paused' as const : phaseOf(a, now)
  const mine = data.mine
  const min = a.currentPrice + a.minIncrement
  const isRequester = !!user && !!a.isRequester
  const resale = !!a.listingId
  const ownInvest = (!!a.investment || resale) && isRequester // the proposer or seller may not bid on the name
  // every bidder pays the entry guarantee first (on a request's auction the requester's request guarantee covers them)
  const entry = resale || (a.bidDeposit ?? 0) > 0
  const needDeposit = entry && !!user && !isRequester && !mine?.depositPaid && phase !== 'ended'
  const deadline = settings?.paymentDeadlineHours ?? 72
  const leading = !!user && !!a.isLeader
  const endsSoon = phase === 'live' && Date.parse(a.endsAt) - now < RULES.extendMinutes * 60_000 * 3

  async function run<T>(p: Promise<T>, ok: (r: T) => string) {
    setBusy(true)
    try { const r = await p; toast(ok(r)); return r } catch (e) { toast((e as Error).message, 'bad') } finally { setBusy(false); setConfirm(null) }
  }
  async function bid(value: number) {
    // a jump of more than double the current price asks once more
    if (!IS_NATIVE && value > a!.currentPrice * 2 && value - a!.currentPrice > 500 && confirm !== value) { setConfirm(value); return }
    const r = await run(api.placeBid(a!.id, value), () => tr(`تمت مزايدتك بمبلغ ${sar(value)}`, `Your bid of ${sar(value)} was placed`))
    if (r) { setData(r); setAmount(''); void haptic('success') }
  }
  // in the app every bid is confirmed once in a sheet, so a stray tap never places one
  const tryBid = (v: number) => { if (IS_NATIVE) setAsk(v); else void bid(v) }
  async function auto() {
    const r = await run(api.setAutoBid(a!.id, Number(autoMax)), () => tr(`فُعّلت المزايدة التلقائية حتى ${sar(Number(autoMax))}`, `Auto-bid set up to ${sar(Number(autoMax))}`))
    if (r) { setData(r); setAutoMax('') }
  }
  async function watch() {
    if (!user) return
    const on = await run(api.toggleWatch(a!.id), (v) => (v ? tr('أُضيف إلى قائمة المتابعة، وسننبهك قبل البداية والنهاية', 'Added to your watchlist') : tr('أُزيل من قائمة المتابعة', 'Removed from your watchlist')))
    if (on !== undefined) setData({ ...data!, mine: { ...(mine ?? { watching: false }), watching: on } })
  }

  const priceLabel = phase === 'ended' ? tr('سعر الترسية', 'Hammer price') : a.bidCount ? tr('أعلى مزايدة', 'Top bid') : tr('السعر الافتتاحي', 'Opening price')

  const myLast = data.bids.find((b) => b.mine)
  const ago = (iso: string) => {
    const m = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000))
    if (m < 1) return tr('الآن', 'just now')
    if (m < 60) return tr(`منذ ${num(m)} ${m <= 10 ? 'دقائق' : 'دقيقة'}`, `${m} min ago`)
    const h = Math.round(m / 60)
    if (h < 24) return tr(`منذ ${num(h)} ${h <= 10 ? 'ساعات' : 'ساعة'}`, `${h} h ago`)
    return date(iso)
  }
  const crown = <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" aria-hidden><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" /></svg>
  const nativeTop = IS_NATIVE && (
    <div className="space-y-2.5 px-3.5 pt-1">
      <section className="app-card !p-3">
        <div className="flex items-start justify-between">
          <span className={`pill ${TYPE_CLS[a.type].pill} !px-3 !text-[13.5px]`}>{TYPE_LABEL[a.type]}</span>
          <span className="flex items-center gap-1.5">
            <FollowBell a={a} myBid={myLast?.amount} size="lg" />
            {user && <button onClick={watch} disabled={busy} aria-pressed={!!mine?.watching} aria-label={tr('احفظ في المتابعة', 'Save')} className="grid h-11 w-11 place-items-center rounded-xl border border-line text-muted"><svg viewBox="0 0 24 24" className="h-5 w-5" fill={mine?.watching ? '#B98A2E' : 'none'} stroke={mine?.watching ? '#B98A2E' : 'currentColor'} strokeWidth="1.9" strokeLinejoin="round"><path d="M6 3h12v18l-6-4-6 4z" /></svg></button>}
          </span>
        </div>
        <h1 className="-mt-1 text-center text-[32px] font-extrabold leading-tight">{a.name}</h1>
        {a.number && <p className="num text-center text-[14px] text-muted">{tr('مزاد رقم', 'Auction')} #{a.number}</p>}
        {leading && phase !== 'ended' && <p className="mt-2 flex justify-center"><span className="inline-flex items-center gap-1.5 rounded-full border border-ok/40 bg-[#E2F0E8] px-4 py-1 text-[14px] font-extrabold text-ok">{tr('أنت المتصدر حاليًا', 'You are leading')}{crown}</span></p>}
        {a.isWinner && phase === 'ended' && <p className="mt-2 flex justify-center"><span className="inline-flex items-center gap-1.5 rounded-full border border-gold/50 bg-gold-soft px-4 py-1 text-[14px] font-extrabold text-gold-deep">{tr('فزت بالمزاد', 'You won')}{crown}</span></p>}
        <div className="mt-3 grid grid-cols-2 border-t border-line/80 pt-3">
          <div className="flex items-center justify-center gap-2 border-e border-line/80">
            <Icon name="coins" className="h-7 w-7 text-gold-deep" />
            <span className="text-center"><b key={flash} className={`num block text-[22px] font-extrabold leading-tight ${flash ? 'bid-flash' : ''}`}>{sar(a.finalPrice ?? a.currentPrice)}</b><span className="text-[12.5px] text-muted">{priceLabel}</span></span>
          </div>
          <div className="text-center"><b className="num block text-[22px] font-extrabold leading-tight">{num(a.bidCount)}</b><span className="text-[12.5px] text-muted">{tr('مزايدات', 'bids')}</span></div>
        </div>
      </section>
      {phase === 'live' && (
        <div className="flex items-center gap-2 rounded-2xl bg-[#E9F4EE] px-4 py-3">
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-pine" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l6-6 4 4 8-8M14 7h7v7" /></svg>
          <span className="flex-1 text-[14px] font-bold">{tr('قيمة المزايدة التالية', 'Next bid')}</span>
          <b className="num text-[22px] font-extrabold text-pine">{sar(min)}</b>
        </div>
      )}
      {(phase === 'live' || phase === 'scheduled') && (
        <div className="flex items-center gap-2 rounded-2xl bg-[#FDECEE] px-4 py-3">
          <Icon name="clock" className="h-5 w-5 text-bad" />
          <span className="flex-1 text-[14px] font-bold">{phase === 'live' ? tr('الوقت المتبقي', 'Time left') : tr('يبدأ بعد', 'Starts in')}</span>
          <b className="num text-[24px] font-extrabold text-bad">{Date.parse(phase === 'live' ? a.endsAt : a.startsAt) - now < 86_400_000 ? <Countdown to={phase === 'live' ? a.endsAt : a.startsAt} /> : humanLeft(Date.parse(phase === 'live' ? a.endsAt : a.startsAt) - now)}</b>
        </div>
      )}
      {myLast && (
        <div className="flex items-center gap-3 rounded-2xl border border-ok/25 bg-[#F1F8F4] px-4 py-2.5">
          {user && <Avatar name={user.fullName} src={user.avatarUrl} size={44} />}
          <span className="min-w-0 flex-1 text-center"><b className="block text-[15px]">{tr('مزايدتك الأخيرة:', 'Your last bid:')} <span className="num">{sar(myLast.amount)}</span></b><span className="text-[12.5px] text-muted">{ago(myLast.createdAt)}</span></span>
        </div>
      )}
      <section className="app-card !p-0 overflow-hidden">
        <div className="grid grid-cols-2 border-b border-line text-[15px] font-extrabold" role="tablist">
          <button role="tab" aria-selected={dtab === 'info'} onClick={() => setDtab('info')} className={`py-3 ${dtab === 'info' ? 'border-b-[3px] border-pine text-pine' : 'text-muted'}`}>{tr('تفاصيل المزاد', 'Details')}</button>
          <button role="tab" aria-selected={dtab === 'bids'} onClick={() => setDtab('bids')} className={`py-3 ${dtab === 'bids' ? 'border-b-[3px] border-pine text-pine' : 'text-muted'}`}>{tr('سجل المزايدات', 'Bid history')} ({num(data.bids.length)})</button>
        </div>
        {dtab === 'bids' ? (
          data.bids.length ? <ul className="divide-y divide-line/70">{data.bids.slice(0, 20).map((b, i) => (
            <li key={b.id} className={`flex items-center gap-2 px-4 py-2.5 text-[14px] ${i === 0 ? 'bg-[#E9F4EE]' : ''}`}>
              <Icon name="users" className="h-[18px] w-[18px] text-muted" />
              <span className="min-w-0 flex-1 truncate font-bold">{user && b.mine ? tr('أنت', 'You') : b.bidderLabel}{b.auto && <span className="ms-1 text-[11.5px] font-normal text-muted">({tr('تلقائية', 'auto')})</span>}</span>
              <span className="text-[12.5px] text-muted">{ago(b.createdAt)}</span>
              <b className="num w-24 text-end">{sar(b.amount)}</b>
            </li>
          ))}</ul> : <p className="px-4 py-4 text-[14px] text-muted">{tr(`لا توجد مزايدات بعد. أول مزايدة تبدأ من ${sar(min)}.`, `No bids yet. The first bid starts at ${sar(min)}.`)}</p>
        ) : (
          <>
            <dl className="divide-y divide-line/70 text-[14px]">
              {([[tr('فئة الاسم', 'Category'), TYPE_LABEL[a.type]], [tr('السعر الافتتاحي', 'Opening price'), sar(a.openingPrice)], [tr('أقل زيادة', 'Minimum raise'), sar(a.minIncrement)], [tr('بداية المزاد', 'Starts'), dateTimeRef(a.startsAt)], [tr('نهاية المزاد', 'Ends'), dateTimeRef(a.endsAt)]] as [string, string][]).map(([l, v]) => (
                <div key={l} className="flex items-center justify-between gap-3 px-4 py-2.5"><dt className="text-muted">{l}</dt><dd className="num text-end font-bold">{v}</dd></div>
              ))}
            </dl>
            <p className="border-t border-line/70 px-4 py-3 text-[13px] leading-6 text-muted">{tr(`يرسو الاسم على أعلى مزايد عند انتهاء الوقت. يسدّد الفائز الفاتورة خلال ${deadline} ساعة ثم يُعاد ضمانه.`, `The name goes to the highest bidder. The winner pays within ${deadline} hours, then the guarantee is returned.`)}</p>
          </>
        )}
      </section>
    </div>
  )

  return (
    <>
      {nativeTop}
      <div className={`hero-field text-paper ${IS_NATIVE ? 'app-hide' : ''}`}>
        <div className="wrap py-8 sm:py-10">
          <nav className="text-[14px] text-paper/60" aria-label={tr('مسار الصفحة', 'Breadcrumb')}><Link to="/" className="hover:text-paper">{tr('الرئيسية', 'Home')}</Link> / <Link to="/auctions" className="hover:text-paper">{tr('المزادات', 'Auctions')}</Link> / <span className="text-paper">{a.name}</span></nav>
          <div className="mt-6 flex flex-col items-start gap-6 sm:flex-row sm:items-center">
            <span className="app-hide"><NameSeal name={a.name} type={a.type} size="lg" latin={a.latin} /></span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><TypeBadge type={a.type} />{a.investment && <Link to="/invest" className="pill bg-gold text-pine hover:bg-gold-light">{tr('استثمار الاسم', 'Name investment')}</Link>}{resale && <Link to="/market" className="pill bg-gold text-pine hover:bg-gold-light">{tr('إعادة بيع من مالكه', 'Resale by its owner')}</Link>}<AuctionStatePill a={a} phase={phase === 'paused' ? 'live' : phase} />{a.number && <span className="num pill bg-stone text-muted">{tr('مزاد رقم', 'Auction')} {a.number}</span>}{(a.extensions ?? 0) > 0 && phase === 'live' && <span className="pill bg-gold text-pine-deep">{tr(`مُدّد ${num(a.extensions!)} مرة`, `Extended ${num(a.extensions!)}×`)}</span>}</div>
              <h1 className="mt-3 text-[40px] font-extrabold leading-none text-paper sm:text-[48px]">{a.name}</h1>
              <p className="mt-2 text-paper/65">{TYPE_HINT[a.type]}</p>
            </div>
            {user && (
              <button onClick={watch} disabled={busy} aria-pressed={!!mine?.watching}
                className={`flex items-center gap-2 rounded-full border px-4 py-2 text-[14px] font-bold transition ${mine?.watching ? 'border-gold bg-gold text-pine-deep' : 'border-paper/30 text-paper hover:bg-paper/10'}`}>
                <Heart on={!!mine?.watching} />{mine?.watching ? tr('في قائمة المتابعة', 'Watching') : tr('تابع المزاد', 'Watch')}
              </button>
            )}
          </div>
        </div>
        <div className="h-1 bg-gold" aria-hidden />
      </div>

      <div className="wrap py-8 pb-28 sm:py-10 lg:pb-10">
        {endsSoon && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-bad/30 bg-bad/5 px-4 py-3 text-[15px] font-bold text-bad" role="status">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-bad" />
            {tr(`الدقائق الأخيرة: أي مزايدة في آخر ${RULES.extendMinutes} دقيقة تمدد المزاد ${RULES.extendMinutes} دقيقة.`, `Final minutes: a bid in the last ${RULES.extendMinutes} minutes extends the auction by ${RULES.extendMinutes} minutes.`)}
          </div>
        )}
        <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
          <div className={`min-w-0 space-y-8 ${IS_NATIVE ? 'app-hide' : ''}`}>
            <Fold title={tr('تطور السعر', 'Price history')}><section className="panel p-5 sm:p-6">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                <h2 className="text-lg">{tr('تطور السعر', 'Price history')}</h2>
                <span className="text-[13px] text-muted"><span className="me-1 inline-block h-2.5 w-2.5 rounded-full border-2 border-gold bg-paper align-middle" />{tr('مزايدة تلقائية', 'Auto bid')}<span className="mx-2 ms-4 inline-block h-2.5 w-2.5 rounded-full bg-gold align-middle" />{tr('مزايدة يدوية', 'Manual bid')}</span>
              </div>
              <PriceChart a={a} bids={data.bids} />
            </section></Fold>

            <Fold title={tr('بيانات المزاد', 'Auction details')} open><section className="panel">
              <h2 className="border-b border-line px-6 py-4 text-lg">{tr('بيانات المزاد', 'Auction details')}</h2>
              <dl className="grid grid-cols-2 sm:grid-cols-3">
                {([
                  [tr('السعر الافتتاحي', 'Opening price'), sar(a.openingPrice)],
                  [tr('أقل زيادة', 'Minimum raise'), sar(a.minIncrement)],
                  [tr('عدد المزايدات', 'Bids'), num(a.bidCount)],
                  [tr('بداية المزاد', 'Starts'), dateTimeRef(a.startsAt)],
                  [tr('نهاية المزاد', 'Ends'), dateTimeRef(a.endsAt)],
                  [tr('التوقيت', 'Time zone'), userTzLabel()],
                ] as [string, string][]).map(([l, v]) => (
                  <div key={l} className="border-b border-e border-line/70 px-6 py-4">
                    <dt className="text-[13px] font-medium text-muted">{l}</dt>
                    <dd className="num mt-0.5 font-bold">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="px-6 py-4 text-[14px] leading-7 text-muted">
                {tr(`يرسو الاسم على أعلى مزايد عند انتهاء الوقت، وإن لم تُسجَّل مزايدة يرسو على مقدم الطلب بالسعر الافتتاحي. تصدر للفائز فاتورة إلكترونية يسدّدها خلال ${deadline} ساعة ثم يُعاد ضمانه، وإن لم يسدّد يُخصم الضمان ويصبح الاسم ملكًا للمنظمة الدولية للإبل.`, `The name goes to the highest bidder when time runs out; with no bids it goes to the requester at the opening price. The winner gets an e-invoice to pay within ${deadline} hours, then the guarantee is returned; unpaid, the guarantee is forfeited and the name passes to the International Camel Organization.`)}
              </p>
            </section></Fold>

            <Fold title={`${tr('سجل المزايدات', 'Bid history')} (${num(data.bids.length)})`}><section>
              <h2 className="sec-title mb-5 !text-xl">{tr('سجل المزايدات', 'Bid history')}</h2>
              {data.bids.length ? (
                <div className="panel overflow-x-auto">
                  <table className="tbl">
                    <thead><tr><th>{tr('المزايد', 'Bidder')}</th><th>{tr('المبلغ', 'Amount')}</th><th>{tr('النوع', 'Type')}</th><th>{tr('الوقت', 'Time')}</th></tr></thead>
                    <tbody>
                      {data.bids.map((b, i) => (
                        <tr key={b.id} className={i === 0 ? 'bg-gold-soft/40 font-semibold' : ''}>
                          <td>{user && b.mine ? tr('أنت', 'You') : b.bidderLabel}{i === 0 && <span className="pill ms-2 bg-gold text-pine-deep">{phase === 'ended' ? tr('الفائز', 'Winner') : tr('الأعلى', 'Top')}</span>}</td>
                          <td className="num">{sar(b.amount)}</td>
                          <td className="text-[13px] text-muted">{b.auto ? tr('تلقائية', 'Auto') : tr('يدوية', 'Manual')}</td>
                          <td className="text-muted">{time(b.createdAt)}{tr('، ', ', ')}{new Date(b.createdAt).toLocaleDateString(locale(), { day: 'numeric', month: 'short' })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="panel px-5 py-6 text-muted">{tr(`لا توجد مزايدات بعد. أول مزايدة تبدأ من ${sar(min)}.`, `No bids yet. The first bid starts at ${sar(min)}.`)}</p>}
            </section></Fold>
          </div>

          <aside ref={panel} id="bid" className={`${IS_NATIVE ? 'app-hide' : ''} panel h-fit self-start overflow-hidden lg:sticky lg:top-6 lg:-mt-24 lg:shadow-lift`}>
            <div className="p-6">
              <div className={IS_NATIVE ? 'app-hide' : ''}>
              <p className="text-sm text-muted">{priceLabel}</p>
              <div key={flash} className={`mt-1 flex items-baseline gap-2 rounded-lg ${flash ? 'bid-flash' : ''}`}>
                <span className="num text-5xl font-extrabold">{num(a.finalPrice ?? a.currentPrice)}</span><span className="text-muted">{cur()}</span><Approx v={a.finalPrice ?? a.currentPrice} className="text-[14px]" />
              </div>
              {a.leaderLabel && phase !== 'ended' && (
                <p className={`mt-1 text-sm ${leading ? 'font-bold text-ok' : 'text-muted'}`}>{leading ? tr('أنت صاحب أعلى مزايدة', 'You hold the top bid') : `${tr('المتصدر:', 'Leading:')} ${a.leaderLabel}`}</p>
              )}
              </div>

              <div className={`mt-4 ${IS_NATIVE ? 'app-hide' : ''}`}>
                {phase === 'live' && <><span className="mb-1.5 block text-sm text-muted">{tr('الوقت المتبقي', 'Time left')}</span><CountdownBoxes to={a.endsAt} tone={endsSoon ? 'urgent' : 'ink'} /></>}
                {phase === 'scheduled' && <><span className="mb-1.5 block text-sm text-muted">{tr('يبدأ بعد', 'Starts in')}</span><CountdownBoxes to={a.startsAt} /></>}
                {phase === 'paused' && (
                  <div role="status" className="rounded-lg border border-info-deep/30 bg-info-soft px-4 py-3 text-info-deep">
                    <b className="block">{tr('المزاد متوقف مؤقتًا', 'This auction is paused')}</b>
                    <span className="text-[14.5px]">{a.pauseReason || tr('أوقفته إدارة المنصة مؤقتًا. يُضاف وقت التوقف إلى مدته عند الاستئناف، ويصلك إشعار.', 'Paused by the platform. The paused time is added back when it resumes, and you will be notified.')}</span>
                  </div>
                )}
                {phase === 'ended' && a.cancelled && (
                  <div className="rounded-lg border border-bad/30 bg-bad/5 px-4 py-3 text-bad">
                    <b className="block">{tr('أُلغي المزاد', 'This auction was cancelled')}</b>
                    <span className="text-[14.5px] text-ink/80">{tr('لم تُحتسب المزايدات ولم يُرسَ الاسم.', 'Bids were not counted and the name was not awarded.')}{a.cancelReason ? ` ${a.cancelReason}` : ''}</span>
                  </div>
                )}
                {phase === 'ended' && !a.cancelled && (
                  <p className="rounded-lg bg-stone px-4 py-3 font-semibold">
                    {a.settled
                      ? a.wonByRequester
                        ? a.bidCount ? tr('رسا الاسم على مقدم الطلب', 'Awarded to the applicant') : tr('لم تُسجَّل مزايدات، فرسا الاسم على مقدم الطلب بالسعر الافتتاحي', 'No bids, so the name went to the requester at the opening price')
                        : tr(`رسا الاسم على ${a.winnerName ? a.winnerName.split(' ')[0] + '…' : 'أعلى مزايد'}`, 'Awarded to the highest bidder')
                      : tr('انتهى المزاد، جارٍ الترسية', 'Auction ended, awarding')}
                    {user && a.isWinner && <Link to="/dashboard/invoices" className="mt-1 block text-gold-deep underline underline-offset-4">{tr('عرض فاتورتك', 'View your invoice')}</Link>}
                  </p>
                )}
              </div>

              {phase !== 'ended' && ownInvest && (
                <p className="mt-5 rounded-lg border border-line bg-stone p-4 text-[14.5px] leading-7">{resale
                  ? tr(`هذا اسمك المعروض للبيع، ولا يمكنك المزايدة عليه. يصلك ثمن البيع بعد خصم عمولة سمّها ${Math.round(RULES.resaleCommission * 100)}% فور سداد المشتري، وإن لم يزايد أحد يبقى الاسم باسمك.`, `This is your name on sale, so you cannot bid on it. You receive the price less the ${Math.round(RULES.resaleCommission * 100)}% commission once the buyer pays.`)
                  : tr('هذا اسمك المقدّم في «استثمار الاسم»، ولا يمكنك المزايدة عليه حفاظًا على عدالة المزاد. لك 30% من قيمة بيعه قبل الضريبة، وإن لم يزايد أحد يؤول إليك.', 'This is your «Name investment» name, so you cannot bid on it. You get 30% of its sale before VAT; if nobody bids, it is yours.')}</p>
              )}
              {needDeposit && (
                <div className="mt-5 rounded-lg border border-gold/60 bg-gold-soft p-4 text-[14.5px] leading-7">
                  <b>{tr('ضمان دخول المزاد', 'Participation guarantee')} {sar(a.bidDeposit ?? RULES.resaleBidDeposit)}</b>
                  <p className="text-ink/80">{resale
                    ? tr('يدفعه كل مشارك قبل المزايدة على اسم معروض من مالكه. يُعاد إلى محفظتك إن لم يرسُ عليك، ويُخصم من فاتورتك إن فزت.', 'Every bidder pays it before bidding on an owner’s resale. It is refunded unless you win, and deducted from your invoice if you do.')
                    : tr(`يدفعه كل مشارك قبل المزايدة. يُعاد إلى محفظتك فور انتهاء المزاد إن لم يرسُ عليك، وإن فزت تسدّد قيمة الشعار كاملة خلال ${deadline} ساعة ثم يُعاد ضمانك. إن لم تُسدّد في المهلة يُخصم الضمان ويصبح الاسم ملكًا للمنظمة الدولية للإبل.`, `Every bidder pays it before bidding. It returns to your wallet when the auction ends unless you win; if you win, pay the full price within ${deadline} hours and it is returned. If you do not pay in time, the guarantee is forfeited and the name passes to the International Camel Organization.`)}</p>
                  <button className="btn-gold mt-3 w-full" disabled={busy} onClick={() => setPayingDeposit(true)}>{tr('دفع الضمان والمشاركة', 'Pay and take part')}</button>
                </div>
              )}
              {phase === 'live' && !ownInvest && !needDeposit && (user ? (
                <form className="mt-5" onSubmit={(e) => { e.preventDefault(); tryBid(Number(amount)) }}>
                  {isRequester && <p className="mb-3 rounded-md bg-stone px-3 py-2 text-[13px] text-muted">{tr(`أنت مقدم طلب هذا الاسم، وضمان طلبك يغطي دخولك المزاد. إن لم يزايد أحد يرسو عليك بالسعر الافتتاحي، وتسدّده خلال ${deadline} ساعة ثم يُعاد ضمانك.`, `You requested this name; your request guarantee covers your entry. If nobody bids it is yours at the opening price, payable within ${deadline} hours, then your guarantee is returned.`)}</p>}
                  <span className="label">{tr('مزايدة سريعة', 'Quick bid')}</span>
                  <div className="grid grid-cols-3 gap-2">
                    {[a.minIncrement, 50, 100].map((step, k) => {
                      const inc = Math.max(step, a.minIncrement)
                      const v = a.currentPrice + inc
                      return (
                        <button type="button" key={k} disabled={busy || leading} onClick={() => tryBid(v)}
                          className="flex flex-col items-center rounded-lg border-2 border-line bg-paper py-2 transition hover:border-gold hover:bg-gold-soft/40 disabled:opacity-50">
                          <span className="text-[12px] font-bold text-gold-deep">+{num(inc)}</span>
                          <span className="num text-[17px] font-extrabold">{num(v)}</span>
                        </button>
                      )
                    })}
                  </div>
                  <label className="label mt-4" htmlFor="amt">{tr('مبلغ آخر', 'Other amount')}</label>
                  <div className="flex gap-2">
                    <input id="amt" className="field num" inputMode="numeric" placeholder={tr(`${num(min)} أو أكثر`, `${num(min)} or more`)} value={amount} onChange={(e) => { setAmount(e.target.value.replace(/[^\d]/g, '')); setConfirm(null) }} />
                    <button className="btn-gold shrink-0" disabled={busy || !amount || leading}>{tr('زايد', 'Bid')}</button>
                  </div>
                  {confirm !== null && (
                    <div className="mt-3 rounded-lg border border-gold bg-gold-soft p-3 text-[14px]">
                      {tr(`مزايدتك ${sar(confirm)} أعلى بكثير من السعر الحالي. متأكد؟`, `Your bid of ${sar(confirm)} is far above the current price. Sure?`)}
                      <div className="mt-2 flex gap-2"><button type="button" className="btn-gold btn-sm" onClick={() => bid(confirm)}>{tr('تأكيد المزايدة', 'Confirm bid')}</button><button type="button" className="btn-ghost btn-sm" onClick={() => setConfirm(null)}>{tr('تراجع', 'Cancel')}</button></div>
                    </div>
                  )}
                  <p className="hint">{leading ? tr('أنت صاحب أعلى مزايدة حاليًا.', 'You hold the top bid.') : <>{tr(`أقل مزايدة ${sar(min)}.`, `Minimum bid ${sar(min)}.`)} <Approx v={min} /></>}</p>
                </form>
              ) : (
                <Link to="/login" state={{ from: loc.pathname }} className="btn-gold mt-5 w-full">{tr('سجّل الدخول للمزايدة', 'Sign in to bid')}</Link>
              ))}
            </div>

            {user && phase !== 'ended' && !ownInvest && !needDeposit && (
              <div className="border-t border-line bg-stone/60 p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-[16px]">{tr('المزايدة التلقائية', 'Automatic bidding')}</h3>
                  {mine?.autoMax && <span className="pill bg-[#E2F0E8] text-ok">{tr('مفعّلة', 'On')}</span>}
                </div>
                <p className="mt-1 text-[13.5px] leading-6 text-muted">{tr('حدد أقصى مبلغ، والمنصة تزايد عنك بأقل زيادة كلما تجاوزك أحد، حتى هذا الحد. لا أحد يرى حدّك.', 'Set your ceiling and the platform outbids others for you by the minimum step, up to that amount. Nobody sees your ceiling.')}</p>
                {mine?.autoMax ? (
                  <div className="mt-3 flex items-center justify-between rounded-lg bg-paper px-4 py-3">
                    <span className="text-[14px]">{tr('حدّك الأقصى', 'Your ceiling')} <b className="num">{sar(mine.autoMax)}</b></span>
                    <button className="text-[13.5px] font-bold text-bad hover:underline" disabled={busy}
                      onClick={async () => { const r = await run(api.cancelAutoBid(a.id), () => tr('أُوقفت المزايدة التلقائية', 'Auto-bid stopped')); if (r) setData(r) }}>{tr('إيقاف', 'Stop')}</button>
                  </div>
                ) : null}
                <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); auto() }}>
                  <input className="field num" inputMode="numeric" aria-label={tr('الحد الأقصى', 'Ceiling')} placeholder={mine?.autoMax ? tr('حد جديد', 'New ceiling') : tr(`الحد الأقصى، ${num(min)} أو أكثر`, `Ceiling, ${num(min)} or more`)}
                    value={autoMax} onChange={(e) => setAutoMax(e.target.value.replace(/[^\d]/g, ''))} />
                  <button className="btn-primary shrink-0" disabled={busy || !autoMax}>{mine?.autoMax ? tr('تحديث', 'Update') : tr('تفعيل', 'Set')}</button>
                </form>
                {phase === 'scheduled' && <p className="hint">{tr('تبدأ المزايدة عنك تلقائيًا مع افتتاح المزاد.', 'It starts bidding for you when the auction opens.')}</p>}
              </div>
            )}
          </aside>
        </div>
      </div>

      {/* mobile: price and bid button always in reach */}
      <Sheet open={ask !== null} onClose={() => setAsk(null)} title={tr('تأكيد المزايدة', 'Confirm your bid')}>
        {ask !== null && (
          <div className="space-y-3 pb-2">
            <dl className="divide-y divide-line/70 rounded-xl border border-line">
              {([[tr('الاسم', 'Name'), a.name], [tr('أعلى مزايدة حالية', 'Current top bid'), sar(a.currentPrice)], [tr('قيمة الزيادة', 'Your raise'), sar(Math.max(ask - a.currentPrice, 0))]] as [string, string][]).map(([l, v]) => (
                <div key={l} className="flex items-center justify-between px-4 py-3"><dt className="text-[14px] text-muted">{l}</dt><dd className="num font-bold">{v}</dd></div>
              ))}
            </dl>
            <div className="rounded-xl border-2 border-gold/60 bg-gold-soft px-3 py-3">
              <span className="block text-center text-[13.5px] font-bold text-gold-deep">{tr('مزايدتك الجديدة', 'Your new bid')}</span>
              <div className="mt-1 flex items-center gap-2">
                <button type="button" aria-label={tr('أنقص', 'Less')} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-paper text-[22px] font-bold text-pine shadow-sm disabled:opacity-40" disabled={ask - a.minIncrement < min} onClick={() => { void haptic('tap'); setAsk(ask - a.minIncrement) }}>−</button>
                <input className="num min-w-0 flex-1 bg-transparent text-center text-[26px] font-extrabold outline-none" inputMode="numeric" value={String(ask)} onChange={(e) => setAsk(Number(e.target.value.replace(/[^\d]/g, '')) || 0)} aria-label={tr('مبلغ المزايدة', 'Bid amount')} />
                <button type="button" aria-label={tr('زد', 'More')} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-pine text-[22px] font-bold text-paper shadow-sm" onClick={() => { void haptic('tap'); setAsk(ask + a.minIncrement) }}>+</button>
              </div>
              <div className="mt-2 flex justify-center gap-2">{[1, 2, 5].map((k) => <button key={k} type="button" className="rounded-full border border-gold/50 bg-paper px-3 py-1 text-[12.5px] font-bold" onClick={() => setAsk(a.currentPrice + a.minIncrement * k)}>+{num(a.minIncrement * k)}</button>)}</div>
            </div>
            {ask < min && <p className="text-[13.5px] font-bold text-bad">{tr(`أقل مزايدة مسموحة ${sar(min)}.`, `The minimum bid is ${sar(min)}.`)}</p>}
            <button className="btn-primary w-full" disabled={busy || ask < min} onClick={async () => {
              const v = ask
              if (v >= BIG_BID && lockEnabled() && !(await verifyOwner(tr(`تأكيد مزايدة بمبلغ ${sar(v)}`, `Confirm a bid of ${sar(v)}`)))) return
              setAsk(null); void bid(v)
            }}>{tr('تأكيد المزايدة', 'Confirm bid')}</button>
            <details className="rounded-xl border border-line px-3 py-2">
              <summary className="cursor-pointer text-[14px] font-bold text-pine">{mine?.autoMax ? tr(`المزايدة التلقائية مفعّلة حتى ${sar(mine.autoMax)}`, `Auto-bid on up to ${sar(mine.autoMax)}`) : tr('مزايدة تلقائية', 'Auto-bid')}</summary>
              <p className="mt-1 text-[12.5px] leading-6 text-muted">{tr('حدد أقصى مبلغ، ونزايد عنك بأقل زيادة كلما تجاوزك أحد حتى هذا الحد.', 'Set a ceiling; we bid the minimum raise for you whenever you are outbid, up to it.')}</p>
              <div className="mt-2 flex gap-2">
                <input className="field num" inputMode="numeric" placeholder={tr(`الحد الأقصى، ${num(min)} أو أكثر`, `Ceiling, ${num(min)} or more`)} value={autoMax} onChange={(e) => setAutoMax(e.target.value.replace(/[^\d]/g, ''))} aria-label={tr('الحد الأقصى', 'Ceiling')} />
                <button className="btn-primary shrink-0" disabled={busy || !autoMax} onClick={() => { setAsk(null); void auto() }}>{mine?.autoMax ? tr('تحديث', 'Update') : tr('تفعيل', 'Set')}</button>
              </div>
              {mine?.autoMax ? <button className="mt-2 text-[13px] font-bold text-bad" disabled={busy} onClick={async () => { setAsk(null); const r = await run(api.cancelAutoBid(a.id), () => tr('أُوقفت المزايدة التلقائية', 'Auto-bid stopped')); if (r) setData(r) }}>{tr('إيقاف المزايدة التلقائية', 'Stop auto-bid')}</button> : null}
            </details>
            <button className="btn-ghost w-full" onClick={() => setAsk(null)}>{tr('إلغاء', 'Cancel')}</button>
          </div>
        )}
      </Sheet>
      {payingDeposit && (
        <PayModal open title={tr(`ضمان دخول مزاد «${a.name}»`, `Guarantee for “${a.name}”`)} amount={a.bidDeposit ?? RULES.resaleBidDeposit} onClose={() => setPayingDeposit(false)}
          onPay={async (m) => { try { setData(await api.payBidDeposit(a.id, m)); toast(tr('تم دفع الضمان، تقدر تزايد الآن', 'Guarantee paid, you can bid now')) } catch (e) { toast((e as Error).message, 'bad'); throw e } }} />
      )}
      {phase === 'live' && !ownInvest && (
        <div className="app-bidbar fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 px-4 py-3 shadow-[0_-8px_24px_-12px_rgba(0,0,0,.25)] backdrop-blur lg:hidden print:hidden">
          <div className="mx-auto flex max-w-xl items-center gap-3">
            {IS_NATIVE ? (
              user && needDeposit
                ? <button className="btn-gold w-full" onClick={() => setPayingDeposit(true)}>{tr('ادفع الضمان للمشاركة', 'Pay the guarantee to take part')}</button>
                : user
                ? <button className="btn-primary w-full" disabled={busy || leading} onClick={() => tryBid(min)}><Icon name="gavel" className="h-5 w-5" />{leading ? tr('أنت المتصدر', 'You are leading') : tr('زايد الآن', 'Bid now')}</button>
                : <Link to="/login" state={{ from: loc.pathname }} className="btn-primary w-full">{tr('سجّل للمزايدة', 'Sign in to bid')}</Link>
            ) : <>
            <div className="min-w-0 flex-1">
              <div className="num text-[22px] font-extrabold leading-none">{num(a.currentPrice)} <span className="text-[13px] font-medium text-muted">{cur()}</span></div>
              <Countdown to={a.endsAt} className={`text-[13px] font-bold ${endsSoon ? 'text-bad' : 'text-muted'}`} />
            </div>
            {user && needDeposit
              ? <button className="btn-gold" onClick={() => setPayingDeposit(true)}>{tr('ادفع الضمان', 'Pay guarantee')}</button>
              : user
              ? <button className="btn-gold" disabled={busy || leading} onClick={() => tryBid(min)}>{leading ? tr('أنت المتصدر', 'Leading') : tr(`زايد ${num(min)}`, `Bid ${num(min)}`)}</button>
              : <Link to="/login" state={{ from: loc.pathname }} className="btn-gold">{tr('سجّل للمزايدة', 'Sign in to bid')}</Link>}
            <button className="btn-ghost btn-sm" onClick={() => panel.current?.scrollIntoView({ behavior: 'smooth' })} aria-label={tr('خيارات المزايدة', 'Bid options')}>⋯</button>
            </>}
          </div>
        </div>
      )}
    </>
  )
}

function AuctionSkeleton() {
  return (
    <>
      <div className="hero-field"><div className="wrap flex items-center gap-6 py-12"><Skeleton className="h-28 w-44 rounded-lg !bg-paper/10" /><div className="space-y-3"><Skeleton className="h-5 w-32 !bg-paper/10" /><Skeleton className="h-10 w-56 !bg-paper/10" /></div></div></div>
      <div className="wrap grid gap-8 py-10 lg:grid-cols-[1fr_400px]">
        <div className="space-y-6"><Skeleton className="h-64 rounded-lg" /><Skeleton className="h-48 rounded-lg" /></div>
        <Skeleton className="h-96 rounded-lg" />
      </div>
    </>
  )
}
