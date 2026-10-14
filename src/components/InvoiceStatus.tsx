import { dateTime, time } from '../lib/format'
import { tr } from '../lib/i18n'
import type { Invoice } from '../lib/types'

/** paid / unpaid (with the payment deadline of an auction win) / cancelled because the deadline passed */
export function InvoiceStatus({ i }: { i: Pick<Invoice, 'status' | 'dueAt' | 'cancelledAt'> }) {
  if (i.status === 'paid') return <span className="pill bg-ok/10 text-ok">{tr('مدفوعة', 'Paid')}</span>
  if (i.status === 'cancelled') return <span className="pill bg-bad/10 text-bad" title={i.cancelledAt ? dateTime(i.cancelledAt) : undefined}>{tr('ملغاة لانتهاء المهلة', 'Cancelled: deadline passed')}</span>
  const left = i.dueAt ? Date.parse(i.dueAt) - Date.now() : null
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <span className="pill bg-gold-soft text-gold-deep">{tr('غير مدفوعة', 'Unpaid')}</span>
      {i.dueAt && <span className={`text-[11.5px] ${left != null && left < 12 * 3600_000 ? 'font-bold text-bad' : 'text-muted'}`}>{tr('آخر موعد', 'Due by')} {dateTime(i.dueAt)}{left != null && left < 86400_000 && left > 0 ? ` (${tr('الساعة', 'at')} ${time(i.dueAt)})` : ''}</span>}
    </span>
  )
}
