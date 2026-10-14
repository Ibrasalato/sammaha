import { AuctionGrid } from '../../components/AuctionCard'
import { typeOptions } from '../../lib/config'
import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Avatar, resizeToSquare } from '../../components/Avatar'
import { InvoiceDoc } from '../../components/InvoiceDoc'
import { NoResults, TableTools, useTableFilter } from '../../components/TableTools'
import { PayModal } from '../../components/PayModal'
import { Alert, Icon, SectionCard, StatTile, StepDots, WinAlert } from '../../components/dash'
import { Empty, ErrorBox, Loading, Modal, NameSeal, PageHead, PhasePill, RequestStatusPill, Segmented, TypeBadge } from '../../components/ui'
import type { NameCheck, ReservedName } from '../../lib/types'
import type { OtpChallenge } from '../../lib/api'
import { OtpForm } from '../../components/OtpForm'
import { phaseOf } from '../../lib/demoApi'
import { date, dateTime, humanLeft, num, sar } from '../../lib/format'
import { ClosedNotice, useClosed } from '../../components/SettingsUi'
import { api, useApp, useLoad } from '../../lib/store'
import { ProfileCompletion, ProfileSections } from './Profile'
import { BankAndRefunds } from './Bank'
import { tr } from '../../lib/i18n'
import { localizeServerText as L } from '../../lib/serverText'
import { Approx } from '../../components/Region'
import { InvoiceStatus } from '../../components/InvoiceStatus'

export function DashHome() {
  const { user, settings } = useApp()
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
      <section className="relative overflow-hidden rounded-xl bg-pine text-paper">
        <img src="./hero/camels-sky.webp" alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
        <div className="absolute inset-0 bg-gradient-to-l from-pine via-pine/85 to-pine/40" />
        <div className="relative flex flex-wrap items-center gap-6 p-6 sm:p-8">
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium text-gold-light">{tr('لوحة التحكم', 'Dashboard')}</p>
            <h1 className="mt-1 text-[28px] font-extrabold text-paper sm:text-[32px]">{tr('مرحبًا', 'Welcome,')} {user?.fullName.split(' ')[0] ?? ''}</h1>
            <p className="mt-1 text-paper/75">{todo ? tr(`لديك ${todo === 1 ? 'إجراء واحد' : todo === 2 ? 'إجراءان' : `${todo} إجراءات`} بانتظارك.`, `You have ${todo} pending ${todo === 1 ? 'action' : 'actions'}.`) : tr('كل شيء على ما يرام، لا توجد إجراءات معلّقة.', 'All good, nothing pending.')}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {settings.requestsOpen && <Link to="/dashboard/requests/new" className="btn-gold"><Icon name="plus" className="h-4 w-4" />{tr('طلب شعار جديد', 'New name request')}</Link>}
              <Link to="/dashboard/services" className="btn-on-dark"><Icon name="list" className="h-4 w-4" />{tr('الخدمات الإلكترونية', 'E-services')}</Link>
              <Link to="/auctions" className="btn-on-dark">{tr('تصفّح المزادات', 'Browse auctions')}</Link>
            </div>
          </div>
          <Link to="/dashboard/wallet" className="w-full rounded-lg bg-paper/10 p-5 backdrop-blur-sm transition-colors hover:bg-paper/15 sm:w-60">
            <span className="flex items-center gap-2 text-[13.5px] text-paper/70"><Icon name="wallet" className="h-4 w-4" />{tr('رصيد المحفظة', 'Wallet balance')}</span>
            <span className="num mt-1 block text-[30px] font-extrabold">{wallet.data ? sar(wallet.data.balance) : '…'}</span>
            <span className="text-[13px] text-gold-light">{tr('شحن وكشف الحركات', 'Top up and statement')}</span>
          </Link>
        </div>
      </section>

      <ProfileCompletion />

      {todo > 0 && (
        <div className="space-y-2">
          {unpaid.map((i) => (
            <WinAlert key={i.id} name={i.name} to={`/dashboard/invoices/${i.id}`}
              note={<>{tr('سدّد الفاتورة', 'Pay invoice')} <span className="num" dir="ltr">{i.number}</span> {tr('لإصدار شهادة التسجيل باسمك.', 'to issue the registration certificate in your name.')}</>}
              aside={<span className="btn-gold btn-sm hidden sm:inline-flex">{tr('سداد', 'Pay')} <span className="num">{sar(i.amountDue)}</span></span>} />
          ))}
          {liveBids.filter((b) => b.auction.leaderId !== b.userId).map((b) => (
            <Alert key={b.id} icon="gavel" tone="red" to={`/auctions/${b.auctionId}`} aside={<span className="num font-extrabold text-ink">{sar(b.auction.currentPrice)}</span>}>
              {tr(`تجاوز مزايد آخر مزايدتك على «${b.auction.name}».`, `Another bidder outbid you on «${b.auction.name}».`)}
            </Alert>
          ))}
          {pendingPay.map((r) => (
            <Alert key={r.id} icon="file" to={`/dashboard/requests/${r.id}`}>{tr(`الطلب ${r.number} لم يصل اللجنة بعد. سدّد الضمان لإكماله.`, `Request ${r.number} has not reached the committee yet. Pay the guarantee to complete it.`)}</Alert>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon="file" tone="blue" label={tr('تحت المراجعة', 'Under review')} value={num(underReview)} hint={tr('طلبات لدى اللجنة', 'Requests with the committee')} to="/dashboard/requests" />
        <StatTile icon="gavel" tone="gold" label={tr('مزايدات جارية', 'Live bids')} value={num(liveBids.length)} hint={outbid ? tr(`تم تجاوزك في ${outbid}`, `Outbid on ${outbid}`) : tr('أنت المتصدر', 'You are leading')} to="/dashboard/bids" />
        <StatTile icon="tag" tone="green" label={tr('أسمائي', 'My names')} value={num(names.data?.length ?? 0)} hint={tr('مسجلة باسمك', 'Registered to you')} to="/dashboard/names" />
        <StatTile icon="receipt" tone="red" label={tr('فواتير مستحقة', 'Invoices due')} value={num(unpaid.length)} hint={unpaid.length ? sar(unpaid.reduce((s, i) => s + i.amountDue, 0)) : tr('لا مستحقات', 'Nothing due')} to="/dashboard/invoices" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <SectionCard title={tr('آخر الطلبات', 'Recent requests')} icon="file" action={<Link to="/dashboard/requests" className="text-[14px] font-bold text-gold-deep hover:underline">{tr('الكل', 'All')}</Link>}>
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
                            <span key={c.id} className={`rounded px-2 py-0.5 text-[13px] font-bold ${c.status === 'accepted' ? 'bg-[#E2F0E8] text-ok' : c.status === 'rejected' ? 'bg-bad/10 text-bad line-through' : c.status === 'withdrawn' ? 'bg-stone-deep text-muted line-through' : 'bg-stone-deep text-ink'}`}>{c.name}</span>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5"><RequestStatusPill status={r.status} /><StepDots done={r.status === 'rejected' || r.status === 'cancelled' ? 0 : done} /></div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          ) : <div className="p-8 text-center text-muted">{tr('لا توجد طلبات بعد.', 'No requests yet.')} <Link to="/dashboard/requests/new" className="font-bold text-gold-deep underline">{tr('قدّم أول طلب', 'Submit your first request')}</Link></div>}
        </SectionCard>

        <SectionCard title={tr('مزايداتي الجارية', 'My live bids')} icon="gavel" action={<Link to="/dashboard/bids" className="text-[14px] font-bold text-gold-deep hover:underline">{tr('الكل', 'All')}</Link>}>
          {liveBids.length ? (
            <ul className="divide-y divide-line/70">
              {liveBids.map((b) => {
                const leading = b.auction.leaderId === b.userId
                return (
                  <li key={b.id}>
                    <Link to={`/auctions/${b.auctionId}`} className="flex items-center gap-3 px-5 py-3 hover:bg-stone">
                      <NameSeal name={b.auction.name} type={b.auction.type} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className={`text-[14px] font-bold ${leading ? 'text-ok' : 'text-bad'}`}>{leading ? tr('أنت المتصدر', 'You are leading') : tr('تجاوزك مزايد آخر', 'You were outbid')}</p>
                        <p className="text-[13px] text-muted">{tr('ينتهي خلال', 'Ends in')} {humanLeft(Date.parse(b.auction.endsAt) - Date.now())}</p>
                      </div>
                      <span className="num text-[18px] font-extrabold">{num(b.auction.currentPrice)}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          ) : <div className="p-8 text-center text-muted">{tr('لا تزايد على أي اسم الآن.', 'You are not bidding on any name right now.')} <Link to="/auctions" className="font-bold text-gold-deep underline">{tr('تصفّح المزادات', 'Browse auctions')}</Link></div>}
        </SectionCard>
      </div>

      {!!names.data?.length && (
        <SectionCard title={tr('أسمائي المسجلة', 'My registered names')} icon="tag" action={<Link to="/dashboard/names" className="text-[14px] font-bold text-gold-deep hover:underline">{tr('الشهادات', 'Certificates')}</Link>}>
          <div className="flex flex-wrap gap-3 p-5">{names.data.map((n) => <NameSeal key={n.id} name={n.name} type={n.type} size="md" />)}</div>
        </SectionCard>
      )}
    </div>
  )
}

const txLabels = () => ({ topup: tr('شحن', 'Top up'), deposit: tr('ضمان مزاد', 'Auction guarantee'), refund: tr('استرداد', 'Refund'), invoice_payment: tr('سداد فاتورة', 'Invoice payment'), service_fee: tr('رسوم استثمار الاسم', 'Name investment fee'), investment_payout: tr('عائد استثمار الاسم', 'Name investment payout'), bid_deposit: tr('ضمان دخول مزاد', 'Participation guarantee'), sale_payout: tr('ثمن بيع اسم', 'Name sale proceeds'), purchase: tr('شراء اسم', 'Name purchase'), withdrawal: tr('استرداد إلى البنك', 'Refund to bank'), adjustment: tr('تسوية', 'Adjustment') })

export function WalletPage() {
  const { toast, user } = useApp()
  const { data, loading, reload } = useLoad(() => api.myWallet(), [])
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('100')
  const TX_LABEL = txLabels()
  const tf = useTableFilter(data?.txs, {
    fields: (t) => [TX_LABEL[t.kind], t.note, t.amount, date(t.createdAt)],
    filters: [
      { key: 'kind', label: tr('العملية', 'Transaction'), options: [['', tr('الكل', 'All')], ...Object.entries(TX_LABEL)], test: (t, v) => t.kind === v },
      { key: 'dir', label: tr('الاتجاه', 'Direction'), options: [['', tr('الكل', 'All')], ['in', tr('إيداع', 'Credit')], ['out', tr('خصم', 'Debit')]], test: (t, v) => (v === 'in' ? t.amount > 0 : t.amount < 0) },
    ],
  })
  return (
    <>
      <PageHead title={tr('المحفظة', 'Wallet')} sub={tr('يُعاد إليها ضمان الطلبات المرفوضة أو الملغاة. رصيدها لسداد الضمانات فقط، ويمكنك طلب استرداده إلى حسابك البنكي.', 'Guarantees for rejected or cancelled requests are returned here. The balance pays guarantees only, and you can request a refund to your bank account.')} action={<button className="btn-gold" onClick={() => setOpen(true)}>{tr('شحن المحفظة', 'Top up wallet')}</button>} />
      <div className="panel mb-6 p-5">
        <p className="text-muted">{tr('الرصيد المتاح', 'Available balance')}</p>
        <p className="num font-extrabold text-4xl font-semibold">{data ? sar(data.balance) : '…'}</p>
        {data && <Approx v={data.balance} className="text-[14px]" />}
      </div>
      {loading && !data ? <Loading /> : data?.txs.length ? (
        <>
        <TableTools t={tf} placeholder={tr('بحث في البيان أو المبلغ', 'Search description or amount')} />
        <div className="panel overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>{tr('العملية', 'Transaction')}</th><th>{tr('البيان', 'Description')}</th><th>{tr('التاريخ', 'Date')}</th><th className="text-end">{tr('المبلغ', 'Amount')}</th></tr></thead>
            <tbody>
              {!tf.list.length && <NoResults cols={4} onReset={tf.reset} />}
              {tf.list.map((t) => (
                <tr key={t.id}>
                  <td className="font-semibold">{TX_LABEL[t.kind]}</td>
                  <td className="text-muted">{L(t.note ?? '')}</td>
                  <td className="whitespace-nowrap text-muted">{date(t.createdAt)}</td>
                  <td className={`num whitespace-nowrap text-end font-semibold ${t.amount > 0 ? 'text-ok' : ''}`}>{t.amount > 0 ? '+' : '−'}{num(Math.abs(t.amount))} {tr('ر.س', 'SAR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      ) : <Empty title={tr('لا توجد عمليات بعد', 'No transactions yet')} />}
      <Modal open={open} onClose={() => setOpen(false)} title={tr('شحن المحفظة', 'Top up wallet')}>
        <label className="label" htmlFor="amt">{tr('المبلغ بالريال', 'Amount (SAR)')}</label>
        <input id="amt" className="field num" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))} />
        <div className="mt-2 flex gap-2">{[50, 100, 500, 1000].map((v) => <button key={v} className="btn-ghost btn-sm flex-1 num" onClick={() => setAmount(String(v))}>{v}</button>)}</div>
        <button className="btn-gold mt-5 w-full" onClick={async () => {
          try { await api.topUp(Number(amount)); toast(tr(`تم شحن ${sar(Number(amount))}`, `Topped up ${sar(Number(amount))}`)); setOpen(false); reload() } catch (e) { toast((e as Error).message, 'bad') }
        }}>{tr(`ادفع ${sar(Number(amount) || 0)} بالبطاقة`, `Pay ${sar(Number(amount) || 0)} by card`)}</button>
      </Modal>
      {user?.acting ? <p className="mt-8 rounded-lg bg-stone-deep/60 p-4 text-[14px] text-muted">{tr('الحساب البنكي والاسترداد لصاحب الحساب فقط.', 'The bank account and refunds are for the account holder only.')}</p> : <BankAndRefunds balance={data?.balance ?? 0} onChange={reload} />}
    </>
  )
}

export function MyInvoices() {
  const { data, loading } = useLoad(() => api.myInvoices(), [])
  const tf = useTableFilter(data, {
    fields: (i) => [i.number, i.name, i.total, date(i.issuedAt)],
    filters: [
      { key: 'status', label: tr('الحالة', 'Status'), options: [['', tr('الكل', 'All')], ['unpaid', tr('غير مدفوعة', 'Unpaid')], ['paid', tr('مدفوعة', 'Paid')]], test: (i, v) => i.status === v },
      { key: 'type', label: tr('النوع', 'Type'), options: typeOptions('', tr('الكل', 'All')), test: (i, v) => i.type === v },
    ],
  })
  return (
    <>
      <PageHead title={tr('الفواتير', 'Invoices')} sub={tr('فاتورة إلكترونية لكل اسم يرسو عليك.', 'An e-invoice for every name awarded to you.')} />
      {loading && !data ? <Loading /> : data?.length ? (
        <>
        <TableTools t={tf} placeholder={tr('بحث برقم الفاتورة أو الاسم', 'Search by invoice number or name')} />
        <div className="panel overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>{tr('رقم الفاتورة', 'Invoice no.')}</th><th>{tr('الاسم', 'Name')}</th><th>{tr('التاريخ', 'Date')}</th><th>{tr('الإجمالي', 'Total')}</th><th>{tr('المستحق', 'Due')}</th><th>{tr('الحالة', 'Status')}</th></tr></thead>
            <tbody>
              {!tf.list.length && <NoResults cols={6} onReset={tf.reset} />}
              {tf.list.map((i) => (
                <tr key={i.id}>
                  <td><Link to={`/dashboard/invoices/${i.id}`} className="num font-semibold underline-offset-4 hover:underline">{i.number}</Link></td>
                  <td className="font-extrabold">{i.name}</td>
                  <td className="text-muted">{date(i.issuedAt)}</td>
                  <td className="num">{sar(i.total)}</td>
                  <td className="num font-semibold">{sar(i.amountDue)}</td>
                  <td><InvoiceStatus i={i} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      ) : <Empty title={tr('لا توجد فواتير بعد', 'No invoices yet')} />}
    </>
  )
}

export function InvoicePage() {
  const { id = '' } = useParams()
  const { toast } = useApp()
  const { data, loading, reload } = useLoad(() => api.myInvoices().then((l) => l.find((i) => i.id === id) ?? null), [id])
  const [paying, setPaying] = useState(false)
  if (loading && !data) return <Loading />
  if (!data) return <ErrorBox text={tr('الفاتورة غير موجودة', 'Invoice not found')} />
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
        <Link to="/dashboard/invoices" className="text-sm font-medium text-muted hover:text-ink">{tr('الفواتير', 'Invoices')}</Link>
        <span className="ms-auto" />
        {data.status === 'unpaid' && data.dueAt && <span className="text-[13.5px] font-semibold text-bad">{tr('سدّد قبل', 'Pay before')} {dateTime(data.dueAt)} {tr('وإلا يُلغى فوزك ويُخصم الضمان', 'or the win is cancelled and the guarantee forfeited')}</span>}
        {data.status === 'cancelled' && <span className="pill bg-bad/10 text-bad">{tr('أُلغيت لانتهاء مهلة السداد، وآل الاسم إلى المنظمة الدولية للإبل', 'Cancelled: the deadline passed and the name passed to the International Camel Organization')}</span>}
        {data.status === 'unpaid' && <button className="btn-gold" onClick={() => setPaying(true)}>{tr('سداد', 'Pay')} {sar(data.amountDue)}</button>}
        <button className="btn-ghost" onClick={() => window.print()}>{tr('طباعة أو حفظ PDF', 'Print or save PDF')}</button>
      </div>
      <InvoiceDoc inv={data} />
      {paying && <PayModal open cardOnly title={tr(`سداد الفاتورة ${data.number}`, `Pay invoice ${data.number}`)} amount={data.amountDue} onClose={() => setPaying(false)}
        onPay={async (m) => { try { await api.payInvoice(data.id, m); toast(tr('تم سداد الفاتورة', 'Invoice paid')); reload() } catch (e) { toast((e as Error).message, 'bad'); throw e } }} />}
    </>
  )
}

export function MyBids() {
  const { data, loading } = useLoad(() => api.myBids(), [], 15000)
  const result = (b: NonNullable<typeof data>[number]) => {
    if (phaseOf(b.auction) === 'ended') return b.auction.winnerId === b.userId ? 'won' : 'lost'
    return b.auction.leaderId === b.userId ? 'leading' : 'outbid'
  }
  const tf = useTableFilter(data, {
    fields: (b) => [b.auction.name, b.amount, b.auction.currentPrice],
    filters: [
      { key: 'phase', label: tr('الحالة', 'Status'), options: [['', tr('الكل', 'All')], ['live', tr('جارٍ الآن', 'Live now')], ['scheduled', tr('قادم', 'Upcoming')], ['ended', tr('منتهٍ', 'Ended')]], test: (b, v) => phaseOf(b.auction) === v },
      { key: 'result', label: tr('النتيجة', 'Result'), options: [['', tr('الكل', 'All')], ['leading', tr('متصدر', 'Leading')], ['outbid', tr('تم تجاوزك', 'Outbid')], ['won', tr('فزت بالمزاد', 'Won')], ['lost', tr('لم يرسُ عليك', 'Not won')]], test: (b, v) => result(b) === v },
      { key: 'type', label: tr('النوع', 'Type'), options: typeOptions('', tr('الكل', 'All')), test: (b, v) => b.auction.type === v },
    ],
  })
  return (
    <>
      <PageHead title={tr('مزايداتي', 'My bids')} />
      {loading && !data ? <Loading /> : data?.length ? (
        <>
        <TableTools t={tf} placeholder={tr('بحث باسم الشعار أو المبلغ', 'Search by name or amount')} />
        <div className="panel overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>{tr('الاسم', 'Name')}</th><th>{tr('الحالة', 'Status')}</th><th>{tr('مزايدتي', 'My bid')}</th><th>{tr('السعر الحالي', 'Current price')}</th><th>{tr('النتيجة', 'Result')}</th></tr></thead>
            <tbody>
              {!tf.list.length && <NoResults cols={5} onReset={tf.reset} />}
              {tf.list.map((b) => {
                const phase = phaseOf(b.auction)
                const leading = b.auction.leaderId === b.userId
                return (
                  <tr key={b.id}>
                    <td><Link to={`/auctions/${b.auctionId}`} className="flex items-center gap-2 font-extrabold text-lg hover:text-gold-deep"><TypeBadge type={b.auction.type} />{b.auction.name}</Link></td>
                    <td><PhasePill phase={phase} /></td>
                    <td className="num">{sar(b.amount)}</td>
                    <td className="num font-semibold">{sar(b.auction.finalPrice ?? b.auction.currentPrice)}</td>
                    <td className={`font-semibold ${phase === 'ended' ? (b.auction.winnerId === b.userId ? 'text-ok' : 'text-muted') : leading ? 'text-ok' : 'text-bad'}`}>
                      {phase === 'ended' ? (b.auction.winnerId === b.userId ? <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-soft px-2.5 py-0.5 text-gold-deep"><Icon name="trophy" className="h-4 w-4" />{tr('مبارك، فزت بالمزاد', 'Congratulations, you won')}</span> : tr('لم يرسُ عليك', 'Not won')) : leading ? tr('متصدر', 'Leading') : tr('تم تجاوزك', 'Outbid')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        </>
      ) : <Empty title={tr('لم تزايد على أي اسم بعد', 'You have not bid on any name yet')}><Link to="/auctions" className="btn-ghost btn-sm">{tr('تصفّح المزادات', 'Browse auctions')}</Link></Empty>}
    </>
  )
}

/** Compound name on top of an owned name: the committee reviews it, approval registers it directly (no auction). */
function CompoundName({ base, onClose }: { base: ReservedName; onClose: () => void }) {
  const nav = useNavigate()
  const { toast } = useApp()
  const [extra, setExtra] = useState('')
  const [pos, setPos] = useState<'after' | 'before'>('after')
  const [check, setCheck] = useState<NameCheck | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const full = extra.trim() ? (pos === 'after' ? `${base.name} ${extra.trim()}` : `${extra.trim()} ${base.name}`) : ''
  useEffect(() => {
    if (!full) { setCheck(null); return }
    const t = setTimeout(() => { api.checkNames([full], base.type).then((c) => setCheck(c[0])).catch(() => setCheck(null)) }, 350)
    return () => clearTimeout(t)
  }, [full, base.type])
  async function submit() {
    setBusy(true); setErr('')
    try { const r = await api.createCompoundRequest(base.id, full); toast(r.status === 'pending_payment' ? tr('أُنشئ الطلب، سدّد الرسوم ليصل إلى لجنة الاعتماد', 'Request created; pay the fee to send it to the Accreditation Committee') : tr('أُرسل طلب الاسم المركب إلى لجنة الاعتماد', 'Compound name request sent to the Accreditation Committee')); nav(`/dashboard/requests/${r.id}`) } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  const closed = useClosed('compound')
  const blocked = check?.verdict === 'exact' || check?.verdict === 'invalid' || !!closed
  return (
    <Modal open onClose={onClose} title={tr(`اسم مركب لـ«${base.name}»`, `Compound name for «${base.name}»`)}>
      <div className="space-y-4">
        <ClosedNotice intake="compound" />
        {err && <ErrorBox text={err} />}
        <p className="text-[15px] text-muted">{tr('أضف كلمة إلى اسمك المسجل. يُراجع الطلب من لجنة الاعتماد، وإذا اعتُمد يُسجّل باسمك مباشرة', 'Add a word to your registered name. The Accreditation Committee reviews the request, and if approved it is registered to you directly')} <b className="text-ink">{tr('دون مزاد ودون ضمان', 'with no auction and no guarantee')}</b>.</p>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div><label className="label" htmlFor="cx">{tr('الكلمة المضافة', 'Added word')}</label><input id="cx" className="field" maxLength={25} placeholder={tr('مثال: الشمال', 'e.g. الشمال')} value={extra} onChange={(e) => setExtra(e.target.value)} autoFocus /></div>
          <div><span className="label">{tr('موضعها', 'Position')}</span><Segmented value={pos} onChange={setPos} options={[['after', tr('بعد الاسم', 'After the name')], ['before', tr('قبل الاسم', 'Before the name')]]} /></div>
        </div>
        <div className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-lg bg-stone p-4">
          {full ? <NameSeal name={full} type={base.type} size="md" /> : <span className="text-muted">{tr('تظهر هنا معاينة الاسم المركب', 'The compound name preview appears here')}</span>}
          {check && (
            <span className={`text-[14px] font-bold ${check.verdict === 'available' ? 'text-ok' : check.verdict === 'similar' ? 'text-gold-deep' : 'text-bad'}`}>
              {check.verdict === 'available' ? tr('متاح مبدئيًا', 'Provisionally available') : check.verdict === 'similar' ? tr('يشبه أسماء موجودة، وتدرسه اللجنة', 'Similar to existing names; the committee will review it') : check.verdict === 'exact' ? tr('مسجل أو مطلوب مسبقًا', 'Already registered or requested') : L(check.message ?? '')}
            </span>
          )}
        </div>
        <button className="btn-primary w-full" disabled={!full || blocked || busy} onClick={submit}>{busy ? tr('جارٍ الإرسال…', 'Sending…') : tr('إرسال للجنة الاعتماد', 'Send to the Accreditation Committee')}</button>
      </div>
    </Modal>
  )
}

/** the mark's logo: the approved one, or the owner's upload waiting for the committee */
function MarkLogo({ n, onChange }: { n: ReservedName; onChange: () => void }) {
  const { toast } = useApp()
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    let on = true
    if (n.logoStatus && n.logoStatus !== 'approved') void api.myLogo(n.id).then((u) => { if (on) setPreview(u) })
    else setPreview(null)
    return () => { on = false }
  }, [n.id, n.logoStatus])
  const src = n.logo ? api.logoSrc(n) : preview
  async function pick(f: File | undefined) {
    if (!f) return
    if (f.size > 2 * 1024 * 1024) { toast(tr('حجم الصورة أكبر من 2 ميجابايت', 'The image is larger than 2 MB'), 'bad'); return }
    setBusy(true)
    try {
      const b64 = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] ?? ''); r.onerror = rej; r.readAsDataURL(f) })
      await api.uploadLogo(n.id, f.name, b64)
      toast(tr('رُفع اللوجو، ويظهر بعد اعتماد اللجنة', 'Logo uploaded; it shows once the committee approves it'))
      onChange()
    } catch (e) { toast((e as Error).message, 'bad') } finally { setBusy(false); if (input.current) input.current.value = '' }
  }
  async function remove() {
    if (!confirm(tr('حذف لوجو هذا الشعار؟', 'Delete this mark\'s logo?'))) return
    try { await api.deleteLogo(n.id); onChange() } catch (e) { toast((e as Error).message, 'bad') }
  }
  const status = n.logo ? null : n.logoStatus === 'pending' ? [tr('اللوجو بانتظار الاعتماد', 'Logo awaiting approval'), 'bg-gold-soft text-gold-deep'] : n.logoStatus === 'rejected' ? [tr('لم يُعتمد اللوجو، ارفع غيره', 'Logo not approved, upload another'), 'bg-bad/10 text-bad'] : null
  return (
    <div className="flex w-full flex-col items-center gap-2 border-t border-line pt-3">
      {src
        ? <img src={src} alt={tr(`لوجو ${n.name}`, `${n.name} logo`)} className={`h-20 w-20 rounded-lg border border-line bg-paper object-contain p-1 ${n.logo ? '' : 'opacity-70'}`} />
        : <span className="text-[13px] text-muted">{tr('لا يوجد لوجو للشعار', 'No logo yet')}</span>}
      {status && <span className={`pill ${status[1]}`}>{status[0]}</span>}
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
      <div className="flex gap-2">
        <button className="btn-ghost btn-sm" disabled={busy} onClick={() => input.current?.click()}>{busy ? tr('جارٍ الرفع…', 'Uploading…') : src ? tr('تغيير اللوجو', 'Change logo') : tr('رفع لوجو', 'Upload logo')}</button>
        {(n.logo || n.logoStatus) && <button className="btn-ghost btn-sm text-bad" onClick={() => void remove()}>{tr('حذف', 'Delete')}</button>}
      </div>
      <span className="text-[12px] text-muted">{tr('PNG أو JPG أو WebP حتى 2 ميجابايت', 'PNG, JPG or WebP up to 2 MB')}</span>
    </div>
  )
}

export function MyNames() {
  const { data, loading, reload } = useLoad(() => api.myNames(), [])
  const [compoundFor, setCompoundFor] = useState<ReservedName | null>(null)
  const invoices = useLoad(() => api.myInvoices(), [])
  const unpaidFor = (name: string) => invoices.data?.find((i) => i.name === name && i.status === 'unpaid')
  return (
    <>
      <PageHead title={tr('أسمائي', 'My names')} sub={tr('الأسماء المسجلة باسمك. اربط كل اسم بشريحة إلكترونية قبل المشاركة في المهرجانات.', 'Names registered to you. Link each name to an electronic microchip before taking part in festivals.')} />
      {loading && !data ? <Loading /> : data?.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((n) => (
            <li key={n.id} className="panel flex flex-col items-center gap-3 p-5 text-center">
              <NameSeal name={n.name} type={n.type} size="md" latin={n.latin} />
              {n.latin && <span className="-mt-1 text-[13px] font-semibold text-muted" dir="ltr">{n.latin}</span>}
              <TypeBadge type={n.type} />
              {n.source === 'compound'
                ? <p className="text-sm text-muted">{tr(`اسم مركب من «${n.baseName}»، اعتُمد ${dateTime(n.acquiredAt)}`, `Compound name from «${n.baseName}», approved ${dateTime(n.acquiredAt)}`)}</p>
                : <p className="text-sm text-muted">{tr(`منذ ${dateTime(n.acquiredAt)}، بسعر ${sar(n.price)}`, `Since ${dateTime(n.acquiredAt)}, for ${sar(n.price)}`)}</p>}
              {unpaidFor(n.name)
                ? <Link to={`/dashboard/invoices/${unpaidFor(n.name)!.id}`} className="btn-gold btn-sm">{tr('سدّد الفاتورة لإصدار الشهادة', 'Pay the invoice to issue the certificate')}</Link>
                : <div className="flex flex-wrap justify-center gap-2">
                    <Link to={`/dashboard/certificates?mark=${n.id}`} className="btn-ghost btn-sm">{tr('إصدار شهادة', 'Issue certificate')}</Link>
                    {n.source !== 'compound' && <button className="btn-ghost btn-sm border-gold/60 text-gold-deep" onClick={() => setCompoundFor(n)}>{tr('طلب اسم مركب', 'Request a compound name')}</button>}
                    {n.listingId
                      ? <Link to="/dashboard/sell" className="pill bg-gold-soft text-gold-deep">{tr('معروض للبيع', 'Listed for sale')}</Link>
                      : <>
                          <Link to={`/dashboard/sell?name=${n.id}`} className="btn-ghost btn-sm border-pine/40 text-pine">{tr('بيع الاسم', 'Sell name')}</Link>
                          <Link to={`/dashboard/transfers?name=${n.id}`} className="btn-ghost btn-sm">{tr('نقل الملكية', 'Transfer ownership')}</Link>
                        </>}
                  </div>}
              <MarkLogo n={n} onChange={reload} />
            </li>
          ))}
        </ul>
      ) : <Empty title={tr('لا تملك أسماء بعد', 'You do not own any names yet')}><p className="text-muted">{tr('تظهر هنا الأسماء التي ترسو عليك في المزادات.', 'Names awarded to you in auctions appear here.')}</p></Empty>}
      {compoundFor && <CompoundName base={compoundFor} onClose={() => setCompoundFor(null)} />}
    </>
  )
}

/** the old per-name certificate link: certificates are now issued (signed, bilingual) from «شهاداتي» */
export function CertificatePage() {
  const { id = '' } = useParams()
  return <Navigate to={`/dashboard/certificates?mark=${id}`} replace />
}

/** Change the mobile number or the email: a one-time code goes to the NEW address and must be confirmed. */
function ChangeContact({ kind, onClose }: { kind: 'phone' | 'email'; onClose: () => void }) {
  const { user, setUser, toast } = useApp()
  const [value, setValue] = useState('')
  const [otp, setOtp] = useState<OtpChallenge | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  if (!user) return null
  const phone = kind === 'phone'
  async function send(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErr('')
    try { setOtp(phone ? await api.requestPhoneChange(value) : await api.requestEmailChange(value)) } catch (x) { setErr((x as Error).message) } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title={phone ? tr('تغيير رقم الجوال', 'Change mobile number') : tr('تغيير البريد الإلكتروني', 'Change email')}>
      {otp ? (
        <OtpForm c={otp} title={phone ? tr('أكّد الرقم الجديد', 'Confirm the new number') : tr('أكّد البريد الجديد', 'Confirm the new email')} onBack={() => setOtp(null)}
          onResend={async () => { const n = phone ? await api.requestPhoneChange(value) : await api.requestEmailChange(value); setOtp(n); return n }}
          onVerify={async (code) => {
            const u = phone ? await api.confirmPhoneChange(otp.challenge, code) : await api.confirmEmailChange(otp.challenge, code)
            setUser(u); toast(phone ? tr(`تم تغيير رقم الجوال إلى ${u.phone}`, `Mobile number changed to ${u.phone}`) : tr(`تم تغيير البريد إلى ${u.email}`, `Email changed to ${u.email}`)); onClose()
          }} />
      ) : (
        <form onSubmit={send} className="space-y-4">
          {err && <ErrorBox text={err} />}
          <p className="text-[15px] text-muted">{phone ? tr('رقمك الحالي', 'Your current number is') : tr('بريدك الحالي', 'Your current email is')} <b className="num text-ink" dir="ltr">{phone ? user.phone : user.email}</b>. {phone ? tr('سنرسل رمز تحقق إلى الرقم الجديد للتأكد أنه لك.', 'We will send a verification code to the new number to confirm it is yours.') : tr('سنرسل رمز تحقق إلى البريد الجديد للتأكد أنه لك.', 'We will send a verification code to the new email to confirm it is yours.')}</p>
          <div>
            <label className="label" htmlFor="nc">{phone ? tr('رقم الجوال الجديد', 'New mobile number') : tr('البريد الإلكتروني الجديد', 'New email')}</label>
            <input id="nc" className="field num" dir="ltr" type={phone ? 'text' : 'email'} inputMode={phone ? 'tel' : 'email'} placeholder={phone ? '05XXXXXXXX' : 'name@example.com'}
              value={value} onChange={(e) => setValue(e.target.value)} required autoFocus />
            {!phone && <p className="hint">{tr('تصلك الفواتير الإلكترونية على البريد الجديد بعد التأكيد.', 'E-invoices go to the new email once confirmed.')}</p>}
          </div>
          <button className="btn-primary w-full" disabled={busy}>{busy ? tr('جارٍ الإرسال…', 'Sending…') : tr('إرسال رمز التحقق', 'Send verification code')}</button>
        </form>
      )}
    </Modal>
  )
}

/** Owner edits name and ID directly; the mobile number and the email are confirmed with a one-time code. */
function AccountDetails() {
  const { user, setUser, toast } = useApp()
  const [f, setF] = useState({ fullName: user?.fullName ?? '', nationalId: user?.nationalId ?? '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [changing, setChanging] = useState<'phone' | 'email' | null>(null)
  if (!user) return null
  // name and ID come from sign-up and are fixed once set
  const fixed = !!user.profile?.firstName && !!user.nationalId
  const dirty = !fixed && (f.fullName !== user.fullName || f.nationalId !== (user.nationalId ?? ''))
  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErr('')
    try { setUser(await api.updateMyAccount(f)); toast(tr('حُفظت بياناتك', 'Your details were saved')) } catch (x) { setErr((x as Error).message) } finally { setBusy(false) }
  }
  const Locked = ({ label, value, kind, hint }: { label: string; value: string; kind: 'phone' | 'email'; hint: string }) => (
    <div>
      <span className="label">{label}</span>
      <div className="flex items-center gap-2">
        <span className="field num flex-1 truncate bg-stone" dir="ltr">{value}</span>
        <button type="button" className="btn-ghost btn-sm shrink-0" onClick={() => setChanging(kind)}>{tr('تغيير', 'Change')}</button>
      </div>
      <p className="hint">{hint}</p>
    </div>
  )
  return (
    <SectionCard title={tr('بيانات الحساب', 'Account details')} icon="file">
      <form onSubmit={save} className="space-y-4 p-5">
        {err && <ErrorBox text={err} />}
        <div className="grid gap-4 sm:grid-cols-2">
          {fixed ? <>
            <div><span className="label">{tr('الاسم الرباعي', 'Full name')}</span><span className="field block truncate bg-stone">{user.fullName}</span></div>
            <div><span className="label">{tr('رقم الهوية / الإقامة', 'National ID / Iqama')}</span><span className="field num block bg-stone" dir="ltr">{user.nationalId}</span><p className="hint">{tr('تستخدمه للدخول. لتصحيحه تواصل مع الدعم.', 'Used to sign in. Contact support to correct it.')}</p></div>
          </> : <>
            <div><label className="label" htmlFor="af">{tr('الاسم الرباعي', 'Full name')}</label><input id="af" className="field" value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} required /></div>
            <div><label className="label" htmlFor="an">{tr('رقم الهوية أو الإقامة', 'National ID or Iqama')} <span className="font-normal text-muted">{tr('(اختياري)', '(optional)')}</span></label><input id="an" className="field num" dir="ltr" inputMode="numeric" maxLength={10} value={f.nationalId} onChange={(e) => setF({ ...f, nationalId: e.target.value.replace(/\D/g, '') })} /></div>
          </>}
          <Locked label={tr('رقم الجوال', 'Mobile number')} value={user.phone} kind="phone" hint={tr('يتطلب رمز تحقق يُرسل إلى الرقم الجديد.', 'Requires a verification code sent to the new number.')} />
          <Locked label={tr('البريد الإلكتروني', 'Email')} value={user.email} kind="email" hint={tr('تصلك عليه الفواتير. يتطلب رمز تحقق يُرسل إلى البريد الجديد.', 'Invoices are sent here. Requires a verification code sent to the new email.')} />
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
          {!fixed && <button className="btn-primary" disabled={!dirty || busy}>{busy ? tr('جارٍ الحفظ…', 'Saving…') : tr('حفظ التعديلات', 'Save changes')}</button>}
          {dirty && <button type="button" className="text-[14px] font-bold text-muted hover:text-ink" onClick={() => setF({ fullName: user.fullName, nationalId: user.nationalId ?? '' })}>{tr('تراجع', 'Undo')}</button>}
          <span className="ms-auto text-[13px] text-muted">{tr('مسجّل منذ', 'Member since')} {date(user.createdAt)}</span>
        </div>
        {!fixed && <p className="text-[13px] text-muted">{tr('تعديل الاسم يحدّث اسم المالك على أسمائك المسجلة وشهاداتها.', 'Changing your name updates the owner name on your registered names and their certificates.')}</p>}
      </form>
      {changing && <ChangeContact kind={changing} onClose={() => setChanging(null)} />}
    </SectionCard>
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
      <PageHead title={tr('حسابي', 'My account')} sub={tr('عدّل بياناتك ورقم جوالك، وصورتك التي تظهر في قوائم ملاك الأسماء.', 'Edit your details, mobile number, and the photo shown in name-owner lists.')} />
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <SectionCard title={tr('الصورة الشخصية', 'Profile photo')} icon="users">
          <div className="flex flex-col items-center gap-4 p-6 text-center">
            <Avatar name={user.fullName} src={user.avatarUrl} size={120} ring />
            <label className={`btn-primary btn-sm cursor-pointer ${busy ? 'pointer-events-none opacity-50' : ''}`}>
              {user.avatarUrl ? tr('تغيير الصورة', 'Change photo') : tr('رفع صورة', 'Upload photo')}
              <input type="file" accept="image/*" className="sr-only" onChange={async (e) => {
                const f = e.target.files?.[0]; e.target.value = ''
                if (!f) return
                if (f.size > 8 * 1024 * 1024) { toast(tr('الصورة أكبر من 8 ميجابايت', 'The image is larger than 8 MB'), 'bad'); return }
                await save({ avatarUrl: await resizeToSquare(f), showAvatar: true }, tr('حُفظت صورتك', 'Your photo was saved'))
              }} />
            </label>
            {user.avatarUrl && <button className="text-[14px] font-bold text-bad hover:underline" disabled={busy} onClick={() => save({ avatarUrl: null, showAvatar: false }, tr('حُذفت صورتك', 'Your photo was removed'))}>{tr('حذف الصورة', 'Remove photo')}</button>}
            <label className={`flex items-start gap-2 text-start text-[14.5px] ${user.avatarUrl ? '' : 'opacity-50'}`}>
              <input type="checkbox" className="mt-1.5" checked={!!user.showAvatar} disabled={!user.avatarUrl || busy}
                onChange={(e) => save({ showAvatar: e.target.checked }, e.target.checked ? tr('ستظهر صورتك في القوائم العامة', 'Your photo will appear in public lists') : tr('أُخفيت صورتك من القوائم العامة', 'Your photo is hidden from public lists'))} />
              <span>{tr('إظهار صورتي بجانب اسمي في قوائم «الأكثر ملكية» و«أعلى قيمة» على المنصة', 'Show my photo next to my name in the «Top owners» and «Highest value» lists')}</span>
            </label>
          </div>
        </SectionCard>
        <AccountDetails />
      </div>
      <ProfileSections />
    </>
  )
}

export function WatchlistPage() {
  const { data, loading } = useLoad(() => api.myWatchlist(), [], 15000)
  return (
    <>
      <PageHead title={tr('قائمة المتابعة', 'Watchlist')} sub={tr('المزادات اللي تتابعها. ننبهك قبل بدايتها بساعة، وقبل نهايتها بساعة.', 'Auctions you are watching. We notify you an hour before each starts and an hour before it ends.')} action={<Link to="/auctions" className="btn-ghost">{tr('تصفّح المزادات', 'Browse auctions')}</Link>} />
      {loading && !data ? <Loading /> : data?.length ? <AuctionGrid list={data} /> : (
        <Empty title={tr('لا تتابع أي مزاد بعد', 'You are not watching any auctions yet')}>
          <p className="text-muted">{tr('اضغط «تابع المزاد» في صفحة أي مزاد ليظهر هنا، أو فعّل المزايدة التلقائية عليه.', 'Tap «Watch» on any auction page to see it here, or turn on auto-bid for it.')}</p>
          <Link to="/auctions" className="btn-primary">{tr('تصفّح المزادات', 'Browse auctions')}</Link>
        </Empty>
      )}
    </>
  )
}
