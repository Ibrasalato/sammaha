import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { locale, tr } from '../lib/i18n'
import { Countdown, ErrorBox, Loading, NameSeal, PhasePill, TypeBadge } from '../components/ui'
import { RULES, TYPE_HINT } from '../lib/config'
import { phaseOf } from '../lib/demoApi'
import { cur, dateTime, num, sar, time } from '../lib/format'
import { api, useApp, useLoad, useNow } from '../lib/store'

export default function AuctionDetail() {
  const { id = '' } = useParams()
  const { user, toast } = useApp()
  const loc = useLocation()
  const { data, error, loading, setData } = useLoad(() => api.getAuction(id), [id], 4000)
  const now = useNow(1000)
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState(0)
  const lastPrice = useRef<number | null>(null)

  const a = data?.auction
  const min = a ? a.currentPrice + a.minIncrement : 0
  useEffect(() => {
    if (!a) return
    if (lastPrice.current !== null && a.currentPrice !== lastPrice.current) setFlash((f) => f + 1)
    lastPrice.current = a.currentPrice
  }, [a?.currentPrice]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading && !data) return <Loading />
  if (error || !a) return <div className="mx-auto max-w-3xl px-4 py-10"><ErrorBox text={error || tr('المزاد غير موجود', 'Auction not found')} /></div>

  const phase = phaseOf(a, now)
  const isRequester = user?.id === a.requesterId
  const leading = user && a.leaderId === user.id

  async function bid(value: number) {
    setBusy(true)
    try {
      const res = await api.placeBid(a!.id, value)
      setData(res)
      setAmount('')
      toast(tr(`تمت مزايدتك بمبلغ ${sar(value)}`, `Your bid of ${sar(value)} was placed`))
    } catch (e) { toast((e as Error).message, 'bad') } finally { setBusy(false) }
  }

  return (
    <>
    <div className="hero-field text-paper">
      <div className="wrap py-10">
        <nav className="text-[14px] text-paper/60" aria-label={tr('مسار الصفحة', 'Breadcrumb')}><Link to="/" className="hover:text-paper">{tr('الرئيسية', 'Home')}</Link> / <Link to="/auctions" className="hover:text-paper">{tr('المزادات', 'Auctions')}</Link> / <span className="text-paper">{a.name}</span></nav>
        <div className="mt-6 flex flex-col items-start gap-6 sm:flex-row sm:items-center">
          <NameSeal name={a.name} type={a.type} size="lg" />
          <div>
            <div className="flex flex-wrap items-center gap-2"><TypeBadge type={a.type} /><PhasePill phase={phase} /></div>
            <h1 className="mt-3 text-[44px] font-extrabold leading-none text-paper">{a.name}</h1>
            <p className="mt-2 text-paper/65">{TYPE_HINT[a.type]}</p>
          </div>
        </div>
      </div>
      <div className="h-1 bg-gold" aria-hidden />
    </div>
    <div className="wrap py-10">
      <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
        <section className="panel h-fit">
          <h2 className="border-b border-line px-6 py-4 text-lg">{tr('بيانات المزاد', 'Auction details')}</h2>
          <dl className="grid grid-cols-2 sm:grid-cols-3">
            {([
              [tr('السعر الافتتاحي', 'Opening price'), sar(a.openingPrice)],
              [tr('أقل زيادة', 'Minimum raise'), sar(a.minIncrement)],
              [tr('عدد المزايدات', 'Bids'), num(a.bidCount)],
              [tr('بداية المزاد', 'Starts'), dateTime(a.startsAt)],
              [tr('نهاية المزاد', 'Ends'), dateTime(a.endsAt)],
              [tr('التوقيت', 'Time zone'), tr('توقيت الرياض', 'Riyadh time')],
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

        <aside className="panel h-fit self-start p-6 lg:-mt-24 lg:shadow-lift">
          <p className="text-sm text-muted">{phase === 'ended' ? tr('سعر الترسية', 'Hammer price') : a.bidCount ? tr('أعلى مزايدة', 'Top bid') : tr('السعر الافتتاحي', 'Opening price')}</p>
          <div key={flash} className={`mt-1 flex items-baseline gap-2 rounded-lg ${flash ? 'bid-flash' : ''}`}>
            <span className="num font-extrabold text-5xl font-semibold">{num(a.finalPrice ?? a.currentPrice)}</span><span className="text-muted">{cur()}</span>
          </div>
          {a.leaderLabel && phase !== 'ended' && <p className="mt-1 text-sm text-muted">{tr('المتصدر:', 'Leading:')} {leading ? tr('أنت', 'You') : a.leaderLabel}</p>}

          <div className="mt-4 rounded-lg bg-stone px-4 py-3">
            {phase === 'live' && <><span className="text-sm text-muted">{tr('الوقت المتبقي', 'Time left')}</span><Countdown to={a.endsAt} className="block font-extrabold text-2xl font-semibold" /></>}
            {phase === 'scheduled' && <><span className="text-sm text-muted">{tr('يبدأ بعد', 'Starts in')}</span><Countdown to={a.startsAt} className="block font-extrabold text-2xl font-semibold" /></>}
            {phase === 'ended' && (
              <p className="font-semibold">
                {a.settled
                  ? a.wonByRequester
                    ? a.bidCount ? tr('رسا الاسم على مقدم الطلب', 'Awarded to the applicant') : tr('لم تُسجَّل مزايدات، فرسا الاسم على مقدم الطلب بمبلغ الضمان', 'No bids, so the name went to the applicant for the guarantee amount')
                    : tr(`رسا الاسم على ${a.winnerName ? a.winnerName.split(' ')[0] + '…' : 'أعلى مزايد'}`, 'Awarded to the highest bidder')
                  : tr('انتهى المزاد، جارٍ الترسية', 'Auction ended, awarding')}
                {user && a.winnerId === user.id && <Link to="/dashboard/invoices" className="mt-1 block text-gold-deep underline underline-offset-4">{tr('عرض فاتورتك', 'View your invoice')}</Link>}
              </p>
            )}
          </div>

          {phase === 'live' && (
            user ? (
              <form className="mt-4" onSubmit={(e) => { e.preventDefault(); bid(Number(amount)) }}>
                {isRequester && <p className="mb-3 text-[13px] text-muted">{tr('أنت مقدم طلب هذا الاسم. إن لم يزايد أحد يرسو عليك بمبلغ الضمان.', 'You requested this name. If nobody bids it is yours for the guarantee amount.')}</p>}
                <div className="mb-2 flex gap-2">
                  {[1, 5, 10].map((k) => {
                    const v = a.currentPrice + k * a.minIncrement
                    return <button type="button" key={k} disabled={busy || !!leading} onClick={() => bid(v)} className="btn-ghost btn-sm flex-1 num">{num(v)}</button>
                  })}
                </div>
                <label className="label" htmlFor="amt">{tr('مبلغ آخر', 'Other amount')}</label>
                <div className="flex gap-2">
                  <input id="amt" className="field num" inputMode="numeric" placeholder={tr(`${min} أو أكثر`, `${min} or more`)} value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))} />
                  <button className="btn-gold shrink-0" disabled={busy || !amount || !!leading}>{tr('زايد', 'Bid')}</button>
                </div>
                <p className="hint">{leading ? tr('أنت صاحب أعلى مزايدة حاليًا.', 'You hold the top bid.') : tr(`أقل مزايدة ${sar(min)}. المزايدة في آخر ${RULES.extendMinutes} دقيقة تمدّد المزاد ${RULES.extendMinutes} دقيقة.`, `Minimum bid ${sar(min)}. A bid in the last ${RULES.extendMinutes} minutes extends the auction by ${RULES.extendMinutes} minutes.`)}</p>
              </form>
            ) : (
              <Link to="/login" state={{ from: loc.pathname }} className="btn-gold mt-4 w-full">{tr('سجّل الدخول للمزايدة', 'Sign in to bid')}</Link>
            )
          )}
        </aside>
      </div>

      <section className="mt-10">
        <h2 className="sec-title mb-5 !text-xl">{tr('سجل المزايدات', 'Bid history')}</h2>
        {data.bids.length ? (
          <div className="panel overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>{tr('المزايد', 'Bidder')}</th><th>{tr('المبلغ', 'Amount')}</th><th>{tr('الوقت', 'Time')}</th></tr></thead>
              <tbody>
                {data.bids.map((b, i) => (
                  <tr key={b.id} className={i === 0 ? 'font-semibold' : ''}>
                    <td>{user?.id === b.userId ? tr('أنت', 'You') : b.bidderLabel}</td>
                    <td className="num">{sar(b.amount)}</td>
                    <td className="text-muted">{time(b.createdAt)}, {new Date(b.createdAt).toLocaleDateString(locale(), { day: 'numeric', month: 'short' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="panel px-5 py-6 text-muted">{tr(`لا توجد مزايدات بعد. أول مزايدة تبدأ من ${sar(min)}.`, `No bids yet. The first bid starts at ${sar(min)}.`)}</p>}
      </section>
    </div>
    </>
  )
}
