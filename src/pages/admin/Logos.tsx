import { useEffect, useState } from 'react'
import { Icon } from '../../components/dash'
import { TableTools, useTableFilter } from '../../components/TableTools'
import { Empty, ErrorBox, Loading, Modal, PageHead, TypeBadge } from '../../components/ui'
import { dateTime } from '../../lib/format'
import { tr } from '../../lib/i18n'
import { api, useApp, useLoad } from '../../lib/store'
import type { LogoRow, LogoStatus } from '../../lib/types'

const LOGO_STATUS: Record<LogoStatus, [string, string]> = {
  get pending(): [string, string] { return [tr('بانتظار الاعتماد', 'Awaiting approval'), 'bg-gold-soft text-gold-deep'] },
  get approved(): [string, string] { return [tr('معتمد', 'Approved'), 'bg-[#E2F0E8] text-ok'] },
  get rejected(): [string, string] { return [tr('مرفوض', 'Rejected'), 'bg-bad/10 text-bad'] },
}

const CHECKER: React.CSSProperties = {
  backgroundColor: '#fff',
  backgroundImage: 'linear-gradient(45deg,#e7e5e0 25%,transparent 25%),linear-gradient(-45deg,#e7e5e0 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e7e5e0 75%),linear-gradient(-45deg,transparent 75%,#e7e5e0 75%)',
  backgroundSize: '16px 16px',
  backgroundPosition: '0 0,0 8px,8px -8px,-8px 0',
}

/** the logo image, fetched when the card mounts */
function LogoImage({ l }: { l: LogoRow }) {
  const [src, setSrc] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    let alive = true
    let made: string | null = null
    setSrc(undefined)
    api.adminLogoImage(l.id).then((s) => { made = s; if (alive) setSrc(s) }).catch(() => alive && setSrc(null))
    return () => { alive = false; if (made?.startsWith('blob:')) URL.revokeObjectURL(made) }
  }, [l.id])
  return (
    <div className="flex h-40 items-center justify-center overflow-hidden rounded-lg border border-line" style={CHECKER}>
      {src === undefined ? <span className="h-8 w-8 animate-pulse rounded-full bg-stone-deep" aria-label={tr('جارٍ التحميل', 'Loading')} />
        : src ? <img src={src} alt={tr(`لوجو ${l.name}`, `${l.name} logo`)} className="h-full w-full object-contain p-2" loading="lazy" />
          : <span className="text-[13px] text-muted">{tr('تعذّر عرض الصورة', 'Image unavailable')}</span>}
    </div>
  )
}

function RejectDialog({ l, onClose, onDone }: { l: LogoRow; onClose: () => void; onDone: () => void }) {
  const { toast } = useApp()
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  return (
    <Modal open onClose={onClose} title={tr(`رفض لوجو «${l.name}»`, `Reject “${l.name}” logo`)}>
      <div className="space-y-3">
        {err && <ErrorBox text={err} />}
        <p className="text-[14.5px] leading-7">{tr(`يصل السبب إلى ${l.ownerName}، ويستطيع رفع لوجو آخر.`, `The reason is sent to ${l.ownerName}, who can upload another logo.`)}</p>
        <label className="label" htmlFor="lg-r">{tr('سبب الرفض (يصل للمالك)', 'Rejection reason (sent to the owner)')}</label>
        <textarea id="lg-r" className="field min-h-[90px]" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} autoFocus />
        <div className="flex gap-2">
          <button className="btn-danger flex-1" disabled={busy || reason.trim().length < 3} onClick={async () => {
            setBusy(true); setErr('')
            try { await api.reviewLogo(l.id, false, reason.trim()); toast(tr('رُفض اللوجو وأُبلغ المالك', 'Logo rejected and owner notified')); onDone() } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
          }}>{busy ? tr('جارٍ التنفيذ…', 'Processing…') : tr('رفض اللوجو', 'Reject logo')}</button>
          <button className="btn-ghost" onClick={onClose}>{tr('رجوع', 'Back')}</button>
        </div>
      </div>
    </Modal>
  )
}

/** «لوجوهات الشعارات»: logos owners upload for their marks, approved before they show in the registry (names.logos) */
export function AdminLogos({ embedded = false }: { embedded?: boolean } = {}) {
  const { toast } = useApp()
  const [status, setStatus] = useState<LogoStatus | 'all'>('pending')
  const { data, loading, error, reload } = useLoad(() => api.adminLogos(status), [status])
  const [rejecting, setRejecting] = useState<LogoRow | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const tf = useTableFilter(data, { fields: (l) => [l.name, l.ownerName, l.fileName] })
  async function approve(l: LogoRow) {
    setBusyId(l.id)
    try { await api.reviewLogo(l.id, true); toast(tr(`اعتُمد لوجو «${l.name}»`, `“${l.name}” logo approved`)); reload() } catch (e) { toast((e as Error).message, 'bad') } finally { setBusyId(null) }
  }
  return (
    <>
      {!embedded && <PageHead title={tr('لوجوهات الشعارات', 'Mark logos')} sub={tr('يرفع الملاك لوجو لشعاراتهم، ولا يظهر مع الاسم في سجل الأسماء إلا بعد اعتماده.', 'Owners upload a logo for their marks; it shows with the name in the registry only after approval.')} />}
      <TableTools t={tf} placeholder={tr('بحث بالاسم أو المالك أو الملف', 'Search by name, owner or file')}>
        <select className={`field w-auto py-2 text-[15px] ${status !== 'all' ? 'border-pine bg-pine-soft font-bold text-pine' : ''}`} value={status} onChange={(e) => setStatus(e.target.value as LogoStatus | 'all')} aria-label={tr('الحالة', 'Status')}>
          <option value="all">{tr('الحالة: الكل', 'Status: All')}</option>
          {(['pending', 'approved', 'rejected'] as LogoStatus[]).map((s) => <option key={s} value={s}>{LOGO_STATUS[s][0]}</option>)}
        </select>
      </TableTools>
      {error ? <ErrorBox text={error} /> : loading && !data ? <Loading /> : data?.length ? (
        tf.list.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {tf.list.map((l) => {
              const [label, cls] = LOGO_STATUS[l.status]
              return (
                <article key={l.id} className="panel flex flex-col gap-3 p-4">
                  <LogoImage l={l} />
                  <div className="flex items-start justify-between gap-2">
                    <b className="text-[17px]">{l.name}</b>
                    <TypeBadge type={l.type} />
                  </div>
                  <dl className="space-y-1 text-[13px]">
                    <div className="flex gap-1.5"><dt className="text-muted">{tr('المالك', 'Owner')}:</dt><dd className="font-semibold">{l.ownerName}</dd></div>
                    <div className="flex gap-1.5"><dt className="text-muted">{tr('الملف', 'File')}:</dt><dd className="truncate" dir="ltr" title={l.fileName}>{l.fileName}</dd></div>
                    <div className="flex gap-1.5"><dt className="text-muted">{tr('رُفع', 'Uploaded')}:</dt><dd>{dateTime(l.uploadedAt)}</dd></div>
                    {l.reviewedAt && <div className="flex gap-1.5"><dt className="text-muted">{tr('المراجعة', 'Reviewed')}:</dt><dd>{dateTime(l.reviewedAt)}{l.reviewedBy && ` · ${l.reviewedBy}`}</dd></div>}
                  </dl>
                  <div>
                    <span className={`pill ${cls}`}>{label}</span>
                    {l.rejectReason && <p className="mt-1 text-[12.5px] text-bad">{l.rejectReason}</p>}
                  </div>
                  {l.status === 'pending' && (
                    <div className="mt-auto flex gap-2 pt-1">
                      <button className="btn-primary btn-sm flex-1" disabled={busyId === l.id} onClick={() => approve(l)}><Icon name="check" className="h-4 w-4" />{busyId === l.id ? '…' : tr('اعتماد', 'Approve')}</button>
                      <button className="btn-danger btn-sm flex-1" disabled={busyId === l.id} onClick={() => setRejecting(l)}>{tr('رفض', 'Reject')}</button>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        ) : (
          <p className="panel px-5 py-10 text-center text-muted">{tr('لا توجد نتائج مطابقة.', 'No matching results.')} <button type="button" className="font-bold text-pine underline" onClick={tf.reset}>{tr('مسح التصفية', 'Clear filters')}</button></p>
        )
      ) : (
        <Empty title={status === 'pending' ? tr('لا توجد لوجوهات بانتظار الاعتماد', 'No logos awaiting approval') : tr('لا توجد لوجوهات بهذه الحالة', 'No logos with this status')}>
          {status !== 'all' && <button className="btn-ghost btn-sm" onClick={() => setStatus('all')}>{tr('عرض الكل', 'Show all')}</button>}
        </Empty>
      )}
      {rejecting && <RejectDialog l={rejecting} onClose={() => setRejecting(null)} onDone={() => { setRejecting(null); reload() }} />}
    </>
  )
}
