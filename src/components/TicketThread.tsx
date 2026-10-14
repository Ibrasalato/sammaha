import { dateTime } from '../lib/format'
import { tr } from '../lib/i18n'
import { STATUS_TONE, kindLabel, statusLabel } from '../lib/tickets'
import type { Ticket, TicketStatus } from '../lib/types'

export function TicketStatusPill({ status }: { status: TicketStatus }) {
  return <span className={`pill ${STATUS_TONE[status]}`}>{statusLabel(status)}</span>
}

const STEPS: TicketStatus[] = ['new', 'in_progress', 'answered', 'closed']

/** Progress line: received → in progress → answered → closed */
export function TicketProgress({ status }: { status: TicketStatus }) {
  const at = STEPS.indexOf(status)
  return (
    <ol className="flex items-center gap-2 text-[13px]">
      {STEPS.map((s, i) => (
        <li key={s} className="flex flex-1 items-center gap-2">
          <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-bold ${i <= at ? 'bg-pine text-paper' : 'bg-stone-deep text-muted'}`}>{i + 1}</span>
          <span className={`whitespace-nowrap ${i <= at ? 'font-bold text-ink' : 'text-muted'}`}>{i === 0 ? tr('تم الاستلام', 'Received') : statusLabel(s)}</span>
          {i < STEPS.length - 1 && <span className={`h-px flex-1 ${i < at ? 'bg-pine' : 'bg-line'}`} />}
        </li>
      ))}
    </ol>
  )
}

/** The original message followed by the conversation. Staff see internal notes highlighted. */
export function TicketThread({ t, staffView }: { t: Ticket; staffView?: boolean }) {
  return (
    <ol className="space-y-3">
      <li className="rounded-lg border border-line bg-stone p-4">
        <div className="mb-1 flex flex-wrap items-center gap-2 text-[13px] text-muted">
          <b className="text-ink">{t.name}</b><span>·</span><span className="num">{dateTime(t.createdAt)}</span><span>·</span><span>{kindLabel(t.kind)}</span>
        </div>
        <p className="whitespace-pre-line leading-8">{t.message}</p>
      </li>
      {t.messages.map((m) => (
        <li key={m.id} className={`rounded-lg border p-4 ${m.internal ? 'border-dashed border-gold/60 bg-gold-soft/50' : m.by === 'staff' ? 'border-pine/20 bg-pine-soft ms-6' : 'border-line bg-stone me-6'}`}>
          <div className="mb-1 flex flex-wrap items-center gap-2 text-[13px] text-muted">
            <b className="text-ink">{m.by === 'staff' ? (staffView ? m.author : tr('فريق سمّها', 'Sammha team')) : m.author}</b>
            <span>·</span><span className="num">{dateTime(m.createdAt)}</span>
            {m.internal && <span className="pill bg-gold text-pine-deep">{tr('ملاحظة داخلية', 'Internal note')}</span>}
          </div>
          <p className="whitespace-pre-line leading-8">{m.body}</p>
        </li>
      ))}
    </ol>
  )
}
