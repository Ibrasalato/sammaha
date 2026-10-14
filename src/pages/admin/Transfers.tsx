import { useState } from 'react'
import { Icon } from '../../components/dash'
import { NoResults, TableTools, useTableFilter } from '../../components/TableTools'
import { Empty, ErrorBox, Loading, Modal, PageHead, TypeBadge } from '../../components/ui'
import { dateTime, num, sar } from '../../lib/format'
import { tr } from '../../lib/i18n'
import { api, useApp, useLoad } from '../../lib/store'
import type { NameTransfer, TransferReason, TransferStatus } from '../../lib/types'

export const TRANSFER_STATUS: Record<TransferStatus, [string, string]> = {
  get pending_payment(): [string, string] { return [tr('بانتظار سداد المرسل للرسوم', 'Awaiting sender’s fee'), 'bg-gold-soft text-gold-deep'] },
  get awaiting_recipient(): [string, string] { return [tr('بانتظار موافقة المستلم', 'Awaiting recipient'), 'bg-gold-soft text-gold-deep'] },
  get under_review(): [string, string] { return [tr('تحت المراجعة', 'Under review'), 'bg-info-soft text-info-deep'] },
  get completed(): [string, string] { return [tr('مكتمل', 'Completed'), 'bg-[#E2F0E8] text-ok'] },
  get rejected(): [string, string] { return [tr('مرفوض', 'Rejected'), 'bg-bad/10 text-bad'] },
  get declined(): [string, string] { return [tr('رفضه المستلم', 'Declined by recipient'), 'bg-bad/10 text-bad'] },
  get cancelled(): [string, string] { return [tr('ملغى', 'Cancelled'), 'bg-stone-deep text-muted'] },
}
const STATUSES: TransferStatus[] = ['under_review', 'awaiting_recipient', 'pending_payment', 'completed', 'rejected', 'declined', 'cancelled']

const REASON: Record<TransferReason, string> = {
  get sale() { return tr('بيع خارج المنصة', 'Sale outside the platform') },
  get gift() { return tr('هبة', 'Gift') },
  get inheritance() { return tr('إرث', 'Inheritance') },
  get other() { return tr('أخرى', 'Other') },
}

function Party({ name, phone }: { name: string; phone?: string }) {
  return (
    <>
      <b className="block text-[14px]">{name}</b>
      {phone && <a href={`tel:${phone}`} className="num block text-[12.5px] text-muted hover:text-pine" dir="ltr" style={{ textAlign: 'start' }}>{phone}</a>}
    </>
  )
}

function ReviewDialog({ t, approve, onClose, onDone }: { t: NameTransfer; approve: boolean; onClose: () => void; onDone: () => void }) {
  const { toast } = useApp()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const valid = approve || note.trim().length >= 3
  async function go() {
    setBusy(true); setErr('')
    try {
      await api.reviewTransfer(t.id, approve, note.trim() || undefined)
      toast(approve ? tr(`نُقلت ملكية «${t.name}» إلى ${t.toName}`, `“${t.name}” now belongs to ${t.toName}`) : tr('رُفض طلب النقل وأُبلغ الطرفان', 'Transfer rejected and both owners notified'))
      onDone()
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title={approve ? tr('اعتماد النقل', 'Approve transfer') : tr('رفض طلب النقل', 'Reject transfer')}>
      <div className="space-y-4">
        {err && <ErrorBox text={err} />}
        <p className="text-[14.5px] leading-7">
          {approve
            ? tr(`يُنقل الاسم «${t.name}» من ${t.fromName} إلى ${t.toName} ويصبح مسجلًا باسم المستلم فورًا، ولا تبقى أي شهادة سابقة تشمله سارية للمرسل.`, `“${t.name}” moves from ${t.fromName} to ${t.toName} and is registered to the recipient immediately; any earlier certificate covering it is no longer valid for the sender.`)
            : tr(`يبقى الاسم «${t.name}» مسجلًا باسم ${t.fromName}. يصل سبب الرفض إلى المرسل والمستلم${t.fee > 0 ? '، وتُعاد رسوم النقل المدفوعة إلى محفظة المرسل' : ''}.`, `“${t.name}” stays registered to ${t.fromName}. The reason is sent to both the sender and the recipient${t.fee > 0 ? ', and any paid transfer fee is returned to the sender’s wallet' : ''}.`)}
        </p>
        <div>
          <label className="label" htmlFor="tr-note">{approve ? tr('ملاحظة (اختياري)', 'Note (optional)') : tr('سبب الرفض (يصل للطرفين)', 'Rejection reason (sent to both owners)')}</label>
          <textarea id="tr-note" className="field min-h-[90px]" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} autoFocus={!approve} />
        </div>
        <div className="flex gap-2">
          <button className={`${approve ? 'btn-primary' : 'btn-danger'} flex-1`} disabled={busy || !valid} onClick={go}>
            {busy ? tr('جارٍ التنفيذ…', 'Processing…') : approve ? tr('اعتماد النقل', 'Approve transfer') : tr('رفض الطلب', 'Reject request')}
          </button>
          <button className="btn-ghost" onClick={onClose}>{tr('رجوع', 'Back')}</button>
        </div>
      </div>
    </Modal>
  )
}

/** «طلبات نقل الملكية»: owner → recipient accepts → the committee approves or rejects (names.transfer) */
export function AdminTransfers({ embedded = false }: { embedded?: boolean } = {}) {
  const [status, setStatus] = useState<TransferStatus | 'all'>('under_review')
  const { data, loading, error, reload } = useLoad(() => api.adminTransfers(status), [status])
  const [review, setReview] = useState<{ t: NameTransfer; approve: boolean } | null>(null)
  const tf = useTableFilter(data, {
    fields: (t) => [t.number, t.name, t.fromName, t.toName, t.fromPhone, t.toPhone],
  })
  return (
    <>
      {!embedded && <PageHead title={tr('طلبات نقل الملكية', 'Ownership transfers')} sub={tr('يطلب المالك نقل اسم إلى مالك آخر، فيوافق المستلم، ثم تعتمد اللجنة النقل أو ترفضه.', 'An owner asks to move a name to another owner, the recipient accepts, then the committee approves or rejects the transfer.')} />}
      <section className="panel overflow-hidden">
        <div className="px-5 pt-4">
          <TableTools t={tf} placeholder={tr('بحث بالرقم أو الاسم أو الجوال', 'Search by number, name or phone')}>
            <select className={`field w-auto py-2 text-[15px] ${status !== 'all' ? 'border-pine bg-pine-soft font-bold text-pine' : ''}`} value={status} onChange={(e) => setStatus(e.target.value as TransferStatus | 'all')} aria-label={tr('الحالة', 'Status')}>
              <option value="all">{tr('الحالة: الكل', 'Status: All')}</option>
              {STATUSES.map((s) => <option key={s} value={s}>{TRANSFER_STATUS[s][0]}</option>)}
            </select>
          </TableTools>
        </div>
        {error ? <div className="p-5"><ErrorBox text={error} /></div> : loading && !data ? <Loading /> : data?.length ? (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr>
                <th>{tr('الطلب', 'Request')}</th><th>{tr('الاسم', 'Name')}</th><th>{tr('من', 'From')}</th><th>{tr('إلى', 'To')}</th>
                <th>{tr('السبب', 'Reason')}</th><th>{tr('الرسوم', 'Fee')}</th><th>{tr('التواريخ', 'Dates')}</th><th>{tr('الحالة', 'Status')}</th><th />
              </tr></thead>
              <tbody>
                {tf.list.map((t) => {
                  const [label, cls] = TRANSFER_STATUS[t.status]
                  return (
                    <tr key={t.id}>
                      <td className="num whitespace-nowrap font-bold" dir="ltr" style={{ textAlign: 'start' }}>{t.number}</td>
                      <td><b className="block text-[16px]">{t.name}</b><TypeBadge type={t.type} /></td>
                      <td><Party name={t.fromName} phone={t.fromPhone} /></td>
                      <td><Party name={t.toName} phone={t.toPhone} /></td>
                      <td className="text-[13.5px]">{REASON[t.reason]}{t.note && <span className="block max-w-[14rem] text-[12.5px] text-muted">{t.note}</span>}</td>
                      <td className="num whitespace-nowrap">{t.fee > 0 ? sar(t.fee) : tr('بلا رسوم', 'Free')}</td>
                      <td className="whitespace-nowrap text-[12.5px] text-muted">
                        <span className="block">{tr('الطلب', 'Requested')}: {dateTime(t.createdAt)}</span>
                        {t.respondedAt && <span className="block">{tr('رد المستلم', 'Recipient replied')}: {dateTime(t.respondedAt)}</span>}
                        {t.reviewedAt && <span className="block">{tr('المراجعة', 'Reviewed')}: {dateTime(t.reviewedAt)}</span>}
                        {t.cancelledAt && <span className="block">{tr('الإلغاء', 'Cancelled')}: {dateTime(t.cancelledAt)}</span>}
                      </td>
                      <td>
                        <span className={`pill whitespace-nowrap ${cls}`}>{label}</span>
                        {t.reviewerName && <span className="block text-[12px] text-muted">{tr('المراجع', 'Reviewer')}: {t.reviewerName}</span>}
                        {t.reviewNote && <span className={`block max-w-[14rem] text-[12px] ${t.status === 'rejected' ? 'text-bad' : 'text-muted'}`}>{t.reviewNote}</span>}
                      </td>
                      <td className="whitespace-nowrap">{t.status === 'under_review' && (
                        <div className="flex gap-1">
                          <button className="btn-primary btn-sm" onClick={() => setReview({ t, approve: true })}><Icon name="check" className="h-4 w-4" />{tr('اعتماد النقل', 'Approve transfer')}</button>
                          <button className="btn-danger btn-sm" onClick={() => setReview({ t, approve: false })}>{tr('رفض', 'Reject')}</button>
                        </div>
                      )}</td>
                    </tr>
                  )
                })}
                {!tf.list.length && <NoResults cols={9} onReset={tf.reset} />}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-5"><Empty title={status === 'under_review' ? tr('لا توجد طلبات تنتظر المراجعة', 'No transfers awaiting review') : tr('لا توجد طلبات بهذه الحالة', 'No transfers with this status')}>
            {status !== 'all' && <button className="btn-ghost btn-sm" onClick={() => setStatus('all')}>{tr(`عرض كل الطلبات`, 'Show all requests')}</button>}
          </Empty></div>
        )}
        {data && data.length > 0 && status === 'under_review' && <p className="border-t border-line px-5 py-3 text-[13px] text-muted">{tr(`${num(data.length)} طلب بانتظار قرار اللجنة`, `${num(data.length)} awaiting the committee’s decision`)}</p>}
      </section>
      {review && <ReviewDialog t={review.t} approve={review.approve} onClose={() => setReview(null)} onDone={() => { setReview(null); reload() }} />}
    </>
  )
}
