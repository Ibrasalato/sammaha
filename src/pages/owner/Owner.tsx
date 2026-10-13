import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Avatar, resizeToSquare } from '../../components/Avatar'
import { CertificateDoc } from '../../components/CertificateDoc'
import { InvoiceDoc } from '../../components/InvoiceDoc'
import { PayModal } from '../../components/PayModal'
import { Alert, Icon, SectionCard, StatTile, StepDots } from '../../components/dash'
import { Empty, ErrorBox, Loading, Modal, NameSeal, PageHead, PhasePill, RequestStatusPill, TypeBadge } from '../../components/ui'
import { phaseOf } from '../../lib/demoApi'
import { date, dateTime, humanLeft, num, sar } from '../../lib/format'
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
  const underReview = reqs.data?.filter((r) => r.status === 'under_review').length ?? 0
  const outbid = liveBids.filter((b) => b.auction.leaderId !== b.userId).length
  const todo = unpaid.length + pendingPay.length + outbid

  return (
    <div className="space-y-6">
      {/* Welcome band */}
      <section className="relative overflow-hidden rounded-xl bg-navy text-paper">
        <img src="./hero/camels-sky.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
        <div className="absolute inset-0 bg-gradient-to-l from-navy via-navy/85 to-navy/40" />
        <div className="relative flex flex-wrap items-center gap-6 p-6 sm:p-8">
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium text-gold-light">لوحة التحكم</p>
            <h1 className="mt-1 text-[28px] font-extrabold text-paper sm:text-[32px]">مرحبًا {user?.fullName.split(' ')[0] ?? ''}</h1>
            <p className="mt-1 text-paper/75">{todo ? `لديك ${todo === 1 ? 'إجراء واحد' : todo === 2 ? 'إجراءان' : `${todo} إجراءات`} بانتظارك.` : 'كل شيء على ما يرام، لا توجد إجراءات معلّقة.'}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link to="/dashboard/requests/new" className="btn-gold"><Icon name="plus" className="h-4 w-4" />طلب شعار جديد</Link>
              <Link to="/auctions" className="btn-on-dark">تصفّح المزادات</Link>
            </div>
          </div>
          <Link to="/dashboard/wallet" className="w-full rounded-lg bg-paper/10 p-5 backdrop-blur-sm transition-colors hover:bg-paper/15 sm:w-60">
            <span className="flex items-center gap-2 text-[13.5px] text-paper/70"><Icon name="wallet" className="h-4 w-4" />رصيد المحفظة</span>
            <span className="num mt-1 block text-[30px] font-extrabold">{wallet.data ? sar(wallet.data.balance) : '…'}</span>
            <span className="text-[13px] text-gold-light">شحن وكشف الحركات</span>
          </Link>
        </div>
      </section>

      {todo > 0 && (
        <div className="space-y-2">
          {unpaid.map((i) => (
            <Alert key={i.id} icon="receipt" to={`/dashboard/invoices/${i.id}`} aside={<span className="num font-extrabold text-ink">{sar(i.amountDue)}</span>}>
              رسا عليك اسم «{i.name}». سدّد الفاتورة {i.number} لإصدار شهادة التسجيل.
            </Alert>
          ))}
          {liveBids.filter((b) => b.auction.leaderId !== b.userId).map((b) => (
            <Alert key={b.id} icon="gavel" tone="red" to={`/auctions/${b.auctionId}`} aside={<span className="num font-extrabold text-ink">{sar(b.auction.currentPrice)}</span>}>
              تجاوز مزايد آخر مزايدتك على «{b.auction.name}».
            </Alert>
          ))}
          {pendingPay.map((r) => (
            <Alert key={r.id} icon="file" to={`/dashboard/requests/${r.id}`}>الطلب {r.number} لم يصل اللجنة بعد. سدّد الضمان لإكماله.</Alert>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon="file" tone="blue" label="تحت المراجعة" value={num(underReview)} hint="طلبات لدى اللجنة" to="/dashboard/requests" />
        <StatTile icon="gavel" tone="gold" label="مزايدات جارية" value={num(liveBids.length)} hint={outbid ? `تم تجاوزك في ${outbid}` : 'أنت المتصدر'} to="/dashboard/bids" />
        <StatTile icon="tag" tone="green" label="أسمائي" value={num(names.data?.length ?? 0)} hint="مسجلة باسمك" to="/dashboard/names" />
        <StatTile icon="receipt" tone="red" label="فواتير مستحقة" value={num(unpaid.length)} hint={unpaid.length ? sar(unpaid.reduce((s, i) => s + i.amountDue, 0)) : 'لا مستحقات'} to="/dashboard/invoices" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <SectionCard title="آخر الطلبات" icon="file" action={<Link to="/dashboard/requests" className="text-[14px] font-bold text-gold-deep hover:underline">الكل</Link>}>
          {reqs.data?.length ? (
            <ul className="divide-y divide-line/70">
              {reqs.data.slice(0, 5).map((r) => {
                const done = 1 + (r.depositPaid ? 1 : 0) + (r.reviewedAt ? 1 : 0) + (r.candidates.some((c) => c.auctionId) ? 1 : 0)
                return (
                  <li key={r.id}>
                    <Link to={`/dashboard/requests/${r.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 hover:bg-stone">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2"><span className="num font-bold">{r.number}</span><TypeBadge type={r.type} /></div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {r.candidates.map((c) => (
                            <span key={c.id} className={`rounded px-2 py-0.5 text-[13px] font-bold ${c.status === 'accepted' ? 'bg-[#E2F0E8] text-ok' : c.status === 'rejected' ? 'bg-bad/10 text-bad line-through' : 'bg-stone-deep text-ink'}`}>{c.name}</span>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5"><RequestStatusPill status={r.status} /><StepDots done={r.status === 'rejected' || r.status === 'cancelled' ? 0 : done} /></div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          ) : <div className="p-8 text-center text-muted">لا توجد طلبات بعد. <Link to="/dashboard/requests/new" className="font-bold text-gold-deep underline">قدّم أول طلب</Link></div>}
        </SectionCard>

        <SectionCard title="مزايداتي الجارية" icon="gavel" action={<Link to="/dashboard/bids" className="text-[14px] font-bold text-gold-deep hover:underline">الكل</Link>}>
          {liveBids.length ? (
            <ul className="divide-y divide-line/70">
              {liveBids.map((b) => {
                const leading = b.auction.leaderId === b.userId
                return (
                  <li key={b.id}>
                    <Link to={`/auctions/${b.auctionId}`} className="flex items-center gap-3 px-5 py-3 hover:bg-stone">
                      <NameSeal name={b.auction.name} type={b.auction.type} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className={`text-[14px] font-bold ${leading ? 'text-ok' : 'text-bad'}`}>{leading ? 'أنت المتصدر' : 'تجاوزك مزايد آخر'}</p>
                        <p className="text-[13px] text-muted">ينتهي خلال {humanLeft(Date.parse(b.auction.endsAt) - Date.now())}</p>
                      </div>
                      <span className="num text-[18px] font-extrabold">{num(b.auction.currentPrice)}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          ) : <div className="p-8 text-center text-muted">لا تزايد على أي اسم الآن. <Link to="/auctions" className="font-bold text-gold-deep underline">تصفّح المزادات</Link></div>}
        </SectionCard>
      </div>

      {!!names.data?.length && (
        <SectionCard title="أسمائي المسجلة" icon="tag" action={<Link to="/dashboard/names" className="text-[14px] font-bold text-gold-deep hover:underline">الشهادات</Link>}>
          <div className="flex flex-wrap gap-3 p-5">{names.data.map((n) => <NameSeal key={n.id} name={n.name} type={n.type} size="md" />)}</div>
        </SectionCard>
      )}
    </div>
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
        <p className="num font-extrabold text-4xl font-semibold">{data ? sar(data.balance) : '…'}</p>
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
                  <td className="font-extrabold">{i.name}</td>
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
        <Link to="/dashboard/invoices" className="text-sm font-medium text-muted hover:text-ink">الفواتير</Link>
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
                    <td><Link to={`/auctions/${b.auctionId}`} className="flex items-center gap-2 font-extrabold text-lg hover:text-gold-deep"><TypeBadge type={b.auction.type} />{b.auction.name}</Link></td>
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
  const invoices = useLoad(() => api.myInvoices(), [])
  const unpaidFor = (name: string) => invoices.data?.find((i) => i.name === name && i.status === 'unpaid')
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
              {unpaidFor(n.name)
                ? <Link to={`/dashboard/invoices/${unpaidFor(n.name)!.id}`} className="btn-gold btn-sm">سدّد الفاتورة لإصدار الشهادة</Link>
                : <Link to={`/dashboard/names/${n.id}/certificate`} className="btn-ghost btn-sm">شهادة التسجيل</Link>}
            </li>
          ))}
        </ul>
      ) : <Empty title="لا تملك أسماء بعد"><p className="text-muted">تظهر هنا الأسماء التي ترسو عليك في المزادات.</p></Empty>}
    </>
  )
}

export function CertificatePage() {
  const { id = '' } = useParams()
  const { data, loading } = useLoad(() => api.myNames().then((l) => l.find((n) => n.id === id) ?? null), [id])
  if (loading && !data) return <Loading />
  if (!data) return <ErrorBox text="الاسم غير موجود في أسمائك" />
  return (
    <>
      <style>{'@page { size: A4 landscape; margin: 0 }'}</style>
      <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
        <Link to="/dashboard/names" className="text-sm font-medium text-muted hover:text-navy">أسمائي</Link>
        <span className="ms-auto" />
        <button className="btn-primary" onClick={() => window.print()}>طباعة أو حفظ PDF</button>
      </div>
      <CertificateDoc r={data} />
    </>
  )
}

export function ProfilePage() {
  const { user, setUser, toast } = useApp()
  const [busy, setBusy] = useState(false)
  if (!user) return null
  async function save(p: { avatarUrl?: string | null; showAvatar: boolean }, msg: string) {
    setBusy(true)
    try { setUser(await api.updateMyProfile(p)); toast(msg) } catch (e) { toast((e as Error).message, 'bad') } finally { setBusy(false) }
  }
  return (
    <>
      <PageHead title="حسابي" sub="بياناتك وصورتك التي تظهر في قوائم ملاك الأسماء." />
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <SectionCard title="الصورة الشخصية" icon="users">
          <div className="flex flex-col items-center gap-4 p-6 text-center">
            <Avatar name={user.fullName} src={user.avatarUrl} size={120} ring />
            <label className={`btn-primary btn-sm cursor-pointer ${busy ? 'pointer-events-none opacity-50' : ''}`}>
              {user.avatarUrl ? 'تغيير الصورة' : 'رفع صورة'}
              <input type="file" accept="image/*" className="sr-only" onChange={async (e) => {
                const f = e.target.files?.[0]; e.target.value = ''
                if (!f) return
                if (f.size > 8 * 1024 * 1024) { toast('الصورة أكبر من 8 ميجابايت', 'bad'); return }
                await save({ avatarUrl: await resizeToSquare(f), showAvatar: true }, 'حُفظت صورتك')
              }} />
            </label>
            {user.avatarUrl && <button className="text-[14px] font-bold text-bad hover:underline" disabled={busy} onClick={() => save({ avatarUrl: null, showAvatar: false }, 'حُذفت صورتك')}>حذف الصورة</button>}
            <label className={`flex items-start gap-2 text-start text-[14.5px] ${user.avatarUrl ? '' : 'opacity-50'}`}>
              <input type="checkbox" className="mt-1.5" checked={!!user.showAvatar} disabled={!user.avatarUrl || busy}
                onChange={(e) => save({ showAvatar: e.target.checked }, e.target.checked ? 'ستظهر صورتك في القوائم العامة' : 'أُخفيت صورتك من القوائم العامة')} />
              <span>إظهار صورتي بجانب اسمي في قوائم «الأكثر ملكية» و«أعلى قيمة» على المنصة</span>
            </label>
          </div>
        </SectionCard>
        <SectionCard title="بيانات الحساب" icon="file">
          <dl className="grid gap-px bg-line/60 sm:grid-cols-2">
            {([['الاسم', user.fullName], ['رقم الجوال', user.phone], ['البريد الإلكتروني', user.email], ['رقم الهوية', user.nationalId || '—'], ['تاريخ التسجيل', date(user.createdAt)]] as [string, string][]).map(([l, v], i, all) => (
              <div key={l} className={`bg-paper px-5 py-4 ${i === all.length - 1 && all.length % 2 ? 'sm:col-span-2' : ''}`}><dt className="text-[13px] font-medium text-muted">{l}</dt><dd className="mt-0.5 font-bold" dir="auto">{v}</dd></div>
            ))}
          </dl>
          <p className="px-5 py-4 text-[14px] text-muted">لتعديل الاسم أو رقم الجوال تواصل مع فريق المنصة، لأنها مرتبطة بملكية الأسماء المسجلة.</p>
        </SectionCard>
      </div>
    </>
  )
}
