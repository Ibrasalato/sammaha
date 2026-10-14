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

const SOURCE: Record<string, string> = { reserved: 'مسجل', auction: 'في مزاد', request: 'طلب آخر' }
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
                {r.kind === 'compound' && <span className="pill mt-1 block w-fit bg-gold-soft text-gold-deep">اسم مركب</span>}
                {r.kind === 'investment' && <span className="pill mt-1 block w-fit bg-invest-soft text-invest-deep">استثمار الاسم</span>}
                <span className="mt-1 block text-[12.5px] text-muted">{date(r.submittedAt ?? r.createdAt)}</span>
              </td>
              <td rowSpan={span} className="align-top"><OwnerCell id={r.userId} name={r.ownerName} /><span className="mt-1 block"><TypeBadge type={r.type} /></span></td>
            </>}
            <td className="font-extrabold text-[16px]">{c.name}</td>
            <td className="text-[13px]">
              {a ? (a.verdict === 'clear' ? <span className="text-ok">لا تشابه</span> : (
                <span className={a.verdict === 'exact' ? 'font-bold text-bad' : 'text-warn'}>
                  {best ? `${RELATION_LABEL[best.relation]} «${best.name}»` : ''}{a.matches.length > 1 ? <span className="text-muted"> +{num(a.matches.length - 1)}</span> : null}
                </span>
              )) : c.similar.length ? <span className={exact ? 'font-bold text-bad' : 'text-warn'}>{exact ? 'مطابق' : 'مشابه'} «{c.similar[0].name}»{c.similar.length > 1 ? ` +${c.similar.length - 1}` : ''}</span> : <span className="text-ok">لا تشابه</span>}
            </td>
            <td className="whitespace-nowrap text-[13px]">{top ? <><b className="num">{sar(top.price ?? 0)}</b><span className="block text-muted">«{top.name}» · {TYPE_LABEL[top.type]}</span></> : <span className="text-muted">—</span>}</td>
            <td className="whitespace-nowrap">
              {c.status === 'withdrawn' ? <span className="pill bg-stone-deep text-muted">سحبه المالك</span>
                : review && c.status === 'pending' ? (
                  <div className="space-y-1.5">
                    <div className="flex gap-1">
                      <button type="button" aria-pressed={d?.status === 'accepted'} disabled={exact || busy} title={exact ? 'مطابق لاسم موجود' : ''}
                        className={`btn btn-sm border px-3 ${d?.status === 'accepted' ? 'border-ok bg-ok text-paper' : 'border-line bg-paper'} disabled:opacity-40`}
                        onClick={() => accept(c.id)}>قبول</button>
                      <button type="button" aria-pressed={d?.status === 'rejected'} disabled={busy}
                        className={`btn btn-sm border px-3 ${d?.status === 'rejected' ? 'border-bad bg-bad text-paper' : 'border-line bg-paper'}`}
                        onClick={() => setDec({ ...dec, [c.id]: { candidateId: c.id, status: 'rejected', reason: d?.reason || (best ? `مشابه لـ«${best.name}»` : 'مشابه لاسم مسجل') } })}>رفض</button>
                    </div>
                    {d?.status === 'rejected' && <input className="field py-1 text-[13px]" aria-label={`سبب رفض ${c.name}`} value={d.reason ?? ''} onChange={(e) => setDec({ ...dec, [c.id]: { ...d, reason: e.target.value } })} />}
                  </div>
                ) : (
                  <div>
                    <span className={`pill ${c.status === 'accepted' ? 'bg-ok/10 text-ok' : c.status === 'rejected' ? 'bg-bad/10 text-bad' : 'bg-stone-deep text-muted'}`}>{c.status === 'accepted' ? 'مقبول' : c.status === 'rejected' ? 'مرفوض' : 'بانتظار المراجعة'}</span>
                    {c.rejectReason && <span className="mt-1 block max-w-[14rem] whitespace-normal text-[12.5px] text-bad">{c.rejectReason}</span>}
                    {c.auctionId && <Link to={`/auctions/${c.auctionId}`} className="mt-1 block text-[12.5px] font-semibold text-gold-deep underline">صفحة المزاد</Link>}
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
              <button className="btn-primary btn-sm" disabled={!decided || busy} onClick={() => run(() => api.reviewRequest(r.id, Object.values(dec)), 'اعتُمد قرار اللجنة')}>
                {decided ? 'اعتماد القرار' : `حدّد القرار لكل الأسماء (${num(open.filter((c) => dec[c.id]?.status).length)}/${num(open.length)})`}
              </button>
              {single ? <span className="text-[12.5px] text-muted">يُقبل شعار واحد فقط من الطلب، وقبوله يرفض البقية</span>
                : <button className="btn-ghost btn-sm" disabled={busy} onClick={() => setDec(Object.fromEntries(open.filter((c) => !exactOf(r, c.id) && audit.get(c.id)?.verdict !== 'exact').map((c) => [c.id, { candidateId: c.id, status: 'accepted' }]).concat(Object.entries(dec).filter(([, v]) => v.status === 'rejected'))))}>قبول غير المطابق</button>}
              <button className="btn-danger btn-sm" disabled={busy} onClick={() => { setAction('reject'); setReason('') }}>رفض الطلب كاملًا</button>
              {can(user, 'requests.cancel') && <button className="btn-ghost btn-sm" disabled={busy} onClick={() => { setAction('cancel'); setReason('') }}>إلغاء الطلب</button>}
              <Link to={`/admin/requests/${r.id}`} className="ms-auto text-[13px] font-semibold text-gold-deep underline">التفاصيل والمقارنة</Link>
            </div>
            <Modal open={!!action} onClose={() => setAction(null)} title={`${action === 'reject' ? 'رفض' : 'إلغاء'} الطلب ${r.number}`}>
              <label className="label" htmlFor={`rs-${r.id}`}>السبب (يظهر للمالك)</label>
              <textarea id={`rs-${r.id}`} className="field" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
              <p className="hint">{r.kind === 'investment' ? 'رسوم الدراسة لا تُعاد.' : `يُعاد الضمان ${sar(r.depositAmount)} إلى محفظة المالك.`}</p>
              <button className={`${action === 'reject' ? 'btn-danger' : 'btn-primary'} mt-4 w-full`} disabled={!reason.trim() || busy}
                onClick={() => { const a = action; setAction(null); run(() => (a === 'reject' ? api.rejectRequest(r.id, reason) : api.cancelRequest(r.id, reason)), a === 'reject' ? 'رُفض الطلب' : 'أُلغي الطلب') }}>
                {action === 'reject' ? 'رفض الطلب' : 'إلغاء الطلب'}
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
  const statusLabel = { under_review: 'تحت المراجعة', accepted: 'مقبولة', rejected: 'مرفوضة', cancelled: 'ملغاة', all: 'كل الحالات' }[status] ?? status
  const subtitle = `الطلبات: ${statusLabel} · الفئة: ${type === 'all' ? 'الكل' : TYPE_LABEL[type as NameType]} · ${num(rows.length)} اسم: ${num(exact)} مطابق، ${num(similar)} مشابه`
  return (
    <section className="panel mt-8 overflow-hidden">
      <header className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-pine-soft text-pine"><Icon name="shield" className="h-[18px] w-[18px]" /></span>
        <div className="min-w-[14rem] flex-1">
          <h2 className="text-[18px]">تقرير تدقيق الشعارات</h2>
          <p className="text-[13.5px] text-muted">كل اسم مطلوب مقابل السجلات: المطابق، وبـ«ال» أو بدونها، والمذكر والمؤنث، والجمع والمفرد، والمشابه. مع أعلى سعر بيع لشعار مشابه.</p>
        </div>
        <Segmented value={only} onChange={setOnly} options={[['flagged', `فيها تطابق أو تشابه (${num(exact + similar)})`], ['all', 'كل الأسماء']]} />
        <button className="btn-ghost btn-sm" onClick={() => downloadCsv(`تدقيق-الشعارات-${new Date().toISOString().slice(0, 10)}.csv`, [
          ['الطلب', 'المالك', ...OWNER_COLUMNS, 'الفئة', 'الاسم المطلوب', 'النتيجة', 'المطابق والمشابه', 'أعلى سعر لشعار مشابه', 'الشعار صاحب أعلى سعر', 'القرار'],
          ...list.map((r) => [r.number, r.ownerName, ...ownerColumns(owners.get(r.ownerId)), TYPE_LABEL[r.type], r.name, r.verdict === 'exact' ? 'مطابق' : r.verdict === 'similar' ? 'مشابه' : 'لا تشابه',
            r.matches.map((m) => `${m.name} (${RELATION_LABEL[m.relation]} ${Math.round(m.score * 100)}%)`).join(' | '), r.topPrice?.price ?? '', r.topPrice ? `${r.topPrice.name} · ${TYPE_LABEL[r.topPrice.type]}` : '',
            r.status === 'accepted' ? 'مقبول' : r.status === 'rejected' ? `مرفوض: ${r.rejectReason ?? ''}` : 'بانتظار'])])}>تصدير Excel</button>
        <button className="btn-primary btn-sm" onClick={() => print({ title: 'تقرير تدقيق الشعارات', subtitle, el: ref.current, landscape: true })}><Icon name="file" className="h-4 w-4" />طباعة التقرير</button>
      </header>
      <div ref={ref} className="overflow-x-auto">
        {list.length ? (
          <table className="tbl">
            <thead><tr><th>#</th><th>الطلب</th><th>المالك</th><th>الفئة</th><th>الاسم المطلوب</th><th>النتيجة</th><th>المطابق والمشابه في السجلات</th><th>أعلى سعر لشعار مشابه</th><th>القرار</th></tr></thead>
            <tbody>
              {list.map((r, i) => (
                <tr key={r.candidateId}>
                  <td className="num text-muted">{num(i + 1)}</td>
                  <td className="num whitespace-nowrap font-semibold">{r.number}</td>
                  <td><OwnerCell id={r.ownerId} name={r.ownerName} /></td>
                  <td className="whitespace-nowrap">{TYPE_LABEL[r.type]}</td>
                  <td className="font-extrabold text-[15px]">{r.name}</td>
                  <td><span className={`pill ${r.verdict === 'exact' ? 'bg-bad/10 text-bad' : r.verdict === 'similar' ? 'bg-gold-soft text-gold-deep' : 'bg-[#E2F0E8] text-ok'}`}>{r.verdict === 'exact' ? 'مطابق' : r.verdict === 'similar' ? 'مشابه' : 'لا تشابه'}</span></td>
                  <td className="min-w-[16rem]">
                    {r.matches.length ? (
                      <ul className="space-y-1">
                        {r.matches.map((m) => (
                          <li key={m.name + m.source + m.type} className="flex flex-wrap items-baseline gap-x-1.5 text-[13px]">
                            <b className={m.score >= 1 ? 'text-bad' : ''}>{m.name}</b>
                            <span className="text-muted">{RELATION_LABEL[m.relation]}{m.relation === 'similar' ? ` ${Math.round(m.score * 100)}%` : ''} · {TYPE_LABEL[m.type]} · {SOURCE[m.source]}</span>
                            {m.price ? <span className="num">· {sar(m.price)}{m.priceKind === 'current' ? ' (سعر حالي)' : ''}</span> : null}
                          </li>
                        ))}
                      </ul>
                    ) : <span className="text-muted">—</span>}
                  </td>
                  <td className="whitespace-nowrap">{r.topPrice ? <><b className="num text-[15px]">{sar(r.topPrice.price ?? 0)}</b><span className="block text-[12.5px] text-muted">«{r.topPrice.name}» · {TYPE_LABEL[r.topPrice.type]}{r.topPrice.at ? ` · ${date(r.topPrice.at)}` : ''}</span></> : <span className="text-muted">—</span>}</td>
                  <td className="text-[13px]">{r.status === 'accepted' ? <span className="text-ok">مقبول</span> : r.status === 'rejected' ? <span className="text-bad">مرفوض{r.rejectReason ? `: ${r.rejectReason}` : ''}</span> : <span className="text-muted">بانتظار</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="px-5 py-10 text-center text-muted">لا توجد أسماء مطابقة أو مشابهة بهذه التصفية.</p>}
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
      { key: 'kind', label: 'الطلب', options: [['', 'الكل'], ['standard', 'طلب شعار'], ['compound', 'اسم مركب'], ['investment', 'استثمار الاسم']], test: (r, v) => (r.kind ?? 'standard') === v },
      { key: 'similar', label: 'التشابه', options: [['', 'الكل'], ['yes', 'فيها أسماء شبيهة'], ['no', 'بلا تشابه']], test: (r, v) => r.candidates.some((c) => c.similar.length || (byCandidate.get(c.id)?.matches.length ?? 0) > 0) === (v === 'yes') },
    ],
  })
  const refresh = () => { reload(); audit.reload() }
  return (
    <>
      <PageHead title="طلبات الشعارات" sub="القرار بجانب كل اسم: اقبل أو ارفض كل اسم ثم اعتمد القرار، أو ارفض الطلب كاملًا أو ألغه. التفاصيل الكاملة من رقم الطلب." />
      <div className="mb-4 flex flex-wrap gap-3">
        <Segmented value={status} onChange={setStatus} options={[['under_review', 'تحت المراجعة'], ['accepted', 'مقبولة'], ['rejected', 'مرفوضة'], ['cancelled', 'ملغاة'], ['all', 'الكل']]} />
        <Segmented value={type} onChange={setType} options={typeOptions('all', 'الكل')} />
      </div>
      <TableTools t={tf} placeholder="بحث برقم الطلب أو المالك أو الاسم" />
      {error && <ErrorBox text={error} />}
      {loading && !data ? <Loading /> : tf.list.length ? (
        <div className="panel overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>الطلب</th><th>المالك</th><th>الاسم</th><th>التدقيق</th><th>أعلى سعر مشابه</th><th>القرار</th><th>الحالة</th></tr></thead>
            {tf.list.map((r) => <RequestBlock key={`${r.id}-${r.status}`} r={r} audit={byCandidate} onDone={refresh} />)}
          </table>
        </div>
      ) : <Empty title="لا توجد طلبات بهذه التصفية" />}
      {canAudit && (audit.loading && !audit.data ? <Loading /> : <AuditReport rows={audit.data ?? []} status={status} type={type} />)}
    </>
  )
}
