import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { Countdown, ErrorBox, Loading, NameSeal, PhasePill, TypeBadge } from '../components/ui'
import { RULES, TYPE_HINT } from '../lib/config'
import { phaseOf } from '../lib/demoApi'
import { dateTime, num, sar, time } from '../lib/format'
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
  if (error || !a) return <div className="mx-auto max-w-3xl px-4 py-10"><ErrorBox text={error || 'المزاد غير موجود'} /></div>

  const phase = phaseOf(a, now)
  const isRequester = user?.id === a.requesterId
  const leading = user && a.leaderId === user.id

  async function bid(value: number) {
    setBusy(true)
    try {
      const res = await api.placeBid(a!.id, value)
      setData(res)
      setAmount('')
      toast(`تمت مزايدتك بمبلغ ${sar(value)}`)
    } catch (e) { toast((e as Error).message, 'bad') } finally { setBusy(false) }
  }

  return (
    <>
    <div className="hero-field text-paper">
      <div className="wrap py-10">
        <nav className="text-[14px] text-paper/60" aria-label="مسار الصفحة"><Link to="/" className="hover:text-paper">الرئيسية</Link> / <Link to="/auctions" className="hover:text-paper">المزادات</Link> / <span className="text-paper">{a.name}</span></nav>
        <div className="mt-6 flex flex-col items-start gap-6 sm:flex-row sm:items-center">
          <NameSeal name={a.name} type={a.type} size="lg" />
          <div>
            <div className="flex flex-wrap items-center gap-2"><TypeBadge type={a.type} /><PhasePill phase={phase} /></div>
            <h1 className="mt-3 text-[44px] font-extrabold leading-none text-paper">{a.name}</h1>
            <p className="mt-2 text-paper/65">{TYPE_HINT[a.type]}</p>
          </div>
        </div>
      </div>
      <div className="sadu sadu-thin" aria-hidden />
    </div>
    <div className="wrap py-10">
      <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
        <section className="panel h-fit">
          <h2 className="border-b border-line px-6 py-4 text-lg">بيانات المزاد</h2>
          <dl className="grid grid-cols-2 sm:grid-cols-3">
            {([
              ['السعر الافتتاحي', sar(a.openingPrice)],
              ['أقل زيادة', sar(a.minIncrement)],
              ['عدد المزايدات', num(a.bidCount)],
              ['بداية المزاد', dateTime(a.startsAt)],
              ['نهاية المزاد', dateTime(a.endsAt)],
              ['التوقيت', 'توقيت الرياض'],
            ] as [string, string][]).map(([l, v]) => (
              <div key={l} className="border-b border-e border-line/70 px-6 py-4">
                <dt className="text-[13px] font-bold text-muted">{l}</dt>
                <dd className="num mt-0.5 font-bold">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="px-6 py-4 text-[14px] leading-7 text-muted">
            يرسو الاسم على أعلى مزايد عند انتهاء الوقت. إن لم تُسجَّل أي مزايدة يرسو على مقدم الطلب بمبلغ الضمان، وتصدر للفائز فاتورة إلكترونية.
          </p>
        </section>

        <aside className="panel h-fit self-start p-6 lg:-mt-24 lg:shadow-lift">
          <p className="text-sm text-muted">{phase === 'ended' ? 'سعر الترسية' : a.bidCount ? 'أعلى مزايدة' : 'السعر الافتتاحي'}</p>
          <div key={flash} className={`mt-1 flex items-baseline gap-2 rounded-lg ${flash ? 'bid-flash' : ''}`}>
            <span className="num font-extrabold text-5xl font-semibold">{num(a.finalPrice ?? a.currentPrice)}</span><span className="text-muted">ر.س</span>
          </div>
          {a.leaderLabel && phase !== 'ended' && <p className="mt-1 text-sm text-muted">المتصدر: {leading ? 'أنت' : a.leaderLabel}</p>}

          <div className="mt-4 rounded-lg bg-stone px-4 py-3">
            {phase === 'live' && <><span className="text-sm text-muted">الوقت المتبقي</span><Countdown to={a.endsAt} className="block font-extrabold text-2xl font-semibold" /></>}
            {phase === 'scheduled' && <><span className="text-sm text-muted">يبدأ بعد</span><Countdown to={a.startsAt} className="block font-extrabold text-2xl font-semibold" /></>}
            {phase === 'ended' && (
              <p className="font-semibold">
                {a.settled
                  ? a.wonByRequester
                    ? a.bidCount ? 'رسا الاسم على مقدم الطلب' : 'لم تُسجَّل مزايدات، فرسا الاسم على مقدم الطلب بمبلغ الضمان'
                    : `رسا الاسم على ${a.winnerName ? a.winnerName.split(' ')[0] + '…' : 'أعلى مزايد'}`
                  : 'انتهى المزاد، جارٍ الترسية'}
                {user && a.winnerId === user.id && <Link to="/dashboard/invoices" className="mt-1 block text-gold-deep underline underline-offset-4">عرض فاتورتك</Link>}
              </p>
            )}
          </div>

          {phase === 'live' && (
            user ? (
              <form className="mt-4" onSubmit={(e) => { e.preventDefault(); bid(Number(amount)) }}>
                {isRequester && <p className="mb-3 text-[13px] text-muted">أنت مقدم طلب هذا الاسم. إن لم يزايد أحد يرسو عليك بمبلغ الضمان.</p>}
                <div className="mb-2 flex gap-2">
                  {[1, 5, 10].map((k) => {
                    const v = a.currentPrice + k * a.minIncrement
                    return <button type="button" key={k} disabled={busy || !!leading} onClick={() => bid(v)} className="btn-ghost btn-sm flex-1 num">{num(v)}</button>
                  })}
                </div>
                <label className="label" htmlFor="amt">مبلغ آخر</label>
                <div className="flex gap-2">
                  <input id="amt" className="field num" inputMode="numeric" placeholder={`${min} أو أكثر`} value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))} />
                  <button className="btn-gold shrink-0" disabled={busy || !amount || !!leading}>زايد</button>
                </div>
                <p className="hint">{leading ? 'أنت صاحب أعلى مزايدة حاليًا.' : `أقل مزايدة ${sar(min)}. المزايدة في آخر ${RULES.extendMinutes} دقيقة تمدّد المزاد ${RULES.extendMinutes} دقيقة.`}</p>
              </form>
            ) : (
              <Link to="/login" state={{ from: loc.pathname }} className="btn-gold mt-4 w-full">سجّل الدخول للمزايدة</Link>
            )
          )}
        </aside>
      </div>

      <section className="mt-10">
        <h2 className="sec-title mb-5 !text-xl">سجل المزايدات</h2>
        {data.bids.length ? (
          <div className="panel overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>المزايد</th><th>المبلغ</th><th>الوقت</th></tr></thead>
              <tbody>
                {data.bids.map((b, i) => (
                  <tr key={b.id} className={i === 0 ? 'font-semibold' : ''}>
                    <td>{user?.id === b.userId ? 'أنت' : b.bidderLabel}</td>
                    <td className="num">{sar(b.amount)}</td>
                    <td className="text-muted">{time(b.createdAt)}، {new Date(b.createdAt).toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { day: 'numeric', month: 'short' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="panel px-5 py-6 text-muted">لا توجد مزايدات بعد. أول مزايدة تبدأ من {sar(min)}.</p>}
      </section>
    </div>
    </>
  )
}
