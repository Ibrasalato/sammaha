import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../../components/dash'
import { OWNER_COLUMNS, OwnerCell, ownerColumns, useOwners } from '../../components/OwnerCell'
import { Empty, ErrorBox, Loading, Modal, PageHead, RequestStatusPill, Segmented, TypeBadge } from '../../components/ui'
import { TableTools, useTableFilter } from '../../components/TableTools'
import { TYPE_LABEL, typeOptions } from '../../lib/config'
import { date, num, sar } from '../../lib/format'
import { RELATION_LABEL } from '../../lib/names'
import { can } from '../../lib/permissions'
import { downloadCsv } from '../../lib/print'
import { usePrint } from '../../components/usePrint'
import { api, useApp, useLoad } from '../../lib/store'
import type { AuditRow, LogoRequest, NameType, RequestStatus, ReviewDecision } from '../../lib/types'
import { tr } from '../../lib/i18n'
import { localizeServerText as L } from '../../lib/serverText'

const SOURCE: Record<string, string> = {
  get reserved() { return tr('مسجل', 'Registered') },
  get auction() { return tr('في مزاد', 'In auction') },
  get request() { return tr('طلب آخر', 'Another request') },
}
const exactOf = (r: LogoRequest, id: string) => r.candidates.find((c) => c.id === id)?.similar.find((h) => h.score === 1)

/** one request: a row per name with its decision, and the request's actions */
function RequestBlock({ r, audit, onDone }: { r: LogoRequest; audit: Map<string, AuditRow>; onDone: () => void }) {
  const { user, toast } = useApp()
  const review = r.status === 'under_review' && can(user, 'requests.review')
  const [dec, setDec] = useState<Record<string, ReviewDecision>>(() => Object.fromEntries(r.candidates.filter((c) => c.status === 'pending' && exactOf(r, c.id)).map((c) => [c.id, { candidateId: c.id, status: 'rejected', reason: `مطابق لـ«${exactOf(r, c.id)!.name}»` }])))
  const [busy, setBusy] = useState(false)
  const [action, setAction] = useState<'reject' | 'cancel' | null>(null)
  const [reason, setReason] = useState('')
  const open = r.candidates.filter((c) => c.status !== 'withdrawn')
  const single = (r.kind ?? 'standard') === 'standard'
  /** one name per logo request: accepting it rejects the others */
  function accept(id: string) {
    const name = r.candidates.find((c) => c.id === id)?.name
    if (!single) { setDec({ ...dec, [id]: { candidateId: id, status: 'accepted' } }); return }
    setDec(Object.fromEntries(open.map((c) => [c.id, c.id === id ? { candidateId: c.id, status: 'accepted' } : { candidateId: c.id, status: 'rejected', reason: dec[c.id]?.status === 'rejected' && !dec[c.id]?.reason?.startsWith('قُبل «') ? dec[c.id].reason : `قُبل «${name}» من هذا الطلب (شعار واحد لكل طلب)` }])))
  }
  const decided = open.every((c) => dec[c.id]?.status)
  const span = Math.max(open.length, 1) + (review ? 1 : 0)

  async function run(p: () => Promise<unknown>, msg: string) {
    setBusy(true)
    try { await p(); toast(msg); onDone() } catch (e) { toast((e as Error).message, 'bad') } finally { setBusy(false) }
  }

  return (
    <tbody className="border-t-2 border-line">
      {r.candidates.map((c, i) => {
        const a = audit.get(c.id)
        const top = a?.topPrice
        const d = dec[c.id]
        const exact = !!exactOf(r, c.id) || a?.verdict === 'exact'
        const best = a?.matches[0]
        return (
          <tr key={c.id} className={c.status === 'withdrawn' ? 'opacity-50' : ''}>
            {i === 0 && <>
              <td rowSpan={span} className="align-top">
                <Link to={`/admin/requests/${r.id}`} className="num font-semibold underline-offset-4 hover:underline">{r.number}</Link>
                {r.kind === 'compound' && <span className="pill mt-1 block w-fit bg-gold-soft text-gold-deep">{tr('اسم مركب', 'Compound name')}</span>}
                {r.kind === 'investment' && <span className="pill mt-1 block w-fit bg-invest-soft text-invest-deep">{tr('استثمار الاسم', 'Name investment')}</span>}
                <span className="mt-1 block text-[12.5px] text-muted">{date(r.submittedAt ?? r.createdAt)}</span>
              </td>
              <td rowSpan={span} className="align-top"><OwnerCell id={r.userId} name={r.ownerName} /><span className="mt-1 block"><TypeBadge type={r.type} /></span></td>
            </>}
            <td className="font-extrabold text-[16px]">{c.name}</td>
            <td className="text-[13px]">
              {a ? (a.verdict === 'clear' ? <span className="text-ok">{tr('لا تشابه', 'No similarity')}</span> : (
                <span className={a.verdict === 'exact' ? 'font-bold text-bad' : 'text-warn'}>
                  {best ? `${RELATION_LABEL[best.relation]} «${best.name}»` : ''}{a.matches.length > 1 ? <span className="text-muted"> +{num(a.matches.length - 1)}</span> : null}
                </span>
              )) : c.similar.length ? <span className={exact ? 'font-bold text-bad' : 'text-warn'}>{exact ? tr('مطابق', 'Exact match') : tr('مشابه', 'Similar')} «{c.similar[0].name}»{c.similar.length > 1 ? ` +${c.similar.length - 1}` : ''}</span> : <span className="text-ok">{tr('لا تشابه', 'No similarity')}</span>}
            </td>
            <td className="whitespace-nowrap text-[13px]">{top ? <><b className="num">{sar(top.price ?? 0)}</b><span className="block text-muted">«{top.name}» · {TYPE_LABEL[top.type]}</span></> : <span className="text-muted">—</span>}</td>
            <td className="whitespace-nowrap">
              {c.status === 'withdrawn' ? <span className="pill bg-stone-deep text-muted">{tr('سحبه المالك', 'Withdrawn by owner')}</span>
                : review && c.status === 'pending' ? (
                  <div className="space-y-1.5">
                    <div className="flex gap-1">
                      <button type="button" aria-pressed={d?.status === 'accepted'} disabled={exact || busy} title={exact ? tr('مطابق لاسم موجود', 'Matches an existing name') : ''}
                        className={`btn btn-sm border px-3 ${d?.status === 'accepted' ? 'border-ok bg-ok text-paper' : 'border-line bg-paper'} disabled:opacity-40`}
                        onClick={() => accept(c.id)}>{tr('قبول', 'Accept')}</button>
                      <button type="button" aria-pressed={d?.status === 'rejected'} disabled={busy}
                        className={`btn btn-sm border px-3 ${d?.status === 'rejected' ? 'border-bad bg-bad text-paper' : 'border-line bg-paper'}`}
                        onClick={() => setDec({ ...dec, [c.id]: { candidateId: c.id, status: 'rejected', reason: d?.reason || (best ? `مشابه لـ«${best.name}»` : 'مشابه لاسم مسجل') } })}>{tr('رفض', 'Reject')}</button>
                    </div>
                    {d?.status === 'rejected' && <input className="field py-1 text-[13px]" aria-label={tr(`سبب رفض ${c.name}`, `Rejection reason for ${c.name}`)} value={d.reason ?? ''} onChange={(e) => setDec({ ...dec, [c.id]: { ...d, reason: e.target.value } })} />}
                  </div>
                ) : (
                  <div>
                    <span className={`pill ${c.status === 'accepted' ? 'bg-ok/10 text-ok' : c.status === 'rejected' ? 'bg-bad/10 text-bad' : 'bg-stone-deep text-muted'}`}>{c.status === 'accepted' ? tr('مقبول', 'Accepted') : c.status === 'rejected' ? tr('مرفوض', 'Rejected') : tr('بانتظار المراجعة', 'Awaiting review')}</span>
                    {c.rejectReason && <span className="mt-1 block max-w-[14rem] whitespace-normal text-[12.5px] text-bad">{L(c.rejectReason)}</span>}
                    {c.exceptedAt && <span className="mt-1 block text-[12.5px] font-semibold text-gold-deep">{tr('سُجّل دون مزاد', 'Registered without auction')}{c.exceptionFee != null ? ` · ${c.exceptionFee}` : ''}</span>}
                    {c.auctionId && <Link to={`/auctions/${c.auctionId}`} className="mt-1 block text-[12.5px] font-semibold text-gold-deep underline">{tr('صفحة المزاد', 'Auction page')}</Link>}
                  </div>
                )}
            </td>
            {i === 0 && <td rowSpan={span} className="align-top"><RequestStatusPill status={r.status} /></td>}
          </tr>
        )
      })}
      {review && (
        <tr className="bg-stone/40">
          <td colSpan={4} className="py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <button className="btn-primary btn-sm" disabled={!decided || busy} onClick={() => run(() => api.reviewRequest(r.id, Object.values(dec)), tr('اعتُمد قرار اللجنة', 'Committee decision approved'))}>
                {decided ? tr('اعتماد القرار', 'Approve decision') : tr(`حدّد القرار لكل الأسماء (${num(open.filter((c) => dec[c.id]?.status).length)}/${num(open.length)})`, `Decide on every name (${num(open.filter((c) => dec[c.id]?.status).length)}/${num(open.length)})`)}
              </button>
              {single ? <span className="text-[12.5px] text-muted">{tr('يُقبل شعار واحد فقط من الطلب، وقبوله يرفض البقية', 'Only one mark per request can be accepted; accepting it rejects the rest')}</span>
                : <button className="btn-ghost btn-sm" disabled={busy} onClick={() => setDec(Object.fromEntries(open.filter((c) => !exactOf(r, c.id) && audit.get(c.id)?.verdict !== 'exact').map((c) => [c.id, { candidateId: c.id, status: 'accepted' }]).concat(Object.entries(dec).filter(([, v]) => v.status === 'rejected'))))}>{tr('قبول غير المطابق', 'Accept non-matching')}</button>}
              <button className="btn-danger btn-sm" disabled={busy} onClick={() => { setAction('reject'); setReason('') }}>{tr('رفض الطلب كاملًا', 'Reject entire request')}</button>
              {can(user, 'requests.cancel') && <button className="btn-ghost btn-sm" disabled={busy} onClick={() => { setAction('cancel'); setReason('') }}>{tr('إلغاء الطلب', 'Cancel request')}</button>}
              <Link to={`/admin/requests/${r.id}`} className="ms-auto text-[13px] font-semibold text-gold-deep underline">{tr('التفاصيل والمقارنة', 'Details and comparison')}</Link>
            </div>
            <Modal open={!!action} onClose={() => setAction(null)} title={action === 'reject' ? tr(`رفض الطلب ${r.number}`, `Reject request ${r.number}`) : tr(`إلغاء الطلب ${r.number}`, `Cancel request ${r.number}`)}>
              <label className="label" htmlFor={`rs-${r.id}`}>{tr('السبب (يظهر للمالك)', 'Reason (shown to the owner)')}</label>
              <textarea id={`rs-${r.id}`} className="field" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
              <p className="hint">{r.kind === 'investment' ? tr('رسوم الدراسة لا تُعاد.', 'The study fee is non-refundable.') : tr(`يُعاد الضمان ${sar(r.depositAmount)} إلى محفظة المالك.`, `The ${sar(r.depositAmount)} guarantee is returned to the owner’s wallet.`)}</p>
              <button className={`${action === 'reject' ? 'btn-danger' : 'btn-primary'} mt-4 w-full`} disabled={!reason.trim() || busy}
                onClick={() => { const a = action; setAction(null); run(() => (a === 'reject' ? api.rejectRequest(r.id, reason) : api.cancelRequest(r.id, reason)), a === 'reject' ? tr('رُفض الطلب', 'Request rejected') : tr('أُلغي الطلب', 'Request cancelled')) }}>
                {action === 'reject' ? tr('رفض الطلب', 'Reject request') : tr('إلغاء الطلب', 'Cancel request')}
              </button>
            </Modal>
          </td>
        </tr>
      )}
    </tbody>
  )
}

/** printable audit of requested names */
function AuditReport({ rows, status, type }: { rows: AuditRow[]; status: string; type: string }) {
  const print = usePrint()
  const owners = useOwners()
  const ref = useRef<HTMLDivElement>(null)
  const [only, setOnly] = useState<'all' | 'flagged'>('flagged')
  const list = rows.filter((r) => r.status !== 'withdrawn' && (only === 'all' || r.verdict !== 'clear'))
  const exact = rows.filter((r) => r.verdict === 'exact').length
  const similar = rows.filter((r) => r.verdict === 'similar').length
  const statusLabel = { under_review: tr('تحت المراجعة', 'Under review'), accepted: tr('مقبولة', 'Accepted'), rejected: tr('مرفوضة', 'Rejected'), cancelled: tr('ملغاة', 'Cancelled'), all: tr('كل الحالات', 'All statuses') }[status] ?? status
  const typeText = type === 'all' ? tr('الكل', 'All') : TYPE_LABEL[type as NameType]
  const subtitle = tr(`الطلبات: ${statusLabel} · الفئة: ${typeText} · ${num(rows.length)} اسم: ${num(exact)} مطابق، ${num(similar)} مشابه`,
    `Requests: ${statusLabel} · Category: ${typeText} · ${num(rows.length)} names: ${num(exact)} exact, ${num(similar)} similar`)
  return (
    <section className="panel mt-8 overflow-hidden">
      <header className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-pine-soft text-pine"><Icon name="shield" className="h-[18px] w-[18px]" /></span>
        <div className="min-w-[14rem] flex-1">
          <h2 className="text-[18px]">{tr('تقرير تدقيق الشعارات', 'Mark audit report')}</h2>
          <p className="text-[13.5px] text-muted">{tr('كل اسم مطلوب مقابل السجلات: المطابق، وبـ«ال» أو بدونها، والمذكر والمؤنث، والجمع والمفرد، والمشابه. مع أعلى سعر بيع لشعار مشابه.', 'Each requested name checked against the records: exact, with or without “Al”, masculine/feminine, singular/plural, and similar — with the highest sale price of a similar mark.')}</p>
        </div>
        <Segmented value={only} onChange={setOnly} options={[['flagged', tr(`فيها تطابق أو تشابه (${num(exact + similar)})`, `Matches or similar (${num(exact + similar)})`)], ['all', tr('كل الأسماء', 'All names')]]} />
        <button className="btn-ghost btn-sm" onClick={() => downloadCsv(`${tr('تدقيق-الشعارات', 'mark-audit')}-${new Date().toISOString().slice(0, 10)}.csv`, [
          [tr('الطلب', 'Request'), tr('المالك', 'Owner'), ...OWNER_COLUMNS, tr('الفئة', 'Category'), tr('الاسم المطلوب', 'Requested name'), tr('النتيجة', 'Result'), tr('المطابق والمشابه', 'Exact and similar'), tr('أعلى سعر لشعار مشابه', 'Highest price of a similar mark'), tr('الشعار صاحب أعلى سعر', 'Highest-priced mark'), tr('القرار', 'Decision')],
          ...list.map((r) => [r.number, r.ownerName, ...ownerColumns(owners.get(r.ownerId)), TYPE_LABEL[r.type], r.name, r.verdict === 'exact' ? tr('مطابق', 'Exact match') : r.verdict === 'similar' ? tr('مشابه', 'Similar') : tr('لا تشابه', 'No similarity'),
            r.matches.map((m) => `${m.name} (${RELATION_LABEL[m.relation]} ${Math.round(m.score * 100)}%)`).join(' | '), r.topPrice?.price ?? '', r.topPrice ? `${r.topPrice.name} · ${TYPE_LABEL[r.topPrice.type]}` : '',
            r.status === 'accepted' ? tr('مقبول', 'Accepted') : r.status === 'rejected' ? tr(`مرفوض: ${r.rejectReason ?? ''}`, `Rejected: ${r.rejectReason ?? ''}`) : tr('بانتظار', 'Pending')])])}>{tr('تصدير Excel', 'Export to Excel')}</button>
        <button className="btn-primary btn-sm" onClick={() => print({ title: tr('تقرير تدقيق الشعارات', 'Mark audit report'), subtitle, el: ref.current, landscape: true })}><Icon name="file" className="h-4 w-4" />{tr('طباعة التقرير', 'Print report')}</button>
      </header>
      <div ref={ref} className="overflow-x-auto">
        {list.length ? (
          <table className="tbl">
            <thead><tr><th>#</th><th>{tr('الطلب', 'Request')}</th><th>{tr('المالك', 'Owner')}</th><th>{tr('الفئة', 'Category')}</th><th>{tr('الاسم المطلوب', 'Requested name')}</th><th>{tr('النتيجة', 'Result')}</th><th>{tr('المطابق والمشابه في السجلات', 'Exact and similar in the records')}</th><th>{tr('أعلى سعر لشعار مشابه', 'Highest price of a similar mark')}</th><th>{tr('القرار', 'Decision')}</th></tr></thead>
            <tbody>
              {list.map((r, i) => (
                <tr key={r.candidateId}>
                  <td className="num text-muted">{num(i + 1)}</td>
                  <td className="num whitespace-nowrap font-semibold">{r.number}</td>
                  <td><OwnerCell id={r.ownerId} name={r.ownerName} /></td>
                  <td className="whitespace-nowrap">{TYPE_LABEL[r.type]}</td>
                  <td className="font-extrabold text-[15px]">{r.name}</td>
                  <td><span className={`pill ${r.verdict === 'exact' ? 'bg-bad/10 text-bad' : r.verdict === 'similar' ? 'bg-gold-soft text-gold-deep' : 'bg-[#E2F0E8] text-ok'}`}>{r.verdict === 'exact' ? tr('مطابق', 'Exact match') : r.verdict === 'similar' ? tr('مشابه', 'Similar') : tr('لا تشابه', 'No similarity')}</span></td>
                  <td className="min-w-[16rem]">
                    {r.matches.length ? (
                      <ul className="space-y-1">
                        {r.matches.map((m) => (
                          <li key={m.name + m.source + m.type} className="flex flex-wrap items-baseline gap-x-1.5 text-[13px]">
                            <b className={m.score >= 1 ? 'text-bad' : ''}>{m.name}</b>
                            <span className="text-muted">{RELATION_LABEL[m.relation]}{m.relation === 'similar' ? ` ${Math.round(m.score * 100)}%` : ''} · {TYPE_LABEL[m.type]} · {SOURCE[m.source]}</span>
                            {m.price ? <span className="num">· {sar(m.price)}{m.priceKind === 'current' ? tr(' (سعر حالي)', ' (current price)') : ''}</span> : null}
                          </li>
                        ))}
                      </ul>
                    ) : <span className="text-muted">—</span>}
                  </td>
                  <td className="whitespace-nowrap">{r.topPrice ? <><b className="num text-[15px]">{sar(r.topPrice.price ?? 0)}</b><span className="block text-[12.5px] text-muted">«{r.topPrice.name}» · {TYPE_LABEL[r.topPrice.type]}{r.topPrice.at ? ` · ${date(r.topPrice.at)}` : ''}</span></> : <span className="text-muted">—</span>}</td>
                  <td className="text-[13px]">{r.status === 'accepted' ? <span className="text-ok">{tr('مقبول', 'Accepted')}</span> : r.status === 'rejected' ? <span className="text-bad">{tr('مرفوض', 'Rejected')}{r.rejectReason ? `: ${L(r.rejectReason)}` : ''}</span> : <span className="text-muted">{tr('بانتظار', 'Pending')}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="px-5 py-10 text-center text-muted">{tr('لا توجد أسماء مطابقة أو مشابهة بهذه التصفية.', 'No exact or similar names match this filter.')}</p>}
      </div>
    </section>
  )
}

export function AdminRequestsBoard() {
  const { user } = useApp()
  const [status, setStatus] = useState<RequestStatus | 'all'>('under_review')
  const [type, setType] = useState<NameType | 'all'>('all')
  const { data, loading, reload, error } = useLoad(() => api.listRequests(status), [status])
  const canAudit = can(user, 'requests.audit')
  const audit = useLoad(() => (canAudit ? api.requestsAudit(status, type) : Promise.resolve([] as AuditRow[])), [status, type, canAudit])
  const byCandidate = useMemo(() => new Map((audit.data ?? []).map((a) => [a.candidateId, a])), [audit.data])
  const rows = useMemo(() => (data ?? []).filter((r) => type === 'all' || r.type === type), [data, type])
  const tf = useTableFilter(rows, {
    fields: (r) => [r.number, r.ownerName, ...r.candidates.map((c) => c.name)],
    filters: [
      { key: 'kind', label: tr('الطلب', 'Request'), options: [['', tr('الكل', 'All')], ['standard', tr('طلب شعار', 'Mark request')], ['compound', tr('اسم مركب', 'Compound name')], ['investment', tr('استثمار الاسم', 'Name investment')]], test: (r, v) => (r.kind ?? 'standard') === v },
      { key: 'similar', label: tr('التشابه', 'Similarity'), options: [['', tr('الكل', 'All')], ['yes', tr('فيها أسماء شبيهة', 'Has similar names')], ['no', tr('بلا تشابه', 'No similarity')]], test: (r, v) => r.candidates.some((c) => c.similar.length || (byCandidate.get(c.id)?.matches.length ?? 0) > 0) === (v === 'yes') },
    ],
  })
  const refresh = () => { reload(); audit.reload() }
  return (
    <>
      <PageHead title={tr('طلبات الشعارات', 'Mark requests')} sub={tr('القرار بجانب كل اسم: اقبل أو ارفض كل اسم ثم اعتمد القرار، أو ارفض الطلب كاملًا أو ألغه. التفاصيل الكاملة من رقم الطلب.', 'Decide beside each name: accept or reject each one, then approve the decision — or reject or cancel the whole request. Full details via the request number.')} />
      <div className="mb-4 flex flex-wrap gap-3">
        <Segmented value={status} onChange={setStatus} options={[['under_review', tr('تحت المراجعة', 'Under review')], ['accepted', tr('مقبولة', 'Accepted')], ['rejected', tr('مرفوضة', 'Rejected')], ['cancelled', tr('ملغاة', 'Cancelled')], ['all', tr('الكل', 'All')]]} />
        <Segmented value={type} onChange={setType} options={typeOptions('all', tr('الكل', 'All'))} />
      </div>
      <TableTools t={tf} placeholder={tr('بحث برقم الطلب أو المالك أو الاسم', 'Search by request no., owner or name')} />
      {error && <ErrorBox text={error} />}
      {loading && !data ? <Loading /> : tf.list.length ? (
        <div className="panel overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>{tr('الطلب', 'Request')}</th><th>{tr('المالك', 'Owner')}</th><th>{tr('الاسم', 'Name')}</th><th>{tr('التدقيق', 'Audit')}</th><th>{tr('أعلى سعر مشابه', 'Highest similar price')}</th><th>{tr('القرار', 'Decision')}</th><th>{tr('الحالة', 'Status')}</th></tr></thead>
            {tf.list.map((r) => <RequestBlock key={`${r.id}-${r.status}`} r={r} audit={byCandidate} onDone={refresh} />)}
          </table>
        </div>
      ) : <Empty title={tr('لا توجد طلبات بهذه التصفية', 'No requests match this filter')} />}
      {canAudit && (audit.loading && !audit.data ? <Loading /> : <AuditReport rows={audit.data ?? []} status={status} type={type} />)}
    </>
  )
}
