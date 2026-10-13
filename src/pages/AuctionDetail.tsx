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
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Link to="/auctions" className="text-sm font-semibold text-muted hover:text-ink">المزادات</Link>
      <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_380px]">
        <section className="panel flex flex-col items-center gap-6 p-6 text-center sm:flex-row sm:text-start">
          <NameSeal name={a.name} type={a.type} size="lg" />
          <div className="flex-1">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <TypeBadge type={a.type} /><PhasePill phase={phase} />
            </div>
            <h1 className="mt-3 text-4xl">{a.name}</h1>
            <p className="mt-1 text-muted">{TYPE_HINT[a.type]}</p>
            <dl className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <div><dt className="text-muted">السعر الافتتاحي</dt><dd className="num font-semibold">{sar(a.openingPrice)}</dd></div>
              <div><dt className="text-muted">أقل زيادة</dt><dd className="num font-semibold">{sar(a.minIncrement)}</dd></div>
              <div><dt className="text-muted">عدد المزايدات</dt><dd className="num font-semibold">{num(a.bidCount)}</dd></div>
              <div><dt className="text-muted">يبدأ</dt><dd className="font-semibold">{dateTime(a.startsAt)}</dd></div>
              <div><dt className="text-muted">ينتهي</dt><dd className="font-semibold">{dateTime(a.endsAt)}</dd></div>
            </dl>
          </div>
        </section>

        <aside className="panel p-5">
          <p className="text-sm text-muted">{phase === 'ended' ? 'سعر الترسية' : a.bidCount ? 'أعلى مزايدة' : 'السعر الافتتاحي'}</p>
          <div key={flash} className={`mt-1 flex items-baseline gap-2 rounded-lg ${flash ? 'bid-flash' : ''}`}>
            <span className="num font-kufi text-5xl font-semibold">{num(a.finalPrice ?? a.currentPrice)}</span><span className="text-muted">ر.س</span>
          </div>
          {a.leaderLabel && phase !== 'ended' && <p className="mt-1 text-sm text-muted">المتصدر: {leading ? 'أنت' : a.leaderLabel}</p>}

          <div className="mt-4 rounded-lg bg-stone px-4 py-3">
            {phase === 'live' && <><span className="text-sm text-muted">الوقت المتبقي</span><Countdown to={a.endsAt} className="block font-kufi text-2xl font-semibold" /></>}
            {phase === 'scheduled' && <><span className="text-sm text-muted">يبدأ بعد</span><Countdown to={a.startsAt} className="block font-kufi text-2xl font-semibold" /></>}
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

      <section className="mt-8">
        <h2 className="mb-3 text-xl">سجل المزايدات</h2>
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
  )
}
