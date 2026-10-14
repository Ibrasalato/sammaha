import { AuctionActionDialog, useAuctionRights } from '../../components/AuctionControls'
import { OwnerCell, useOwner } from '../../components/OwnerCell'
import { countryName } from '../../lib/countries'
import type { AuctionAction } from '../../components/AuctionControls'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Icon, SectionCard, StatTile } from '../../components/dash'
import { NoResults, TableTools, useTableFilter } from '../../components/TableTools'
import { InvoiceDoc } from '../../components/InvoiceDoc'
import { Countdown, Empty, ErrorBox, Loading, Modal, NameSeal, PageHead, AuctionStatePill, RequestStatusPill, Segmented, TypeBadge } from '../../components/ui'
import { RULES, TYPE_LABEL, typeOptions } from '../../lib/config'
import { phaseOf } from '../../lib/demoApi'
import { date, dateTime, fromLocalInput, namesCount, num, sar, toLocalInput } from '../../lib/format'
import { api, useApp, useLoad } from '../../lib/store'
import type { Auction, AuctionScope, CamelEvent, EventKind, Invoice, NameType, RequestStatus, ReviewDecision } from '../../lib/types'
import { EVENT_KIND } from '../../lib/events'
import { locale, tr } from '../../lib/i18n'
import { localizeServerText as L } from '../../lib/serverText'
import { InvoiceStatus } from '../../components/InvoiceStatus'

export function AdminHome() {
  const { user } = useApp()
  const { data } = useLoad(() => api.overview(), [], 15000)
  const queue = useLoad(() => api.listRequests('under_review'), [])
  const live = useLoad(() => api.listAuctions({ phase: 'live' }), [], 15000)
  const today = new Date().toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Riyadh' })

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-xl bg-pine text-paper">
        <img src="./hero/mazayin.webp" alt="" className="absolute inset-0 h-full w-full object-cover opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-l from-pine via-pine/85 to-pine/40" />
        <div className="relative flex flex-wrap items-end gap-6 p-6 sm:p-8">
          <div className="flex-1">
            <p className="text-[14px] font-medium text-gold-light">{today}</p>
            <h1 className="mt-1 text-[28px] font-extrabold text-paper sm:text-[32px]">{tr('لوحة لجنة الاعتماد', 'Accreditation Committee dashboard')}</h1>
            <p className="mt-1 text-paper/75">{tr('مرحبًا', 'Welcome,')} {user?.fullName.split(' ')[0]}. {data?.underReview ? tr(`${data.underReview === 1 ? 'طلب واحد' : data.underReview === 2 ? 'طلبان' : `${data.underReview} طلبات`} بانتظار المراجعة.`, `${data.underReview === 1 ? '1 request' : `${data.underReview} requests`} awaiting review.`) : tr('لا توجد طلبات بانتظار المراجعة.', 'No requests awaiting review.')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/admin/requests" className="btn-gold"><Icon name="shield" className="h-4 w-4" />{tr('مراجعة الطلبات', 'Request review')}</Link>
            <Link to="/admin/schedule" className="btn-on-dark">{tr('فتح المزادات', 'Open auctions')}</Link>
          </div>
        </div>
      </section>

      {data && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <StatTile icon="shield" tone="blue" label={tr('تحت المراجعة', 'Under review')} value={num(data.underReview)} hint={tr('طلبات تنتظر قرار اللجنة', 'Requests awaiting the committee’s decision')} to="/admin/requests" highlight={data.underReview > 0} />
          <StatTile icon="calendar" tone="gold" label={tr('بانتظار فتح المزاد', 'Awaiting auction')} value={num(data.awaitingSchedule)} hint={tr('أسماء مقبولة بلا موعد', 'Accepted names without a date')} to="/admin/schedule" highlight={data.awaitingSchedule > 0} />
          <StatTile icon="gavel" tone="green" label={tr('مزادات جارية', 'Live auctions')} value={num(data.live)} hint={tr(`${num(data.scheduled)} مزاد قادم`, `${num(data.scheduled)} upcoming`)} to="/admin/auctions" />
          <StatTile icon="receipt" tone="red" label={tr('فواتير غير مدفوعة', 'Unpaid invoices')} value={num(data.unpaidInvoices)} to="/admin/invoices" />
          <StatTile icon="coins" tone="pine" label={tr('إيرادات محصّلة', 'Revenue collected')} value={sar(data.revenue)} hint={tr('شاملة الضريبة', 'Including VAT')} to="/admin/invoices" />
          <StatTile icon="alert" tone="gold" label={tr('شكاوى وبلاغات مفتوحة', 'Open complaints & reports')} value={num(data.openTickets ?? 0)} hint={tr('من صفحة تواصل معنا', 'From the Contact us page')} to="/admin/tickets" highlight={(data.openTickets ?? 0) > 0} />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <SectionCard title={tr('قائمة المراجعة', 'Review queue')} icon="shield" action={<Link to="/admin/requests" className="text-[14px] font-bold text-gold-deep hover:underline">{tr('الكل', 'All')}</Link>}>
          {queue.data?.length ? (
            <ul className="divide-y divide-line/70">
              {[...queue.data].reverse().slice(0, 6).map((r) => {
                const flagged = r.candidates.filter((c) => c.similar.length).length
                return (
                  <li key={r.id}>
                    <Link to={`/admin/requests/${r.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 hover:bg-stone">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2"><span className="num font-bold">{r.number}</span><TypeBadge type={r.type} /><span className="truncate text-[14px] text-muted">{r.ownerName}</span></div>
                        <div className="mt-1 flex flex-wrap gap-1.5">{r.candidates.map((c) => <span key={c.id} className={`rounded px-2 py-0.5 text-[13px] font-bold ${c.similar.length ? 'bg-gold-soft text-gold-deep' : 'bg-stone-deep'}`}>{c.name}</span>)}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {flagged ? <span className="pill bg-gold-soft text-gold-deep"><Icon name="alert" className="h-3.5 w-3.5" />{flagged === 1 ? tr('اسم شبيه', '1 similar name') : tr(`${flagged} أسماء شبيهة`, `${flagged} similar names`)}</span> : <span className="pill bg-[#E2F0E8] text-ok">{tr('بلا تشابه', 'No similarity')}</span>}
                        <span className="text-[12.5px] text-muted">{dateTime(r.submittedAt)}</span>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          ) : <div className="p-8 text-center text-muted">{tr('لا توجد طلبات بانتظار المراجعة.', 'No requests awaiting review.')}</div>}
        </SectionCard>

        <SectionCard title={tr('مزادات جارية', 'Live auctions')} icon="gavel" action={<Link to="/admin/auctions" className="text-[14px] font-bold text-gold-deep hover:underline">{tr('متابعة', 'Follow')}</Link>}>
          {live.data?.length ? (
            <ul className="divide-y divide-line/70">
              {live.data.slice(0, 6).map((a) => (
                <li key={a.id}>
                  <Link to={`/auctions/${a.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-stone">
                    <NameSeal name={a.name} type={a.type} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-bold">{a.bidCount ? tr(`${num(a.bidCount)} مزايدة`, `${num(a.bidCount)} bids`) : tr('بلا مزايدات', 'No bids')}</p>
                      <Countdown to={a.endsAt} prefix={tr('ينتهي خلال', 'Ends in')} className="text-[13px]" />
                    </div>
                    <span className="num text-[18px] font-extrabold">{num(a.currentPrice)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <div className="p-8 text-center text-muted">{tr('لا توجد مزادات جارية.', 'No live auctions.')}</div>}
        </SectionCard>
      </div>
    </div>
  )
}

export function AdminRequests() {
  const [status, setStatus] = useState<RequestStatus | 'all'>('under_review')
  const [type, setType] = useState<NameType | 'all'>('all')
  const { data, loading } = useLoad(() => api.listRequests(status), [status])
  const rows = useMemo(() => (data ?? []).filter((r) => type === 'all' || r.type === type), [data, type])
  const tf = useTableFilter(rows, {
    fields: (r) => [r.number, r.ownerName, ...r.candidates.map((c) => c.name)],
    filters: [
      { key: 'kind', label: tr('الطلب', 'Request'), options: [['', tr('الكل', 'All')], ['standard', tr('طلب شعار', 'Mark request')], ['compound', tr('اسم مركب', 'Compound name')], ['investment', tr('استثمار الاسم', 'Name investment')]], test: (r, v) => (r.kind ?? 'standard') === v },
      { key: 'similar', label: tr('التشابه', 'Similarity'), options: [['', tr('الكل', 'All')], ['yes', tr('فيها أسماء شبيهة', 'Has similar names')], ['no', tr('بلا تشابه', 'No similarity')]], test: (r, v) => r.candidates.some((c) => c.similar.length) === (v === 'yes') },
    ],
  })
  const list = tf.list
  return (
    <>
      <PageHead title={tr('طلبات الشعارات', 'Mark requests')} />
      <div className="mb-4 flex flex-wrap gap-3">
        <Segmented value={status} onChange={setStatus} options={[['under_review', tr('تحت المراجعة', 'Under review')], ['accepted', tr('مقبولة', 'Accepted')], ['rejected', tr('مرفوضة', 'Rejected')], ['cancelled', tr('ملغاة', 'Cancelled')], ['all', tr('الكل', 'All')]]} />
        <Segmented value={type} onChange={setType} options={typeOptions('all', tr('الكل', 'All'))} />
      </div>
      <TableTools t={tf} placeholder={tr('بحث برقم الطلب أو المالك أو الاسم', 'Search by request no., owner or name')} />
      {loading && !data ? <Loading /> : list.length ? (
        <div className="panel overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>{tr('الطلب', 'Request')}</th><th>{tr('المالك', 'Owner')}</th><th>{tr('النوع', 'Type')}</th><th>{tr('الأسماء', 'Names')}</th><th>{tr('الحالة', 'Status')}</th><th>{tr('التقديم', 'Submitted')}</th></tr></thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id}>
                  <td><Link to={`/admin/requests/${r.id}`} className="num font-semibold underline-offset-4 hover:underline">{r.number}</Link>{r.kind === 'compound' && <span className="pill ms-2 bg-gold-soft text-gold-deep">{tr('اسم مركب', 'Compound name')}</span>}{r.kind === 'investment' && <span className="pill ms-2 bg-invest-soft text-invest-deep">{tr('استثمار الاسم', 'Name investment')}</span>}</td>
                  <td><OwnerCell id={r.userId} name={r.ownerName} /></td>
                  <td><TypeBadge type={r.type} /></td>
                  <td className="font-extrabold">
                    {r.candidates.map((c, i) => (
                      <span key={c.id} className={c.status === 'rejected' ? 'text-bad line-through' : c.status === 'withdrawn' ? 'text-muted line-through' : c.status === 'accepted' ? 'text-ok' : ''}>
                        {c.name}{c.similar.length ? <sup className="text-gold-deep">●</sup> : null}{i < r.candidates.length - 1 ? tr('، ', ', ') : ''}
                      </span>
                    ))}
                  </td>
                  <td><RequestStatusPill status={r.status} /></td>
                  <td className="whitespace-nowrap text-muted">{date(r.submittedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Empty title={tr('لا توجد طلبات بهذه التصفية', 'No requests match this filter')} />}
      <p className="mt-2 text-[13px] text-muted"><span className="text-gold-deep">●</span> {tr('اسم له أسماء شبيهة يجب التدقيق فيها.', 'Name with similar names that need checking.')}</p>
    </>
  )
}

export function AdminReview() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const { toast } = useApp()
  const { data: r, error, loading, reload } = useLoad(() => api.getRequest(id), [id])
  const owner = useOwner(r?.userId)
  const [dec, setDec] = useState<Record<string, ReviewDecision>>({})
  const [note, setNote] = useState('')
  const [action, setAction] = useState<'reject' | 'cancel' | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!r) return
    // default: exact matches rejected, everything else undecided
    setDec(Object.fromEntries(r.candidates.filter((c) => c.status !== 'withdrawn').map((c) => [c.id, c.similar.some((h) => h.score === 1)
      ? { candidateId: c.id, status: 'rejected', reason: `مطابق لـ«${c.similar.find((h) => h.score === 1)!.name}»` }
      : { candidateId: c.id, status: c.status === 'pending' ? (undefined as never) : (c.status as 'accepted' | 'rejected'), reason: c.rejectReason }])))
  }, [r])

  if (loading && !r) return <Loading />
  if (error || !r) return <ErrorBox text={error || tr('الطلب غير موجود', 'Request not found')} />
  const editable = r.status === 'under_review'
  const allDecided = r.candidates.every((c) => c.status === 'withdrawn' || dec[c.id]?.status)

  async function run(fn: () => Promise<unknown>, msg: string) {
    setBusy(true)
    try { await fn(); toast(msg); reload() } catch (e) { toast((e as Error).message, 'bad') } finally { setBusy(false) }
  }

  return (
    <>
      <Link to="/admin/requests" className="text-sm font-medium text-muted hover:text-ink">{tr('الطلبات', 'Requests')}</Link>
      {r.kind === 'compound' && (
        <div className="mb-4 mt-3 flex items-start gap-3 rounded-xl border border-gold/50 bg-gold-soft p-4 text-[15px]">
          <Icon name="tag" className="mt-0.5 h-5 w-5 shrink-0 text-gold-deep" />
          <span>{tr('طلب', 'A')} <b>{tr('اسم مركب', 'compound name')}</b> {tr('من الاسم المسجل «', 'request based on the registered name “')}<b>{r.baseName}</b>{tr('» المملوك لمقدم الطلب. عند القبول يُسجّل الاسم المركب باسمه مباشرة', '”, owned by the applicant. If accepted, the compound name is registered to them directly')} <b>{tr('دون مزاد', 'without an auction')}</b>{tr('، وعند الرفض لا يترتب شيء.', '; if rejected, nothing changes.')}</span>
        </div>
      )}
      {r.kind === 'investment' && (
        <div className="mb-4 mt-3 flex items-start gap-3 rounded-xl border border-invest/30 bg-invest-soft p-4 text-[15px]">
          <Icon name="coins" className="mt-0.5 h-5 w-5 shrink-0 text-invest-deep" />
          <span>{tr('طلب', 'A')} <b>{tr('استثمار الاسم', 'name investment')}</b>{tr(': حتى', ' request: up to')} {RULES.investMaxNames} {tr('أسماء جديدة، يُدرس كل اسم وفق المعايير المعتمدة. رسوم الدراسة', 'new names, each studied against the approved criteria. The study fee of')} {sar(r.depositAmount)} {tr('', 'is')} <b>{tr('غير مستردة', 'non-refundable')}</b>{tr('. عند القبول يُطرح في', '. If accepted, it goes to a')} <b>{tr('مزاد عام', 'public auction')}</b> {tr('ويُوزَّع العائد', 'and the proceeds are split')} {100 - Math.round(RULES.investOwnerShare * 100)}% {tr('للمنظمة و', 'to the organization and ')}{Math.round(RULES.investOwnerShare * 100)}% {tr('لصاحب الاسم، وعند عدم القبول يُبلَّغ برسالة نصية.', 'to the name holder; if not accepted, they are notified by SMS.')}</span>
        </div>
      )}
      <PageHead title={r.kind === 'compound' ? tr(`مراجعة اسم مركب ${r.number}`, `Compound name review ${r.number}`) : r.kind === 'investment' ? tr(`دراسة استثمار الاسم ${r.number}`, `Name investment study ${r.number}`) : tr(`مراجعة الطلب ${r.number}`, `Request review ${r.number}`)} sub={<span className="flex flex-wrap items-center gap-2"><TypeBadge type={r.type} /><RequestStatusPill status={r.status} /><span>{r.ownerName}{owner ? ` · ${tr('هوية', 'ID')} ${owner.nationalId ?? '—'}${owner.nationality ? ` · ${countryName(owner.nationality)}` : ''} · ${owner.phone}` : ''}{tr('، قُدّم', ', submitted')} {dateTime(r.submittedAt)}</span></span>} />

      <div className="space-y-4">
        {r.candidates.map((c) => {
          const d = dec[c.id]
          return (
            <section key={c.id} className="panel grid gap-5 p-5 md:grid-cols-[auto_1fr_260px]">
              <NameSeal name={c.name} type={r.type} size="md" />
              <div>
                <h2 className="text-2xl">{c.name}</h2>
                {c.similar.length ? (
                  <>
                    <p className="mt-1 text-sm font-semibold text-warn">{tr('أسماء شبيهة موجودة مسبقًا', 'Similar names already exist')}</p>
                    <table className="tbl mt-2">
                      <thead><tr><th>{tr('الاسم', 'Name')}</th><th>{tr('النوع', 'Type')}</th><th>{tr('المصدر', 'Source')}</th><th>{tr('التشابه', 'Similarity')}</th></tr></thead>
                      <tbody>
                        {c.similar.map((h) => (
                          <tr key={h.name + h.source}>
                            <td className="font-extrabold">{h.name}</td>
                            <td>{TYPE_LABEL[h.type]}</td>
                            <td className="text-muted">{r.kind === 'compound' && h.name === r.baseName ? <span className="font-bold text-pine">{tr('الاسم الأساسي، ملك مقدم الطلب', 'Base name, owned by the applicant')}</span> : h.source === 'reserved' ? tr('سجل الأسماء', 'Names registry') : h.source === 'auction' ? tr('في مزاد', 'In auction') : tr('طلب آخر', 'Another request')}</td>
                            <td><span className={`num font-semibold ${h.score === 1 ? 'text-bad' : h.score >= 0.85 ? 'text-warn' : 'text-muted'}`}>{h.score === 1 ? tr('مطابق', 'Exact match') : `${Math.round(h.score * 100)}%`}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                ) : <p className="mt-1 text-sm font-semibold text-ok">{tr('لا توجد أسماء شبيهة', 'No similar names')}</p>}
              </div>
              <div>
                {c.status === 'withdrawn' ? (
                  <div><span className="pill bg-stone-deep text-muted">{tr('سحبه المالك', 'Withdrawn by owner')}</span><p className="mt-1 text-sm text-muted">{tr('لا يحتاج قرارًا.', 'No decision needed.')}</p></div>
                ) : editable ? (
                  <fieldset className="space-y-2">
                    <legend className="label">{tr('القرار', 'Decision')}</legend>
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" aria-pressed={d?.status === 'accepted'} disabled={c.similar.some((h) => h.score === 1)}
                        className={`btn btn-sm border ${d?.status === 'accepted' ? 'border-ok bg-ok text-paper' : 'border-line bg-paper'}`}
                        onClick={() => setDec((r.kind ?? 'standard') !== 'standard' ? { ...dec, [c.id]: { candidateId: c.id, status: 'accepted' } }
                          : Object.fromEntries(r.candidates.filter((x) => x.status !== 'withdrawn').map((x) => [x.id, x.id === c.id ? { candidateId: x.id, status: 'accepted' } : { candidateId: x.id, status: 'rejected', reason: `قُبل «${c.name}» من هذا الطلب (شعار واحد لكل طلب)` }])))}>{tr('قبول', 'Accept')}</button>
                      <button type="button" aria-pressed={d?.status === 'rejected'}
                        className={`btn btn-sm border ${d?.status === 'rejected' ? 'border-bad bg-bad text-paper' : 'border-line bg-paper'}`}
                        onClick={() => setDec({ ...dec, [c.id]: { candidateId: c.id, status: 'rejected', reason: d?.reason || 'مشابه لاسم مسجل' } })}>{tr('رفض', 'Reject')}</button>
                    </div>
                    {d?.status === 'rejected' && (
                      <input className="field text-sm" aria-label={tr('سبب الرفض', 'Rejection reason')} value={d.reason ?? ''} onChange={(e) => setDec({ ...dec, [c.id]: { ...d, reason: e.target.value } })} />
                    )}
                  </fieldset>
                ) : (
                  <div>
                    <span className={`pill ${c.status === 'accepted' ? 'bg-ok/10 text-ok' : c.status === 'rejected' ? 'bg-bad/10 text-bad' : 'bg-stone-deep text-muted'}`}>{c.status === 'accepted' ? tr('مقبول', 'Accepted') : c.status === 'rejected' ? tr('مرفوض', 'Rejected') : tr('لم يُراجع', 'Not reviewed')}</span>
                    {c.rejectReason && <p className="mt-1 text-sm text-bad">{L(c.rejectReason)}</p>}
                    {c.auctionId && <Link to={`/auctions/${c.auctionId}`} className="mt-2 block text-sm font-semibold text-gold-deep underline underline-offset-4">{tr('صفحة المزاد', 'Auction page')}</Link>}
                  </div>
                )}
              </div>
            </section>
          )
        })}
      </div>

      {editable ? (
        <section className="panel mt-4 p-5">
          <label className="label" htmlFor="note">{tr('ملاحظة للمالك (اختياري)', 'Note to the owner (optional)')}</label>
          <textarea id="note" className="field" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn-primary" disabled={!allDecided || busy}
              onClick={() => run(() => api.reviewRequest(r.id, Object.values(dec), note || undefined), tr('تم اعتماد قرار اللجنة', 'Committee decision approved'))}>{tr('اعتماد القرار', 'Approve decision')}</button>
            <button className="btn-danger" disabled={busy} onClick={() => { setAction('reject'); setReason('') }}>{tr('رفض الطلب كاملًا', 'Reject entire request')}</button>
            <button className="btn-ghost" disabled={busy} onClick={() => { setAction('cancel'); setReason('') }}>{tr('إلغاء الطلب', 'Cancel request')}</button>
          </div>
          <p className="hint">{r.kind === 'compound'
            ? tr('لا ضمان على طلب الاسم المركب. القبول يسجّل الاسم باسم المالك فورًا دون مزاد.', 'No guarantee applies to a compound name request. Accepting registers the name to the owner immediately, without an auction.')
            : r.kind === 'investment' ? tr('رسوم الدراسة لا تُعاد عند الرفض أو الإلغاء. القبول ينقل الاسم إلى «فتح المزادات» لطرحه في مزاد عام.', 'The study fee is not refunded on rejection or cancellation. Accepting moves the name to “Open auctions” for a public auction.')
            : tr(`يُقبل شعار واحد فقط من الطلب، وقبوله يرفض بقية الأسماء. الرفض أو الإلغاء يعيد ${sar(r.depositAmount)} إلى محفظة المالك، وإن رُفضت الأسماء كلها يُعدّ الطلب مرفوضًا ويُعاد الضمان.`, `Only one mark per request can be accepted; accepting it rejects the other names. Rejection or cancellation returns ${sar(r.depositAmount)} to the owner’s wallet; if all names are rejected, the request is rejected and the guarantee returned.`)}</p>
        </section>
      ) : r.status === 'accepted' && r.candidates.some((c) => c.status === 'accepted' && !c.auctionId) ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-gold bg-gold-soft p-4">
          <p className="flex-1 font-semibold">{tr('الطلب مقبول. حدّد موعد مزاد الأسماء المقبولة.', 'Request accepted. Set the auction date for the accepted names.')}</p>
          <button className="btn-gold" onClick={() => nav('/admin/schedule')}>{tr('فتح المزاد', 'Open auction')}</button>
        </div>
      ) : r.reviewNote ? <p className="panel mt-4 p-4 text-sm"><span className="text-muted">{tr('ملاحظة اللجنة: ', 'Committee note: ')}</span>{r.reviewNote}</p> : null}

      <Modal open={!!action} onClose={() => setAction(null)} title={action === 'reject' ? tr('رفض الطلب', 'Reject request') : tr('إلغاء الطلب', 'Cancel request')}>
        <label className="label" htmlFor="rs">{tr('السبب (يظهر للمالك)', 'Reason (shown to the owner)')}</label>
        <textarea id="rs" className="field" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        <button className={action === 'reject' ? 'btn-danger mt-4 w-full' : 'btn-primary mt-4 w-full'} disabled={!reason.trim() || busy}
          onClick={() => { const a = action; setAction(null); run(() => (a === 'reject' ? api.rejectRequest(r.id, reason) : api.cancelRequest(r.id, reason)), a === 'reject' ? tr('رُفض الطلب وأُعيد الضمان', 'Request rejected and guarantee returned') : tr('أُلغي الطلب وأُعيد الضمان', 'Request cancelled and guarantee returned')) }}>
          {action === 'reject' ? tr('رفض الطلب وإعادة الضمان', 'Reject request and return guarantee') : tr('إلغاء الطلب وإعادة الضمان', 'Cancel request and return guarantee')}
        </button>
      </Modal>
    </>
  )
}

export function AdminSchedule() {
  const { toast } = useApp()
  const { data, loading, reload } = useLoad(() => api.awaitingSchedule(), [])
  // selection keeps its order: with a stagger, marks are released in this order
  const [sel, setSelList] = useState<string[]>([])
  const setSel = (s: Set<string>) => setSelList((prev) => [...prev.filter((x) => s.has(x)), ...[...s].filter((x) => !prev.includes(x))])
  const [stagger, setStagger] = useState(false)
  const [gap, setGap] = useState(10)
  const base = useMemo(() => { const d = new Date(); d.setMinutes(0, 0, 0); return d.getTime() + 3600_000 }, [])
  const [starts, setStarts] = useState(toLocalInput(base))
  const [ends, setEnds] = useState(toLocalInput(base + 3 * 86400_000))
  const [busy, setBusy] = useState(false)

  const tf = useTableFilter(data, {
    fields: (c) => [c.name, c.request.number, c.request.ownerName],
    filters: [{ key: 'type', label: tr('النوع', 'Type'), options: typeOptions('', tr('الكل', 'All')), test: (x, v) => x.request.type === v }],
  })
  const toggle = (id: string) => setSelList((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  const move = (i: number, d: -1 | 1) => setSelList((p) => { const n = [...p]; const j = i + d; if (j < 0 || j >= n.length) return p; [n[i], n[j]] = [n[j], n[i]]; return n })
  const minutes = stagger ? gap : 0
  const byId = new Map((data ?? []).map((c) => [c.id, c]))
  const t0 = Date.parse(fromLocalInput(starts)), t1 = Date.parse(fromLocalInput(ends))
  const dur = (days: number) => setEnds(toLocalInput(Date.parse(fromLocalInput(starts)) + days * 86400_000))

  return (
    <>
      <PageHead title={tr('فتح المزادات', 'Open auctions')} sub={tr(`الأسماء المقبولة بانتظار تحديد موعد المزاد. السعر الافتتاحي ${sar(RULES.openingPrice)}، والتوقيت بتوقيت الرياض.`, `Accepted names awaiting an auction date. Opening price ${sar(RULES.openingPrice)}; times are Riyadh time.`)} />
      {loading && !data ? <Loading /> : data?.length ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div>
          <TableTools t={tf} placeholder={tr('بحث بالاسم أو الطلب أو المالك', 'Search by name, request or owner')} />
          <div className="panel overflow-x-auto">
            <table className="tbl">
              <thead><tr><th><input type="checkbox" aria-label={tr('تحديد الظاهر', 'Select visible')} checked={!!tf.list.length && tf.list.every((c) => sel.includes(c.id))} onChange={(e) => { const s = new Set(sel); tf.list.forEach((c) => (e.target.checked ? s.add(c.id) : s.delete(c.id))); setSel(s) }} /></th><th>{tr('الاسم', 'Name')}</th><th>{tr('النوع', 'Type')}</th><th>{tr('الطلب', 'Request')}</th><th>{tr('المالك', 'Owner')}</th></tr></thead>
              <tbody>
                {!tf.list.length && <NoResults cols={5} onReset={tf.reset} />}
                {tf.list.map((c) => (
                  <tr key={c.id} className="cursor-pointer hover:bg-stone" onClick={() => toggle(c.id)}>
                    <td>{stagger && sel.includes(c.id) && <span className="num me-1 inline-grid h-5 w-5 place-items-center rounded-full bg-pine text-[11px] text-paper">{sel.indexOf(c.id) + 1}</span>}<input type="checkbox" checked={sel.includes(c.id)} onChange={() => toggle(c.id)} onClick={(e) => e.stopPropagation()} aria-label={c.name} /></td>
                    <td className="font-extrabold text-lg">{c.name}</td>
                    <td><TypeBadge type={c.request.type} /></td>
                    <td className="num">{c.request.number}</td>
                    <td><OwnerCell id={c.request.userId} name={c.request.ownerName} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>
          <aside className="panel h-fit p-5">
            <h2 className="text-lg">{tr('موعد المزاد', 'Auction date')}</h2>
            <label className="label mt-3" htmlFor="st">{tr('البداية', 'Start')}</label>
            <input id="st" type="datetime-local" className="field num" value={starts} onChange={(e) => setStarts(e.target.value)} />
            <label className="label mt-3" htmlFor="en">{tr('النهاية', 'End')}</label>
            <input id="en" type="datetime-local" className="field num" value={ends} onChange={(e) => setEnds(e.target.value)} />
            <div className="mt-2 flex gap-2">{[1, 3, 7].map((d) => <button key={d} className="btn-ghost btn-sm flex-1" onClick={() => dur(d)}>{d === 1 ? tr('يوم', '1 day') : tr(`${d} أيام`, `${d} days`)}</button>)}</div>

            <div className="mt-5 border-t border-line pt-4">
              <label className="flex cursor-pointer items-start gap-2">
                <input type="checkbox" className="mt-1" checked={stagger} onChange={(e) => setStagger(e.target.checked)} />
                <span><b>{tr('نزول الشعارات بالتدريج', 'Staggered release')}</b><span className="block text-[13px] text-muted">{tr('يبدأ كل شعار وينتهي بعد الذي قبله بفاصل محدد، بالترتيب أدناه.', 'Each mark starts and ends a set interval after the previous one, in the order below.')}</span></span>
              </label>
              {stagger && <>
                <label className="label mt-3" htmlFor="gap">{tr('الفاصل بين كل شعار (دقيقة)', 'Interval between marks (minutes)')}</label>
                <input id="gap" type="number" min={1} max={1440} className="field num" value={gap} onChange={(e) => setGap(Math.max(1, Math.min(1440, Number(e.target.value) || 1)))} />
                <div className="mt-2 flex flex-wrap gap-1.5">{[5, 10, 15, 30, 60].map((m) => <button key={m} type="button" className={`btn-sm rounded-lg border-2 px-2.5 ${gap === m ? 'border-pine bg-pine-soft' : 'border-line'}`} onClick={() => setGap(m)}>{m === 60 ? tr('ساعة', '1 hr') : tr(`${m} د`, `${m} min`)}</button>)}</div>
                {sel.length > 0 && (
                  <ol className="mt-3 max-h-64 space-y-1 overflow-y-auto text-[13px]">
                    {sel.map((id, i) => (
                      <li key={id} className="flex items-center gap-1.5 rounded-md bg-stone px-2 py-1.5">
                        <span className="num w-5 text-center font-bold text-pine">{i + 1}</span>
                        <span className="min-w-0 flex-1 truncate font-bold">{byId.get(id)?.name}</span>
                        <span className="num whitespace-nowrap text-muted" dir="ltr">{t0 ? new Date(t0 + i * minutes * 60_000).toLocaleTimeString(tr('ar-SA-u-nu-latn', 'en-GB'), { timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                        <button type="button" className="px-1 text-muted hover:text-ink disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)} aria-label={tr('تقديم', 'Move up')}>▲</button>
                        <button type="button" className="px-1 text-muted hover:text-ink disabled:opacity-30" disabled={i === sel.length - 1} onClick={() => move(i, 1)} aria-label={tr('تأخير', 'Move down')}>▼</button>
                      </li>
                    ))}
                  </ol>
                )}
                {sel.length > 1 && t1 > 0 && <p className="hint">{tr('آخر شعار يبدأ بعد', 'The last mark starts after')} {num((sel.length - 1) * minutes)} {tr('دقيقة، وينتهي', 'minutes and ends')} {new Date(t1 + (sel.length - 1) * minutes * 60_000).toLocaleString(locale(), { timeZone: 'Asia/Riyadh', dateStyle: 'medium', timeStyle: 'short' })}.</p>}
              </>}
            </div>
            <button className="btn-gold mt-5 w-full" disabled={!sel.length || busy} onClick={async () => {
              setBusy(true)
              try {
                const res = await api.scheduleAuctions(sel, fromLocalInput(starts), fromLocalInput(ends), minutes)
                toast(tr(`فُتح المزاد لـ${namesCount(res.length)}`, `Auction opened for ${namesCount(res.length)}`))
                setSelList([]); reload()
              } catch (e) { toast((e as Error).message, 'bad') } finally { setBusy(false) }
            }}>{sel.length ? tr(`${stagger ? 'فتح بالتدريج' : 'فتح المزاد'} لـ${namesCount(sel.length)}`, `${stagger ? 'Open staggered' : 'Open auction'} for ${namesCount(sel.length)}`) : tr('اختر الأسماء', 'Select names')}</button>
          </aside>
        </div>
      ) : <Empty title={tr('لا توجد أسماء بانتظار فتح المزاد', 'No names awaiting an auction')}><p className="text-muted">{tr('تظهر هنا الأسماء بعد قبولها من اللجنة.', 'Names appear here once the committee accepts them.')}</p></Empty>}
    </>
  )
}

type AdminState = 'active' | 'live' | 'scheduled' | 'paused' | 'ended' | 'cancelled' | 'all'

export function AdminAuctions() {
  const [state, setState] = useState<AdminState>('active')
  const [type, setType] = useState<NameType | 'all'>('all')
  const { data, loading, reload } = useLoad(() => api.adminAuctions(state, type), [state, type], 10000)
  const rights = useAuctionRights()
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [dialog, setDialog] = useState<{ action: AuctionAction; scope: AuctionScope; label: string } | null>(null)
  const tf = useTableFilter(data, {
    fields: (a) => [a.name, a.winnerName, a.leaderLabel],
    filters: [
      { key: 'bids', label: tr('المزايدات', 'Bids'), options: [['', tr('الكل', 'All')], ['some', tr('عليها مزايدات', 'Has bids')], ['none', tr('بلا مزايدات', 'No bids')]], test: (a, v) => (v === 'some' ? a.bidCount > 0 : a.bidCount === 0) },
      { key: 'settle', label: tr('الترسية', 'Award'), options: [['', tr('الكل', 'All')], ['requester', tr('رست على مقدم الطلب', 'Awarded to applicant')], ['bidder', tr('رست على مزايد', 'Awarded to a bidder')], ['open', tr('لم تُرسَ', 'Not awarded')]], test: (a, v) => (v === 'open' ? !a.settled : a.settled && !a.cancelled && (v === 'requester') === !!a.wonByRequester) },
    ],
  })
  const open = (a: Auction) => !a.settled && !a.cancelled
  const showAward = state === 'ended' || state === 'cancelled' || state === 'all'
  const selectable = tf.list.filter(open)
  const chosen = (data ?? []).filter((a) => sel.has(a.id))
  const ask = (action: AuctionAction, list: Auction[]) => setDialog({ action, scope: { ids: list.map((a) => a.id) }, label: list.length === 1 ? tr(`«${list[0].name}»`, `“${list[0].name}”`) : tr(`${num(list.length)} مزادات`, `${num(list.length)} auctions`) })
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  return (
    <>
      <PageHead title={tr('التحكم في المزادات', 'Auction control')} sub={tr('أوقف مؤقتًا أو استأنف أو مدّد أو ألغِ مزادًا محددًا، أو حدّد عدة مزادات. للتطبيق على كل الشعارات مرة واحدة استخدم «الإعدادات ← المزادات».', 'Pause, resume, extend or cancel a specific auction, or select several. To apply to all marks at once, use “Settings → Auctions”.')} />
      <div className="mb-4 flex flex-wrap gap-3">
        <Segmented value={state} onChange={(v) => { setState(v); setSel(new Set()) }} options={[['active', tr('الحالية', 'Current')], ['live', tr('جارية', 'Live')], ['scheduled', tr('قادمة', 'Upcoming')], ['paused', tr('متوقفة', 'Paused')], ['ended', tr('منتهية', 'Ended')], ['cancelled', tr('ملغاة', 'Cancelled')], ['all', tr('الكل', 'All')]]} />
        <Segmented value={type} onChange={(v) => { setType(v); setSel(new Set()) }} options={typeOptions('all', tr('الكل', 'All'))} />
      </div>
      <TableTools t={tf} placeholder={tr('بحث باسم الشعار أو الفائز', 'Search by mark or winner')} />

      {chosen.length > 0 && (rights.manage || rights.cancel) && (
        <div className="sticky top-2 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-pine/30 bg-pine-soft px-4 py-3 shadow-card">
          <b className="me-2">{num(chosen.length)} {tr('محدد', 'selected')}</b>
          {rights.manage && <>
            <button className="btn-ghost btn-sm" onClick={() => ask('pause', chosen)}>{tr('إيقاف مؤقت', 'Pause')}</button>
            <button className="btn-ghost btn-sm" onClick={() => ask('resume', chosen)}>{tr('استئناف', 'Resume')}</button>
            <button className="btn-ghost btn-sm" onClick={() => ask('extend', chosen)}>{tr('تمديد', 'Extend')}</button>
          </>}
          {rights.cancel && <button className="btn-danger btn-sm" onClick={() => ask('cancel', chosen)}>{tr('إلغاء', 'Cancel')}</button>}
          <button className="ms-auto text-sm text-muted underline" onClick={() => setSel(new Set())}>{tr('إلغاء التحديد', 'Clear selection')}</button>
        </div>
      )}

      {loading && !data ? <Loading /> : data?.length ? (
        <div className="panel overflow-x-auto">
          <table className="tbl">
            <thead><tr>
              <th className="w-8">{selectable.length > 0 && <input type="checkbox" aria-label={tr('تحديد الكل', 'Select all')} checked={selectable.every((a) => sel.has(a.id))} onChange={(e) => setSel(e.target.checked ? new Set(selectable.map((a) => a.id)) : new Set())} />}</th>
              <th>{tr('الاسم', 'Name')}</th><th>{tr('الحالة', 'Status')}</th><th>{tr('السعر', 'Price')}</th><th>{tr('المزايدات', 'Bids')}</th><th>{tr('الوقت', 'Time')}</th>{showAward && <th>{tr('الترسية', 'Award')}</th>}<th></th>
            </tr></thead>
            <tbody>
              {!tf.list.length && <NoResults cols={showAward ? 8 : 7} onReset={tf.reset} />}
              {tf.list.map((a) => {
                const p = phaseOf(a)
                return (
                  <tr key={a.id} className={a.cancelled ? 'opacity-60' : ''}>
                    <td>{open(a) && <input type="checkbox" aria-label={tr(`تحديد ${a.name}`, `Select ${a.name}`)} checked={sel.has(a.id)} onChange={() => toggle(a.id)} />}</td>
                    <td><Link to={`/auctions/${a.id}`} className="flex items-center gap-2 font-extrabold text-lg hover:text-gold-deep"><TypeBadge type={a.type} />{a.name}</Link>{a.number && <span className="num text-[12px] text-muted">{a.number}</span>}</td>
                    <td><AuctionStatePill a={a} phase={p} />{(a.pauseReason || a.cancelReason) && <span className="mt-1 block max-w-[14rem] truncate text-[12.5px] text-muted" title={a.cancelReason || a.pauseReason}>{a.cancelReason || a.pauseReason}</span>}</td>
                    <td className="num whitespace-nowrap font-semibold">{sar(a.finalPrice ?? a.currentPrice)}</td>
                    <td className="num">{num(a.bidCount)}</td>
                    <td className="whitespace-nowrap text-sm">{a.paused ? <span className="text-muted">{tr('متوقف منذ', 'Paused since')} {dateTime(a.pausedAt!)}</span> : p === 'live' && !a.cancelled ? <Countdown to={a.endsAt} /> : p === 'scheduled' ? dateTime(a.startsAt) : dateTime(a.endsAt)}</td>
                    {showAward && <td className="text-sm">{a.cancelled ? tr('لا ترسية', 'No award') : a.settled ? <OwnerCell id={a.winnerId} name={a.winnerName ?? ''} note={a.wonByRequester && <span className="block text-[12px] text-muted">{tr('مقدم الطلب', 'Applicant')}</span>} /> : '—'}</td>}
                    <td className="whitespace-nowrap">
                      {open(a) && (rights.manage || rights.cancel) && (
                        <select className="field w-auto py-1.5 text-[14px]" value="" aria-label={tr(`إجراء على مزاد ${a.name}`, `Action on auction ${a.name}`)}
                          onChange={(e) => { const v = e.target.value as AuctionAction; if (v) ask(v, [a]) }}>
                          <option value="">{tr('إجراء…', 'Action…')}</option>
                          {rights.manage && (a.paused ? <option value="resume">{tr('استئناف', 'Resume')}</option> : <option value="pause">{tr('إيقاف مؤقت', 'Pause')}</option>)}
                          {rights.manage && <option value="extend">{tr('تمديد', 'Extend')}</option>}
                          {rights.cancel && <option value="cancel">{tr('إلغاء المزاد', 'Cancel auction')}</option>}
                        </select>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : <Empty title={tr('لا توجد مزادات بهذه التصفية', 'No auctions match this filter')} />}
      <AuctionActionDialog action={dialog?.action ?? null} scope={dialog?.scope ?? {}} label={dialog?.label ?? ''} onClose={() => setDialog(null)} onDone={() => { setSel(new Set()); reload() }} />
    </>
  )
}

export function AdminInvoices() {
  const { toast } = useApp()
  const { data, loading, reload } = useLoad(() => api.allInvoices(), [])
  const [view, setView] = useState<Invoice | null>(null)
  const tf = useTableFilter(data, {
    fields: (i) => [i.number, i.buyerName, i.buyerPhone, i.name, i.total],
    filters: [
      { key: 'status', label: tr('الحالة', 'Status'), options: [['', tr('الكل', 'All')], ['unpaid', tr('غير مدفوعة', 'Unpaid')], ['paid', tr('مدفوعة', 'Paid')]], test: (i, v) => i.status === v },
      { key: 'type', label: tr('النوع', 'Type'), options: typeOptions('', tr('الكل', 'All')), test: (x, v) => x.type === v },
    ],
  })
  const due = tf.list.filter((i) => i.status === 'unpaid').reduce((s, i) => s + i.amountDue, 0)
  return (
    <>
      <PageHead title={tr('الفواتير الإلكترونية', 'E-invoices')} />
      {loading && !data ? <Loading /> : data?.length ? (
        <>
        <TableTools t={tf} placeholder={tr('بحث برقم الفاتورة أو المشتري أو الاسم', 'Search by invoice no., buyer or name')}>
          {due > 0 && <span className="pill bg-gold-soft text-gold-deep">{tr('مستحق غير محصّل', 'Outstanding')} {sar(due)}</span>}
        </TableTools>
        <div className="panel overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>{tr('الفاتورة', 'Invoice')}</th><th>{tr('المشتري', 'Buyer')}</th><th>{tr('الاسم', 'Name')}</th><th>{tr('الإجمالي', 'Total')}</th><th>{tr('الضريبة', 'VAT')}</th><th>{tr('المستحق', 'Amount due')}</th><th>{tr('نصيب صاحب الاسم', 'Name holder’s share')}</th><th>{tr('الحالة', 'Status')}</th><th></th></tr></thead>
            <tbody>
              {!tf.list.length && <NoResults cols={9} onReset={tf.reset} />}
              {tf.list.map((i) => (
                <tr key={i.id}>
                  <td className="num font-semibold">{i.number}</td>
                  <td><OwnerCell id={i.userId} name={i.buyerName} /></td>
                  <td className="font-extrabold">{i.name}</td>
                  <td className="num">{sar(i.total)}</td>
                  <td className="num text-muted">{sar(i.vat)}</td>
                  <td className="num font-semibold">{sar(i.amountDue)}</td>
                  <td>{i.ownerShare ? <span className="whitespace-nowrap"><span className="num font-semibold text-invest-deep">{sar(i.ownerShare)}</span> <span className="text-[12.5px] text-muted">{i.ownerSharePaid ? tr('· حُوّل', '· Transferred') : tr('· بعد السداد', '· After payment')}</span></span> : <span className="text-muted">—</span>}</td>
                  <td><InvoiceStatus i={i} /></td>
                  <td className="whitespace-nowrap">
                    <button className="btn-ghost btn-sm" onClick={() => setView(i)}>{tr('عرض', 'View')}</button>
                    {i.status === 'unpaid' && <button className="btn-ghost btn-sm ms-1" onClick={async () => {
                      if (!confirm(tr('تسجيل سداد هذه الفاتورة نقدًا أو بتحويل بنكي؟', 'Record payment of this invoice in cash or by bank transfer?'))) return
                      try { await api.markInvoicePaid(i.id); toast(tr('سُجّل السداد', 'Payment recorded')); reload() } catch (e) { toast((e as Error).message, 'bad') }
                    }}>{tr('تسجيل سداد', 'Record payment')}</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      ) : <Empty title={tr('لا توجد فواتير بعد', 'No invoices yet')}><p className="text-muted">{tr('تُصدر الفاتورة تلقائيًا عند ترسية كل مزاد.', 'An invoice is issued automatically when each auction is awarded.')}</p></Empty>}
      <Modal open={!!view} onClose={() => setView(null)} title={tr('الفاتورة', 'Invoice')} wide>{view && <InvoiceDoc inv={view} />}</Modal>
    </>
  )
}

const EMPTY_EVENT: CamelEvent = { id: '', title: '', titleEn: '', kind: 'mazayin', startsOn: '', endsOn: '', approx: true, city: '', country: 'السعودية', description: '', url: '' }

export function AdminEvents() {
  const { toast } = useApp()
  const { data, loading, reload } = useLoad(() => api.listEvents(), [])
  const [edit, setEdit] = useState<CamelEvent | null>(null)
  const set = (k: keyof CamelEvent, v: string | boolean) => setEdit((e) => (e ? { ...e, [k]: v } : e))
  const today = new Date().toISOString().slice(0, 10)
  const tf = useTableFilter(data, {
    fields: (e) => [e.title, e.titleEn, e.city, e.country, e.startsOn],
    filters: [
      { key: 'kind', label: tr('النوع', 'Type'), options: [['', tr('الكل', 'All')], ...(Object.entries(EVENT_KIND) as [EventKind, { label: string }][]).map(([k, v]) => [k, v.label] as [string, string])], test: (e, v) => e.kind === v },
      { key: 'when', label: tr('الموعد', 'Date'), options: [['', tr('الكل', 'All')], ['upcoming', tr('قادمة', 'Upcoming')], ['now', tr('جارية الآن', 'Happening now')], ['past', tr('منتهية', 'Past')]], test: (e, v) => (v === 'past' ? e.endsOn < today : v === 'now' ? e.startsOn <= today && e.endsOn >= today : e.startsOn > today) },
      { key: 'approx', label: tr('الإعلان', 'Announcement'), options: [['', tr('الكل', 'All')], ['yes', tr('موعد متوقع', 'Expected date')], ['no', tr('معلن رسميًا', 'Officially announced')]], test: (e, v) => e.approx === (v === 'yes') },
    ],
  })
  return (
    <>
      <PageHead title={tr('المواعيد والفعاليات', 'Events & schedule')} sub={tr('تظهر في تقويم المنصة وصفحتها الرئيسية. ألغِ علامة «موعد متوقع» عند الإعلان الرسمي.', 'Shown in the platform calendar and on the home page. Untick “Expected date” once officially announced.')}
        action={<button className="btn-gold" onClick={() => setEdit({ ...EMPTY_EVENT })}>{tr('إضافة فعالية', 'Add event')}</button>} />
      {loading && !data ? <Loading /> : data?.length ? (
        <>
        <TableTools t={tf} placeholder={tr('بحث باسم الفعالية أو المدينة', 'Search by event name or city')} />
        <div className="panel overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>{tr('الفعالية', 'Event')}</th><th>{tr('النوع', 'Type')}</th><th>{tr('من', 'From')}</th><th>{tr('إلى', 'To')}</th><th>{tr('المكان', 'Location')}</th><th>{tr('الحالة', 'Status')}</th><th></th></tr></thead>
            <tbody>
              {!tf.list.length && <NoResults cols={7} onReset={tf.reset} />}
              {tf.list.map((e) => (
                <tr key={e.id}>
                  <td className="font-bold">{e.title}</td>
                  <td><span className={`pill ${EVENT_KIND[e.kind].cls}`}>{EVENT_KIND[e.kind].label}</span></td>
                  <td className="num whitespace-nowrap">{e.startsOn}</td>
                  <td className="num whitespace-nowrap">{e.endsOn}</td>
                  <td className="text-muted">{e.city}{tr('، ', ', ')}{e.country}</td>
                  <td>{e.approx ? <span className="pill border border-dashed border-gold text-gold-deep">{tr('متوقع', 'Expected')}</span> : <span className="pill bg-[#E2F0E8] text-ok">{tr('معلن رسميًا', 'Officially announced')}</span>}</td>
                  <td className="whitespace-nowrap">
                    <button className="btn-ghost btn-sm" onClick={() => setEdit({ ...e, url: e.url ?? '' })}>{tr('تعديل', 'Edit')}</button>
                    <button className="btn-ghost btn-sm ms-1 text-bad" onClick={async () => {
                      if (!confirm(tr(`حذف «${e.title}» من التقويم؟`, `Delete “${e.title}” from the calendar?`))) return
                      try { await api.deleteEvent(e.id); toast(tr('حُذفت الفعالية', 'Event deleted')); reload() } catch (x) { toast((x as Error).message, 'bad') }
                    }}>{tr('حذف', 'Delete')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      ) : <Empty title={tr('لا توجد فعاليات', 'No events')}><button className="btn-gold btn-sm" onClick={() => setEdit({ ...EMPTY_EVENT })}>{tr('إضافة فعالية', 'Add event')}</button></Empty>}

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? tr('تعديل فعالية', 'Edit event') : tr('إضافة فعالية', 'Add event')} wide>
        {edit && (
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={async (ev) => {
            ev.preventDefault()
            try { await api.saveEvent({ ...edit, url: edit.url || undefined }); toast(tr('حُفظت الفعالية', 'Event saved')); setEdit(null); reload() } catch (x) { toast((x as Error).message, 'bad') }
          }}>
            <div className="sm:col-span-2"><label className="label" htmlFor="et">{tr('اسم الفعالية', 'Event name')}</label><input id="et" className="field" value={edit.title} onChange={(e) => set('title', e.target.value)} required /></div>
            <div><label className="label" htmlFor="ete">{tr('الاسم بالإنجليزية', 'English name')}</label><input id="ete" className="field" dir="ltr" value={edit.titleEn} onChange={(e) => set('titleEn', e.target.value)} /></div>
            <div><label className="label" htmlFor="ek">{tr('النوع', 'Type')}</label>
              <select id="ek" className="field" value={edit.kind} onChange={(e) => set('kind', e.target.value)}>
                {(Object.keys(EVENT_KIND) as EventKind[]).map((k) => <option key={k} value={k}>{EVENT_KIND[k].label}</option>)}
              </select>
            </div>
            <div><label className="label" htmlFor="es">{tr('من', 'From')}</label><input id="es" type="date" className="field num" value={edit.startsOn} onChange={(e) => set('startsOn', e.target.value)} required /></div>
            <div><label className="label" htmlFor="ee">{tr('إلى', 'To')}</label><input id="ee" type="date" className="field num" value={edit.endsOn} onChange={(e) => set('endsOn', e.target.value)} required /></div>
            <div><label className="label" htmlFor="ec">{tr('المدينة أو الموقع', 'City or venue')}</label><input id="ec" className="field" value={edit.city} onChange={(e) => set('city', e.target.value)} /></div>
            <div><label className="label" htmlFor="eco">{tr('الدولة', 'Country')}</label><input id="eco" className="field" value={edit.country} onChange={(e) => set('country', e.target.value)} /></div>
            <div className="sm:col-span-2"><label className="label" htmlFor="ed">{tr('الوصف', 'Description')}</label><textarea id="ed" className="field" rows={3} value={edit.description} onChange={(e) => set('description', e.target.value)} /></div>
            <div className="sm:col-span-2"><label className="label" htmlFor="eu">{tr('رابط رسمي (اختياري)', 'Official link (optional)')}</label><input id="eu" className="field" dir="ltr" value={edit.url ?? ''} onChange={(e) => set('url', e.target.value)} /></div>
            <label className="flex items-center gap-2 text-[15px] font-bold sm:col-span-2"><input type="checkbox" checked={edit.approx} onChange={(e) => set('approx', e.target.checked)} />{tr('موعد متوقع (لم يُعلن رسميًا بعد)', 'Expected date (not yet officially announced)')}</label>
            <button className="btn-primary sm:col-span-2">{tr('حفظ', 'Save')}</button>
          </form>
        )}
      </Modal>
    </>
  )
}
