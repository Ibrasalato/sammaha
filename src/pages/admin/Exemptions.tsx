import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../../components/dash'
import { EXEMPTION_STATUS, ExemptionStatusPill, camelTypeLabel } from '../../components/ExemptionUi'
import { payMethodLabel } from '../../components/ViolationUi'
import { Empty, ErrorBox, Loading, Modal, PageHead } from '../../components/ui'
import { dateTime, num, sar } from '../../lib/format'
import { tr } from '../../lib/i18n'
import { can } from '../../lib/permissions'
import { api, useApp, useLoad } from '../../lib/store'
import type { Exemption, ExemptionStatus } from '../../lib/types'
import { festivalLabel } from './Violations'

/** «قيد الدراسة» first: those wait for the committee */
const FILTERS: (ExemptionStatus | 'all')[] = ['pending', 'priced', 'paid', 'rejected', 'cancelled', 'all']
const filterLabel = (f: ExemptionStatus | 'all') => (f === 'all' ? tr('الكل', 'All') : EXEMPTION_STATUS[f][0])
/** the usual fine for not naming a camel; staff can change it per request */
const DEFAULT_FINE = 5000

type Action = 'price' | 'reject' | 'revoke'

function DetailDialog({ e, onClose, onChanged }: { e: Exemption; onClose: () => void; onChanged: (e: Exemption) => void }) {
  const { user, toast } = useApp()
  const manage = can(user, 'exemptions.manage')
  const open = e.status === 'pending' || e.status === 'priced'
  const [action, setAction] = useState<Action | null>(e.status === 'pending' && manage ? 'price' : null)
  const [amount, setAmount] = useState(String(e.amount ?? DEFAULT_FINE))
  const [text, setText] = useState(e.status === 'priced' ? e.staffNote ?? '' : '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const value = Number(amount)

  async function run() {
    if (!action) return
    setBusy(true); setErr('')
    try {
      const r = action === 'price' ? await api.priceExemption(e.id, value, text.trim() || undefined)
        : action === 'reject' ? await api.rejectExemption(e.id, text.trim()) : await api.revokeExemption(e.id, text.trim())
      toast(action === 'price' ? tr(`حُدّدت الغرامة ${sar(value)} وأُبلغ المالك`, `Fine of ${sar(value)} set; the owner was notified`)
        : action === 'reject' ? tr(`رُفض الطلب ${e.number} وأُبلغ المالك`, `Request ${e.number} rejected; the owner was notified`)
        : tr(`أُلغيت الوثيقة ${e.number}`, `Document ${e.number} revoked`))
      setAction(null); onChanged(r)
    } catch (x) { setErr((x as Error).message) } finally { setBusy(false) }
  }

  const row = (l: string, v: ReactNode) => <div className="flex justify-between gap-3 border-b border-line/60 py-1.5 text-[14.5px]"><dt className="text-muted">{l}</dt><dd className="text-end font-bold">{v}</dd></div>
  return (
    <Modal open onClose={onClose} title={tr(`طلب الاستثناء ${e.number}`, `Exemption request ${e.number}`)} wide>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2"><ExemptionStatusPill e={e} /><span className="text-[13.5px] text-muted">{tr('قُدّم', 'Submitted')} {dateTime(e.createdAt)}</span></div>
        <dl className="grid gap-x-8 sm:grid-cols-2">
          {row(tr('المالك', 'Owner'), <>{e.ownerName}{e.ownerPhone && <span className="num block text-[12.5px] font-normal text-muted" dir="ltr">{e.ownerPhone}</span>}</>)}
          {row(tr('الهوية', 'ID'), <span className="num" dir="ltr">{e.nationalId ?? '—'}</span>)}
          {row(tr('رقم الشريحة', 'Chip number'), <span className="num" dir="ltr">{e.camelChip}</span>)}
          {row(tr('نوع الجمل', 'Camel'), camelTypeLabel(e.camelType))}
          {row(tr('المهرجان', 'Festival'), e.festivalName)}
          {row(tr('الشوط', 'Race'), e.race ?? '—')}
          {e.amount != null && row(tr('الغرامة', 'Fine'), <span className="num">{sar(e.amount)}</span>)}
          {e.pricedByName && row(tr('حددها', 'Set by'), <>{e.pricedByName} <span className="block text-[12px] font-normal text-muted">{dateTime(e.pricedAt)}</span></>)}
          {e.paidAt && row(tr('السداد', 'Paid'), <>{dateTime(e.paidAt)} <span className="block text-[12px] font-normal text-muted">{payMethodLabel(e.paymentMethod)}</span></>)}
          {e.signature && row(tr('رمز التوثيق', 'Authentication code'), <span className="num text-[13px]" dir="ltr">{e.signature}</span>)}
        </dl>
        {e.ownerNote && <p className="rounded-lg bg-stone px-3 py-2 text-[14px]"><b>{tr('ملاحظة المالك', 'Owner’s note')}:</b> {e.ownerNote}</p>}
        {e.status === 'rejected' && <p className="rounded-lg bg-bad/10 px-3 py-2 text-[14px] text-bad">{tr('رُفض', 'Rejected')} {dateTime(e.rejectedAt)}{e.rejectedByName && ` — ${e.rejectedByName}`}: {e.rejectReason}</p>}
        {e.revokedAt && <p className="rounded-lg bg-bad/10 px-3 py-2 text-[14px] text-bad">{tr('أُلغيت الوثيقة', 'Document revoked')} {dateTime(e.revokedAt)}{e.revokedByName && ` — ${e.revokedByName}`}: {e.revokeReason}</p>}

        {manage && (
          <div className="flex flex-wrap gap-2">
            {open && <button className={action === 'price' ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'} onClick={() => { setAction('price'); setErr('') }}>{e.status === 'priced' ? tr('تعديل الغرامة', 'Change the fine') : tr('تحديد الغرامة', 'Set the fine')}</button>}
            {open && <button className={`btn-ghost btn-sm ${action === 'reject' ? 'border-bad text-bad' : 'text-bad'}`} onClick={() => { setAction('reject'); setText(''); setErr('') }}>{tr('رفض الطلب', 'Reject')}</button>}
            {e.status === 'paid' && !e.revokedAt && <button className="btn-ghost btn-sm text-bad" onClick={() => { setAction('revoke'); setText(''); setErr('') }}>{tr('إلغاء الوثيقة', 'Revoke the document')}</button>}
            {e.status === 'paid' && <Link to={`/admin/requests/exemptions/${e.number}`} className="btn-ghost btn-sm ms-auto"><Icon name="file" className="h-4 w-4" />{tr('عرض الوثيقة', 'View document')}</Link>}
          </div>
        )}
        {action && (
          <div className={`space-y-3 rounded-xl border-2 p-4 ${action === 'price' ? 'border-gold/60 bg-gold-soft/30' : 'border-bad/30 bg-bad/5'}`}>
            {err && <ErrorBox text={err} />}
            {action === 'price' && (
              <div>
                <label className="label" htmlFor="ex-amount">{tr('غرامة عدم التسمية (ريال)', 'Fine for not naming (SAR)')}</label>
                <input id="ex-amount" className="field num max-w-[14rem]" dir="ltr" inputMode="decimal" value={amount} onChange={(x) => setAmount(x.target.value.replace(/[^\d.]/g, ''))} autoFocus />
                <p className="hint">{tr('تُسدَّد بالبطاقة دون ضريبة القيمة المضافة، وتصدر الوثيقة فور السداد.', 'Paid by card without VAT; the document is issued as soon as it is paid.')}</p>
              </div>
            )}
            <div>
              <label className="label" htmlFor="ex-text">{action === 'price' ? tr('ملاحظة للمالك (اختياري)', 'Note to the owner (optional)') : action === 'reject' ? tr('سبب الرفض (يصل للمالك)', 'Reason (sent to the owner)') : tr('سبب إلغاء الوثيقة (يصل للمالك)', 'Reason for revoking (sent to the owner)')}</label>
              <textarea id="ex-text" className="field" rows={2} maxLength={500} value={text} onChange={(x) => setText(x.target.value)} />
            </div>
            <div className="flex gap-2">
              <button className={action === 'price' ? 'btn-primary' : 'btn-primary bg-bad hover:bg-bad'} disabled={busy || (action === 'price' ? !(value > 0 && value <= 1_000_000) : text.trim().length < (action === 'revoke' ? 5 : 3))} onClick={run}>
                {busy ? '…' : action === 'price' ? tr('إرسال الغرامة للمالك', 'Send the fine to the owner') : action === 'reject' ? tr('رفض الطلب', 'Reject request') : tr('إلغاء الوثيقة', 'Revoke document')}
              </button>
              <button className="btn-ghost" onClick={() => setAction(null)}>{tr('رجوع', 'Back')}</button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

/** «طلبات الاستثناء»: owners asking to take part in a festival without a name; staff set the fine or reject (exemptions.manage) */
export function AdminExemptions({ embedded = false }: { embedded?: boolean }) {
  const { user } = useApp()
  const [status, setStatus] = useState<ExemptionStatus | 'all'>('pending')
  const [q, setQ] = useState('')
  const [term, setTerm] = useState('')
  const [festivalId, setFestivalId] = useState('')
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState<Exemption | null>(null)
  const { data, loading, error, reload } = useLoad(() => api.adminExemptions({ q: term || undefined, status, festivalId: festivalId || undefined, page }), [term, status, festivalId, page])
  const festivals = useLoad(() => api.festivals().catch(() => []), [])
  const pages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1
  const count = (f: ExemptionStatus | 'all') => (!data ? undefined : data.counts[f])
  const filtered = term || status !== 'pending' || festivalId

  return (
    <>
      {!embedded && <PageHead title={tr('طلبات الاستثناء', 'Exemption requests')} sub={tr('طلبات الملاك للمشاركة في المهرجانات بجمل بدون اسم مسجل. تحدد اللجنة غرامة عدم التسمية، وبعد سداد المالك تصدر وثيقة الاستثناء تلقائيًا برمز تحقق.', 'Owners asking to take part in festivals with a camel that has no registered name. The committee sets the fine for not naming it; once the owner pays, the exemption document is issued automatically with a verification code.')} />}
      <section className="panel overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-stone/40 px-5 py-3">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={tr('الحالة', 'Status')}>
            {FILTERS.map((f) => (
              <button key={f} type="button" role="tab" aria-selected={status === f} onClick={() => { setStatus(f); setPage(1) }}
                className={`rounded-full border px-3 py-1.5 text-[13.5px] font-bold transition ${status === f ? 'border-pine bg-pine text-paper' : 'border-line bg-paper text-ink hover:border-pine/40'}`}>
                {filterLabel(f)}{count(f) !== undefined && <span className={`num ms-1.5 ${status === f ? 'text-paper/75' : f === 'pending' && count(f) ? 'text-bad' : 'text-muted'}`}>{num(count(f)!)}</span>}
              </button>
            ))}
          </div>
          {!!festivals.data?.length && (
            <select className={`field w-auto py-2 text-[14px] sm:ms-auto ${festivalId ? 'border-pine bg-pine-soft font-bold text-pine' : ''}`} value={festivalId} onChange={(x) => { setFestivalId(x.target.value); setPage(1) }} aria-label={tr('المهرجان', 'Festival')}>
              <option value="">{tr('كل المهرجانات', 'All festivals')}</option>
              {festivals.data.map((f) => <option key={f.id} value={f.id}>{festivalLabel(f)}</option>)}
            </select>
          )}
          <form className={`w-full sm:w-72 ${festivals.data?.length ? '' : 'sm:ms-auto'}`} onSubmit={(x) => { x.preventDefault(); setTerm(q.trim()); setPage(1) }}>
            <input className="field py-2 text-[14px]" placeholder={tr('بحث بالرقم أو الشريحة أو المالك', 'Search by number, chip or owner')} value={q}
              onChange={(x) => setQ(x.target.value)} onBlur={() => { if (q.trim() !== term) { setTerm(q.trim()); setPage(1) } }} />
          </form>
        </div>
        {error ? <div className="p-5"><ErrorBox text={error} /></div> : loading && !data ? <Loading /> : data?.items.length ? (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr>
                <th>{tr('الرقم', 'Number')}</th><th>{tr('المالك', 'Owner')}</th><th>{tr('الشريحة', 'Chip')}</th><th>{tr('المهرجان', 'Festival')}</th>
                <th>{tr('الغرامة', 'Fine')}</th><th>{tr('الحالة', 'Status')}</th><th>{tr('قُدّم', 'Submitted')}</th><th />
              </tr></thead>
              <tbody>
                {data.items.map((e) => (
                  <tr key={e.id}>
                    <td className="num whitespace-nowrap font-bold" dir="ltr" style={{ textAlign: 'start' }}>{e.number}</td>
                    <td><b className="block text-[14.5px]">{e.ownerName}</b>{e.ownerPhone && <span className="num block text-[12.5px] text-muted" dir="ltr" style={{ textAlign: 'start' }}>{e.ownerPhone}</span>}</td>
                    <td><span className="num block" dir="ltr" style={{ textAlign: 'start' }}>{e.camelChip}</span><span className="text-[12.5px] text-muted">{camelTypeLabel(e.camelType)}</span></td>
                    <td className="text-[13.5px]">{e.festivalName}{e.race && <span className="block text-[12px] text-muted">{e.race}</span>}</td>
                    <td className="num whitespace-nowrap">{e.amount != null ? sar(e.amount) : <span className="text-muted">—</span>}</td>
                    <td><ExemptionStatusPill e={e} /></td>
                    <td className="whitespace-nowrap text-[13px] text-muted">{dateTime(e.createdAt)}</td>
                    <td><button className={e.status === 'pending' && can(user, 'exemptions.manage') ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'} onClick={() => setOpen(e)}>{e.status === 'pending' && can(user, 'exemptions.manage') ? tr('دراسة', 'Review') : tr('عرض', 'View')}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-5"><Empty title={filtered ? tr('لا توجد طلبات بهذه التصفية', 'No requests match this filter') : tr('لا توجد طلبات بانتظار الدراسة', 'No requests waiting for review')}>
            {filtered && <button className="btn-ghost btn-sm" onClick={() => { setStatus('all'); setQ(''); setTerm(''); setFestivalId(''); setPage(1) }}>{tr('عرض الكل', 'Show all')}</button>}
          </Empty></div>
        )}
        {pages > 1 && (
          <div className="flex items-center justify-center gap-3 border-t border-line px-5 py-3 text-[14px]">
            <button className="btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>{tr('السابق', 'Previous')}</button>
            <span className="num">{tr(`صفحة ${page} من ${pages}`, `Page ${page} of ${pages}`)}</span>
            <button className="btn-ghost btn-sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>{tr('التالي', 'Next')}</button>
          </div>
        )}
      </section>
      {open && <DetailDialog e={open} onClose={() => setOpen(null)} onChanged={(e) => { setOpen(e); reload() }} />}
    </>
  )
}
