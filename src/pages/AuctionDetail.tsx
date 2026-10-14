import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { locale, tr } from '../lib/i18n'
import { AuctionStatePill, Countdown, ErrorBox, NameSeal, TypeBadge } from '../components/ui'
import { Skeleton } from '../components/Skeleton'
import { PriceChart } from '../components/PriceChart'
import { CountdownBoxes } from '../components/AuctionCard'
import { PayModal } from '../components/PayModal'
import { RULES, TYPE_HINT } from '../lib/config'
import { phaseOf } from '../lib/demoApi'
import { cur, dateTimeRef, num, sar, time } from '../lib/format'
import { api, useApp, useLoad, useNow } from '../lib/store'
import { usePageTitle } from '../lib/usePageTitle'
import { Approx } from '../components/Region'
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
  const { user, toast } = useApp()
  const loc = useLocation()
  const { data, error, loading, setData, reload } = useLoad(() => api.getAuction(id), [id, user?.id], 5000)
  const now = useNow(1000)
  const [amount, setAmount] = useState('')
  const [autoMax, setAutoMax] = useState('')
  const [confirm, setConfirm] = useState<number | null>(null)
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
  const isRequester = user?.id === a.requesterId
  const resale = !!a.listingId
  const ownInvest = (!!a.investment || resale) && isRequester // the proposer or seller may not bid on the name
  // resale auctions: bidders pay a participation guarantee first
  const needDeposit = resale && !!user && !isRequester && !mine?.depositPaid && phase !== 'ended'
  const leading = !!user && a.leaderId === user.id
  const endsSoon = phase === 'live' && Date.parse(a.endsAt) - now < RULES.extendMinutes * 60_000 * 3

  async function run<T>(p: Promise<T>, ok: (r: T) => string) {
    setBusy(true)
    try { const r = await p; toast(ok(r)); return r } catch (e) { toast((e as Error).message, 'bad') } finally { setBusy(false); setConfirm(null) }
  }
  async function bid(value: number) {
    // a jump of more than double the current price asks once more
    if (value > a!.currentPrice * 2 && value - a!.currentPrice > 500 && confirm !== value) { setConfirm(value); return }
    const r = await run(api.placeBid(a!.id, value), () => tr(`تمت مزايدتك بمبلغ ${sar(value)}`, `Your bid of ${sar(value)} was placed`))
    if (r) { setData(r); setAmount('') }
  }
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

  return (
    <>
      <div className="hero-field text-paper">
        <div className="wrap py-8 sm:py-10">
          <nav className="text-[14px] text-paper/60" aria-label={tr('مسار الصفحة', 'Breadcrumb')}><Link to="/" className="hover:text-paper">{tr('الرئيسية', 'Home')}</Link> / <Link to="/auctions" className="hover:text-paper">{tr('المزادات', 'Auctions')}</Link> / <span className="text-paper">{a.name}</span></nav>
          <div className="mt-6 flex flex-col items-start gap-6 sm:flex-row sm:items-center">
            <NameSeal name={a.name} type={a.type} size="lg" latin={a.latin} />
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
          <div className="min-w-0 space-y-8">
            <section className="panel p-5 sm:p-6">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                <h2 className="text-lg">{tr('تطور السعر', 'Price history')}</h2>
                <span className="text-[13px] text-muted"><span className="me-1 inline-block h-2.5 w-2.5 rounded-full border-2 border-gold bg-paper align-middle" />{tr('مزايدة تلقائية', 'Auto bid')}<span className="mx-2 ms-4 inline-block h-2.5 w-2.5 rounded-full bg-gold align-middle" />{tr('مزايدة يدوية', 'Manual bid')}</span>
              </div>
              <PriceChart a={a} bids={data.bids} />
            </section>

            <section className="panel">
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
                {tr('يرسو الاسم على أعلى مزايد عند انتهاء الوقت. إن لم تُسجَّل أي مزايدة يرسو على مقدم الطلب بمبلغ الضمان، وتصدر للفائز فاتورة إلكترونية.', 'The name is awarded to the highest bidder when time runs out. If there are no bids it goes to the applicant for the guarantee amount, and the winner receives an e-invoice.')}
              </p>
            </section>

            <section>
              <h2 className="sec-title mb-5 !text-xl">{tr('سجل المزايدات', 'Bid history')}</h2>
              {data.bids.length ? (
                <div className="panel overflow-x-auto">
                  <table className="tbl">
                    <thead><tr><th>{tr('المزايد', 'Bidder')}</th><th>{tr('المبلغ', 'Amount')}</th><th>{tr('النوع', 'Type')}</th><th>{tr('الوقت', 'Time')}</th></tr></thead>
                    <tbody>
                      {data.bids.map((b, i) => (
                        <tr key={b.id} className={i === 0 ? 'bg-gold-soft/40 font-semibold' : ''}>
                          <td>{user?.id === b.userId ? tr('أنت', 'You') : b.bidderLabel}{i === 0 && <span className="pill ms-2 bg-gold text-pine-deep">{phase === 'ended' ? tr('الفائز', 'Winner') : tr('الأعلى', 'Top')}</span>}</td>
                          <td className="num">{sar(b.amount)}</td>
                          <td className="text-[13px] text-muted">{b.auto ? tr('تلقائية', 'Auto') : tr('يدوية', 'Manual')}</td>
                          <td className="text-muted">{time(b.createdAt)}{tr('، ', ', ')}{new Date(b.createdAt).toLocaleDateString(locale(), { day: 'numeric', month: 'short' })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="panel px-5 py-6 text-muted">{tr(`لا توجد مزايدات بعد. أول مزايدة تبدأ من ${sar(min)}.`, `No bids yet. The first bid starts at ${sar(min)}.`)}</p>}
            </section>
          </div>

          <aside ref={panel} id="bid" className="panel h-fit self-start overflow-hidden lg:sticky lg:top-6 lg:-mt-24 lg:shadow-lift">
            <div className="p-6">
              <p className="text-sm text-muted">{priceLabel}</p>
              <div key={flash} className={`mt-1 flex items-baseline gap-2 rounded-lg ${flash ? 'bid-flash' : ''}`}>
                <span className="num text-5xl font-extrabold">{num(a.finalPrice ?? a.currentPrice)}</span><span className="text-muted">{cur()}</span><Approx v={a.finalPrice ?? a.currentPrice} className="text-[14px]" />
              </div>
              {a.leaderLabel && phase !== 'ended' && (
                <p className={`mt-1 text-sm ${leading ? 'font-bold text-ok' : 'text-muted'}`}>{leading ? tr('أنت صاحب أعلى مزايدة', 'You hold the top bid') : `${tr('المتصدر:', 'Leading:')} ${a.leaderLabel}`}</p>
              )}

              <div className="mt-4">
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
                        ? a.bidCount ? tr('رسا الاسم على مقدم الطلب', 'Awarded to the applicant') : tr('لم تُسجَّل مزايدات، فرسا الاسم على مقدم الطلب بمبلغ الضمان', 'No bids, so the name went to the applicant for the guarantee amount')
                        : tr(`رسا الاسم على ${a.winnerName ? a.winnerName.split(' ')[0] + '…' : 'أعلى مزايد'}`, 'Awarded to the highest bidder')
                      : tr('انتهى المزاد، جارٍ الترسية', 'Auction ended, awarding')}
                    {user && a.winnerId === user.id && <Link to="/dashboard/invoices" className="mt-1 block text-gold-deep underline underline-offset-4">{tr('عرض فاتورتك', 'View your invoice')}</Link>}
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
                  <p className="text-ink/80">{tr('يدفعه كل مشارك قبل المزايدة على اسم معروض من مالكه. يُعاد إلى محفظتك إن لم يرسُ عليك، ويُخصم من فاتورتك إن فزت.', 'Every bidder pays it before bidding on an owner’s resale. It is refunded unless you win, and deducted from your invoice if you do.')}</p>
                  <button className="btn-gold mt-3 w-full" disabled={busy} onClick={() => setPayingDeposit(true)}>{tr('دفع الضمان والمشاركة', 'Pay and take part')}</button>
                </div>
              )}
              {phase === 'live' && !ownInvest && !needDeposit && (user ? (
                <form className="mt-5" onSubmit={(e) => { e.preventDefault(); bid(Number(amount)) }}>
                  {isRequester && <p className="mb-3 rounded-md bg-stone px-3 py-2 text-[13px] text-muted">{tr('أنت مقدم طلب هذا الاسم. إن لم يزايد أحد يرسو عليك بمبلغ الضمان.', 'You requested this name. If nobody bids it is yours for the guarantee amount.')}</p>}
                  <span className="label">{tr('مزايدة سريعة', 'Quick bid')}</span>
                  <div className="grid grid-cols-3 gap-2">
                    {[a.minIncrement, 50, 100].map((step, k) => {
                      const inc = Math.max(step, a.minIncrement)
                      const v = a.currentPrice + inc
                      return (
                        <button type="button" key={k} disabled={busy || leading} onClick={() => bid(v)}
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
      {payingDeposit && (
        <PayModal open title={tr(`ضمان دخول مزاد «${a.name}»`, `Guarantee for “${a.name}”`)} amount={a.bidDeposit ?? RULES.resaleBidDeposit} onClose={() => setPayingDeposit(false)}
          onPay={async (m) => { try { setData(await api.payBidDeposit(a.id, m)); toast(tr('تم دفع الضمان، تقدر تزايد الآن', 'Guarantee paid, you can bid now')) } catch (e) { toast((e as Error).message, 'bad'); throw e } }} />
      )}
      {phase === 'live' && !ownInvest && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 px-4 py-3 shadow-[0_-8px_24px_-12px_rgba(0,0,0,.25)] backdrop-blur lg:hidden print:hidden">
          <div className="mx-auto flex max-w-xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="num text-[22px] font-extrabold leading-none">{num(a.currentPrice)} <span className="text-[13px] font-medium text-muted">{cur()}</span></div>
              <Countdown to={a.endsAt} className={`text-[13px] font-bold ${endsSoon ? 'text-bad' : 'text-muted'}`} />
            </div>
            {user && needDeposit
              ? <button className="btn-gold" onClick={() => setPayingDeposit(true)}>{tr('ادفع الضمان', 'Pay guarantee')}</button>
              : user
              ? <button className="btn-gold" disabled={busy || leading} onClick={() => bid(min)}>{leading ? tr('أنت المتصدر', 'Leading') : tr(`زايد ${num(min)}`, `Bid ${num(min)}`)}</button>
              : <Link to="/login" state={{ from: loc.pathname }} className="btn-gold">{tr('سجّل للمزايدة', 'Sign in to bid')}</Link>}
            <button className="btn-ghost btn-sm" onClick={() => panel.current?.scrollIntoView({ behavior: 'smooth' })} aria-label={tr('خيارات المزايدة', 'Bid options')}>⋯</button>
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
