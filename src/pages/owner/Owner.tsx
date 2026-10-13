import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { InvoiceDoc } from '../../components/InvoiceDoc'
import { PayModal } from '../../components/PayModal'
import { Countdown, Empty, ErrorBox, Loading, Modal, NameSeal, PageHead, PhasePill, RequestStatusPill, TypeBadge } from '../../components/ui'
import { phaseOf } from '../../lib/demoApi'
import { date, dateTime, num, sar } from '../../lib/format'
import { api, useApp, useLoad } from '../../lib/store'

export function DashHome() {
  const { user } = useApp()
  const wallet = useLoad(() => api.myWallet(), [])
  const reqs = useLoad(() => api.myRequests(), [])
  const bids = useLoad(() => api.myBids(), [], 15000)
  const invoices = useLoad(() => api.myInvoices(), [])
  const names = useLoad(() => api.myNames(), [])

  const unpaid = invoices.data?.filter((i) => i.status === 'unpaid') ?? []
  const liveBids = bids.data?.filter((b) => phaseOf(b.auction) === 'live') ?? []
  const pendingPay = reqs.data?.filter((r) => r.status === 'pending_payment') ?? []

  return (
    <>
      <PageHead title={`مرحبًا ${user?.fullName.split(' ')[0] ?? ''}`} action={<Link to="/dashboard/requests/new" className="btn-gold">طلب شعار جديد</Link>} />

      {(unpaid.length > 0 || pendingPay.length > 0) && (
        <div className="mb-5 space-y-2">
          {unpaid.map((i) => (
            <Link key={i.id} to={`/dashboard/invoices/${i.id}`} className="flex flex-wrap items-center gap-3 rounded-xl border border-gold bg-gold-soft p-4 hover:border-gold-deep">
              <span className="flex-1 font-semibold">رسا عليك اسم «{i.name}». الفاتورة {i.number} بانتظار السداد.</span>
              <span className="num font-kufi text-lg">{sar(i.amountDue)}</span>
            </Link>
          ))}
          {pendingPay.map((r) => (
            <Link key={r.id} to={`/dashboard/requests/${r.id}`} className="flex items-center gap-3 rounded-xl border border-gold bg-gold-soft p-4 hover:border-gold-deep">
              <span className="flex-1 font-semibold">الطلب {r.number} لم يصل اللجنة بعد. سدّد الضمان لإكماله.</span>
            </Link>
          ))}
        </div>
      )}

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="رصيد المحفظة" value={wallet.data ? sar(wallet.data.balance) : '…'} to="/dashboard/wallet" />
        <Stat label="طلبات تحت المراجعة" value={num(reqs.data?.filter((r) => r.status === 'under_review').length ?? 0)} to="/dashboard/requests" />
        <Stat label="مزايدات جارية" value={num(liveBids.length)} to="/dashboard/bids" />
        <Stat label="أسمائي" value={num(names.data?.length ?? 0)} to="/dashboard/names" />
      </dl>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-xl">آخر الطلبات</h2>
          {reqs.data?.length ? (
            <ul className="panel divide-y divide-line/70">
              {reqs.data.slice(0, 5).map((r) => (
                <li key={r.id}>
                  <Link to={`/dashboard/requests/${r.id}`} className="flex flex-wrap items-center gap-2 px-4 py-3 hover:bg-stone">
                    <span className="num font-semibold">{r.number}</span>
                    <TypeBadge type={r.type} />
                    <span className="truncate font-kufi text-muted">{r.candidates.map((c) => c.name).join('، ')}</span>
                    <span className="ms-auto"><RequestStatusPill status={r.status} /></span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <Empty title="لا توجد طلبات"><Link to="/dashboard/requests/new" className="btn-gold btn-sm">طلب شعار جديد</Link></Empty>}
        </section>
        <section>
          <h2 className="mb-3 text-xl">مزايداتي الجارية</h2>
          {liveBids.length ? (
            <ul className="panel divide-y divide-line/70">
              {liveBids.map((b) => {
                const leading = b.auction.leaderId === b.userId
                return (
                  <li key={b.id}>
                    <Link to={`/auctions/${b.auctionId}`} className="flex items-center gap-3 px-4 py-3 hover:bg-stone">
                      <NameSeal name={b.auction.name} type={b.auction.type} size="sm" />
                      <div className="flex-1">
                        <p className={`text-sm font-semibold ${leading ? 'text-ok' : 'text-bad'}`}>{leading ? 'أنت المتصدر' : 'تجاوزك مزايد آخر'}</p>
                        <Countdown to={b.auction.endsAt} prefix="ينتهي خلال" className="text-sm" />
                      </div>
                      <span className="num font-kufi text-lg">{num(b.auction.currentPrice)}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          ) : <Empty title="لا تزايد على أي اسم الآن"><Link to="/auctions" className="btn-ghost btn-sm">تصفّح المزادات</Link></Empty>}
        </section>
      </div>
    </>
  )
}

function Stat({ label, value, to }: { label: string; value: string; to: string }) {
  return (
    <Link to={to} className="panel block p-4 hover:border-ink">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="num mt-1 font-kufi text-2xl font-semibold">{value}</dd>
    </Link>
  )
}

const TX_LABEL = { topup: 'شحن', deposit: 'ضمان مزاد', refund: 'استرداد', invoice_payment: 'سداد فاتورة' }

export function WalletPage() {
  const { toast } = useApp()
  const { data, loading, reload } = useLoad(() => api.myWallet(), [])
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('100')
  return (
    <>
      <PageHead title="المحفظة" sub="يُعاد إليها ضمان الطلبات المرفوضة أو الملغاة، ويمكنك الدفع منها." action={<button className="btn-gold" onClick={() => setOpen(true)}>شحن المحفظة</button>} />
      <div className="panel mb-6 p-5">
        <p className="text-muted">الرصيد المتاح</p>
        <p className="num font-kufi text-4xl font-semibold">{data ? sar(data.balance) : '…'}</p>
      </div>
      {loading && !data ? <Loading /> : data?.txs.length ? (
        <div className="panel overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>العملية</th><th>البيان</th><th>التاريخ</th><th className="text-end">المبلغ</th></tr></thead>
            <tbody>
              {data.txs.map((t) => (
                <tr key={t.id}>
                  <td className="font-semibold">{TX_LABEL[t.kind]}</td>
                  <td className="text-muted">{t.note}</td>
                  <td className="whitespace-nowrap text-muted">{date(t.createdAt)}</td>
                  <td className={`num whitespace-nowrap text-end font-semibold ${t.amount > 0 ? 'text-ok' : ''}`}>{t.amount > 0 ? '+' : '−'}{num(Math.abs(t.amount))} ر.س</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Empty title="لا توجد عمليات بعد" />}
      <Modal open={open} onClose={() => setOpen(false)} title="شحن المحفظة">
        <label className="label" htmlFor="amt">المبلغ بالريال</label>
        <input id="amt" className="field num" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))} />
        <div className="mt-2 flex gap-2">{[50, 100, 500, 1000].map((v) => <button key={v} className="btn-ghost btn-sm flex-1 num" onClick={() => setAmount(String(v))}>{v}</button>)}</div>
        <button className="btn-gold mt-5 w-full" onClick={async () => {
          try { await api.topUp(Number(amount)); toast(`تم شحن ${sar(Number(amount))}`); setOpen(false); reload() } catch (e) { toast((e as Error).message, 'bad') }
        }}>ادفع {sar(Number(amount) || 0)} بالبطاقة</button>
      </Modal>
    </>
  )
}

export function MyInvoices() {
  const { data, loading } = useLoad(() => api.myInvoices(), [])
  return (
    <>
      <PageHead title="الفواتير" sub="فاتورة إلكترونية لكل اسم يرسو عليك." />
      {loading && !data ? <Loading /> : data?.length ? (
        <div className="panel overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>رقم الفاتورة</th><th>الاسم</th><th>التاريخ</th><th>الإجمالي</th><th>المستحق</th><th>الحالة</th></tr></thead>
            <tbody>
              {data.map((i) => (
                <tr key={i.id}>
                  <td><Link to={`/dashboard/invoices/${i.id}`} className="num font-semibold underline-offset-4 hover:underline">{i.number}</Link></td>
                  <td className="font-kufi">{i.name}</td>
                  <td className="text-muted">{date(i.issuedAt)}</td>
                  <td className="num">{sar(i.total)}</td>
                  <td className="num font-semibold">{sar(i.amountDue)}</td>
                  <td><span className={`pill ${i.status === 'paid' ? 'bg-ok/10 text-ok' : 'bg-gold-soft text-gold-deep'}`}>{i.status === 'paid' ? 'مدفوعة' : 'غير مدفوعة'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Empty title="لا توجد فواتير بعد" />}
    </>
  )
}

export function InvoicePage() {
  const { id = '' } = useParams()
  const { toast } = useApp()
  const { data, loading, reload } = useLoad(() => api.myInvoices().then((l) => l.find((i) => i.id === id) ?? null), [id])
  const [paying, setPaying] = useState(false)
  if (loading && !data) return <Loading />
  if (!data) return <ErrorBox text="الفاتورة غير موجودة" />
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
        <Link to="/dashboard/invoices" className="text-sm font-semibold text-muted hover:text-ink">الفواتير</Link>
        <span className="ms-auto" />
        {data.status === 'unpaid' && <button className="btn-gold" onClick={() => setPaying(true)}>سداد {sar(data.amountDue)}</button>}
        <button className="btn-ghost" onClick={() => window.print()}>طباعة أو حفظ PDF</button>
      </div>
      <InvoiceDoc inv={data} />
      {paying && <PayModal open title={`سداد الفاتورة ${data.number}`} amount={data.amountDue} onClose={() => setPaying(false)}
        onPay={async (m) => { try { await api.payInvoice(data.id, m); toast('تم سداد الفاتورة'); reload() } catch (e) { toast((e as Error).message, 'bad'); throw e } }} />}
    </>
  )
}

export function MyBids() {
  const { data, loading } = useLoad(() => api.myBids(), [], 15000)
  return (
    <>
      <PageHead title="مزايداتي" />
      {loading && !data ? <Loading /> : data?.length ? (
        <div className="panel overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>الاسم</th><th>الحالة</th><th>مزايدتي</th><th>السعر الحالي</th><th>النتيجة</th></tr></thead>
            <tbody>
              {data.map((b) => {
                const phase = phaseOf(b.auction)
                const leading = b.auction.leaderId === b.userId
                return (
                  <tr key={b.id}>
                    <td><Link to={`/auctions/${b.auctionId}`} className="flex items-center gap-2 font-kufi text-lg hover:text-gold-deep"><TypeBadge type={b.auction.type} />{b.auction.name}</Link></td>
                    <td><PhasePill phase={phase} /></td>
                    <td className="num">{sar(b.amount)}</td>
                    <td className="num font-semibold">{sar(b.auction.finalPrice ?? b.auction.currentPrice)}</td>
                    <td className={`font-semibold ${phase === 'ended' ? (b.auction.winnerId === b.userId ? 'text-ok' : 'text-muted') : leading ? 'text-ok' : 'text-bad'}`}>
                      {phase === 'ended' ? (b.auction.winnerId === b.userId ? 'رسا عليك' : 'لم يرسُ عليك') : leading ? 'متصدر' : 'تم تجاوزك'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : <Empty title="لم تزايد على أي اسم بعد"><Link to="/auctions" className="btn-ghost btn-sm">تصفّح المزادات</Link></Empty>}
    </>
  )
}

export function MyNames() {
  const { data, loading } = useLoad(() => api.myNames(), [])
  return (
    <>
      <PageHead title="أسمائي" sub="الأسماء المسجلة باسمك. اربط كل اسم بشريحة إلكترونية قبل المشاركة في المهرجانات." />
      {loading && !data ? <Loading /> : data?.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((n) => (
            <li key={n.id} className="panel flex flex-col items-center gap-3 p-5 text-center">
              <NameSeal name={n.name} type={n.type} size="md" />
              <TypeBadge type={n.type} />
              <p className="text-sm text-muted">منذ {dateTime(n.acquiredAt)}، بسعر {sar(n.price)}</p>
            </li>
          ))}
        </ul>
      ) : <Empty title="لا تملك أسماء بعد"><p className="text-muted">تظهر هنا الأسماء التي ترسو عليك في المزادات.</p></Empty>}
    </>
  )
}
