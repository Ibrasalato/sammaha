import { tr } from '../lib/i18n'
import type { DocumentFile, ViolationStatus } from '../lib/types'
import { Modal } from './ui'

/** «المخالفات»: status label and colours, shared by the owner and staff pages */
export const VIOLATION_STATUS: Record<ViolationStatus, [string, string]> = {
  get unpaid(): [string, string] { return [tr('غير مسددة', 'Unpaid'), 'bg-bad/10 text-bad'] },
  get paid(): [string, string] { return [tr('مسددة', 'Paid'), 'bg-[#E2F0E8] text-ok'] },
  get recorded(): [string, string] { return [tr('مسجلة بلا غرامة', 'Recorded, no fine'), 'bg-info-soft text-info-deep'] },
  get cancelled(): [string, string] { return [tr('ملغاة', 'Cancelled'), 'bg-stone-deep text-muted'] },
  get resolved_name(): [string, string] { return [tr('تمت التسوية بربط اسم', 'Settled by a name'), 'bg-pine-soft text-pine'] },
  get banned(): [string, string] { return [tr('ممنوع من المشاركة', 'Barred from taking part'), 'bg-bad text-paper'] },
}

export function ViolationStatusPill({ s }: { s: ViolationStatus }) {
  const [label, cls] = VIOLATION_STATUS[s]
  return <span className={`pill whitespace-nowrap ${cls}`}>{label}</span>
}

export const payMethodLabel = (m?: string) =>
  m === 'mada' ? tr('بطاقة مدى', 'mada card') : m === 'applepay' ? 'Apple Pay' : m === 'card' ? tr('بطاقة ائتمانية', 'Credit card') : m || tr('بطاقة', 'Card')

/** the evidence attached to a violation: PDF inline, images as images, and a download link */
export function AttachmentViewer({ doc, onClose }: { doc: DocumentFile | null; onClose: () => void }) {
  const url = doc ? `data:${doc.contentType};base64,${doc.base64}` : ''
  return (
    <Modal open={!!doc} onClose={onClose} title={tr('مرفق المخالفة', 'Violation attachment')} wide>
      {doc && (
        <div className="space-y-3">
          {doc.contentType === 'application/pdf'
            ? <iframe title={doc.name} src={url} className="h-[70vh] w-full rounded-lg border border-line" />
            : <img src={url} alt={doc.name} className="mx-auto max-h-[70vh] rounded-lg border border-line" />}
          <a href={url} download={doc.name} className="btn-ghost btn-sm">{tr('تنزيل الملف', 'Download file')}</a>
        </div>
      )}
    </Modal>
  )
}
