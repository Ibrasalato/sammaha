import { useState } from 'react'
import { Link } from 'react-router-dom'
import { tr } from '../lib/i18n'
import { date, num, sar } from '../lib/format'
import { api, useApp, useLoad } from '../lib/store'
import type { Exemption, Violation } from '../lib/types'
import { Icon } from './dash'
import { PayModal } from './PayModal'
import { ViolationStatusPill } from './ViolationUi'

/**
 * One line of «المخالفات والغرامات»: a violation staff issued, or the fine for not naming a camel that staff set on an exemption request.
 * due: waiting for payment; done: paid or settled; closed: cancelled, rejected or barred (nothing to pay).
 */
export interface Fine {
  key: string
  kind: 'violation' | 'exemption'
  id: string
  number: string
  title: string
  festival?: string
  chip?: string
  amount: number
  state: 'due' | 'done' | 'closed'
  at: string
  violation?: Violation
  exemption?: Exemption
}

const EXEMPTION_TITLE = () => tr('غرامة عدم تسمية (استثناء مشاركة)', 'Fine for not naming a camel (exemption)')

export function finesOf(violations: Violation[], exemptions: Exemption[]): Fine[] {
  const v: Fine[] = violations.map((x) => ({
    key: `v-${x.id}`, kind: 'violation', id: x.id, number: x.number, title: tr(x.typeName, x.typeNameEn || x.typeName), festival: x.festivalName, chip: x.camelChip,
    amount: x.amount, at: x.issuedAt, violation: x,
    state: x.status === 'unpaid' ? 'due' : x.status === 'paid' || x.status === 'resolved_name' || x.status === 'recorded' ? 'done' : 'closed',
  }))
  // an exemption counts as a fine once staff set the amount (priced), and stays listed once paid
  const e: Fine[] = exemptions.filter((x) => x.amount != null && (x.status === 'priced' || x.status === 'paid')).map((x) => ({
    key: `e-${x.id}`, kind: 'exemption', id: x.id, number: x.number, title: EXEMPTION_TITLE(), festival: x.festivalName, chip: x.camelChip,
    amount: x.amount ?? 0, at: x.pricedAt ?? x.createdAt, exemption: x, state: x.status === 'priced' ? 'due' : 'done',
  }))
  // what is due first, then the newest
  return [...v, ...e].sort((a, b) => Number(b.state === 'due') - Number(a.state === 'due') || b.at.localeCompare(a.at))
}

/** the owner's violations and exemption fines, merged */
export function useFines(poll?: number) {
  const v = useLoad(() => api.myViolations(), [], poll)
  const e = useLoad(() => api.myExemptions(), [], poll)
  const list = v.data && e.data ? finesOf(v.data, e.data) : null
  return {
    list, loading: v.loading || e.loading, error: v.error ?? e.error,
    reload: () => { v.reload(); e.reload() },
  }
}

export function FineStatusPill({ f }: { f: Fine }) {
  if (f.violation) return <ViolationStatusPill s={f.violation.status} />
  return f.state === 'due'
    ? <span className="pill whitespace-nowrap bg-bad/10 text-bad">{tr('غير مسددة', 'Unpaid')}</span>
    : f.exemption?.revokedAt
      ? <span className="pill whitespace-nowrap bg-stone-deep text-muted">{tr('مسددة · الوثيقة ملغاة', 'Paid · document revoked')}</span>
      : <span className="pill whitespace-nowrap bg-[#E2F0E8] text-ok">{tr('مسددة', 'Paid')}</span>
}

/** card payment of one fine (the wallet cannot pay fines) */
export function FinePay({ fine, onClose, onDone }: { fine: Fine | null; onClose: () => void; onDone: () => void }) {
  const { toast } = useApp()
  return (
    <PayModal open={!!fine} onClose={onClose} cardOnly amount={fine?.amount ?? 0}
      title={fine ? tr(`سداد ${fine.number}`, `Pay ${fine.number}`) : ''}
      onPay={async () => {
        if (!fine) return
        try {
          if (fine.kind === 'violation') {
            await api.payViolation(fine.id)
            toast(tr('سُددت المخالفة، وسند السداد في صفحة المخالفات', 'Violation paid; the payment voucher is on the Violations page'))
          } else {
            const e = await api.payExemption(fine.id)
            toast(tr(`سُدّدت الغرامة وصدرت وثيقة الاستثناء ${e.number}`, `Fine paid; exemption document ${e.number} issued`))
          }
          onDone()
        } catch (x) { toast((x as Error).message, 'bad'); throw x }
      }} />
  )
}

/** the owner's dashboard: what is due, each with a pay button; nothing is shown when nothing is due */
export function DueFines({ fines, onPaid }: { fines: Fine[]; onPaid: () => void }) {
  const [paying, setPaying] = useState<Fine | null>(null)
  const due = fines.filter((f) => f.state === 'due')
  if (!due.length) return null
  const total = due.reduce((s, f) => s + f.amount, 0)
  return (
    <section className="panel overflow-hidden border-bad/30">
      <header className="flex flex-wrap items-center gap-3 border-b border-line/70 bg-bad/5 px-5 py-3.5">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-bad/10 text-bad"><Icon name="alert" className="h-[18px] w-[18px]" /></span>
        <div className="flex-1">
          <h2 className="text-[17px]">{tr('مخالفات وغرامات مستحقة', 'Violations and fines due')}</h2>
          <p className="text-[13.5px] text-muted">{tr(`${num(due.length)} بإجمالي`, `${num(due.length)} totalling`)} <b className="num text-bad">{sar(total)}</b></p>
        </div>
        <Link to="/dashboard/violations" className="text-[14px] font-bold text-gold-deep hover:underline">{tr('كل المخالفات', 'All violations')}</Link>
      </header>
      <ul className="divide-y divide-line/70">
        {due.map((f) => (
          <li key={f.key} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
            <div className="min-w-[12rem] flex-1">
              <div className="flex flex-wrap items-center gap-2"><span className="num text-[12.5px] text-muted" dir="ltr">{f.number}</span><b className="text-[15px]">{f.title}</b></div>
              <p className="text-[13px] text-muted">{[f.festival, f.chip && tr(`الشريحة ${f.chip}`, `Chip ${f.chip}`), date(f.at)].filter(Boolean).join(' · ')}</p>
            </div>
            <span className="num text-[17px] font-extrabold">{sar(f.amount)}</span>
            <button className="btn-gold btn-sm" onClick={() => setPaying(f)}>{tr('سداد', 'Pay')}</button>
          </li>
        ))}
      </ul>
      <FinePay fine={paying} onClose={() => setPaying(null)} onDone={() => { setPaying(null); onPaid() }} />
    </section>
  )
}
