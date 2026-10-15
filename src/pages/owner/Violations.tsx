import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../../components/dash'
import { camelTypeLabel } from '../../components/ExemptionUi'
import { FinePay, FineStatusPill, useFines } from '../../components/Fines'
import type { Fine } from '../../components/Fines'
import { AttachmentViewer, payMethodLabel } from '../../components/ViolationUi'
import { Empty, ErrorBox, Loading, Modal, PageHead } from '../../components/ui'
import { date, dateTime, num, sar } from '../../lib/format'
import { tr } from '../../lib/i18n'
import { api, useApp, useLoad } from '../../lib/store'
import type { DocumentFile, ReservedName, Violation } from '../../lib/types'

type Filter = 'all' | 'due' | 'done' | 'closed'

/**
 * «المخالفات»: one list of everything issued against the owner — violations from the administration, and the fine for not naming a camel
 * that the committee set on an exemption request. Each line pays by card from the list; the details open a voucher, the attachment,
 * and (for violations that allow it) settling by linking a name to the camel's chip.
 */
export function MyViolationsPage() {
  const { toast } = useApp()
  const { list, loading, error, reload } = useFines()
  const [filter, setFilter] = useState<Filter>('all')
  const [paying, setPaying] = useState<Fine | null>(null)
  const [open, setOpen] = useState<Fine | null>(null)
  const [doc, setDoc] = useState<DocumentFile | null>(null)
  const [linking, setLinking] = useState<Violation | null>(null)
  // قعدان and بكار names the owner holds that are not on a chip yet (منقية has no chip)
  const names = useLoad(() => Promise.all([api.myNames(), api.myInvoices()]), [])
  const unpaidNames = new Set((names.data?.[1] ?? []).filter((i) => i.status === 'unpaid').map((i) => i.name))
  const free = (names.data?.[0] ?? []).filter((n) => (n.type === 'qaadan' || n.type === 'bakkar') && !n.camelId && !unpaidNames.has(n.name))
  const all = list ?? []
  const due = all.filter((f) => f.state === 'due')
  const total = due.reduce((s, f) => s + f.amount, 0)
  const shown = filter === 'all' ? all : all.filter((f) => f.state === filter)
  const count = (f: Filter) => (f === 'all' ? all.length : all.filter((x) => x.state === f).length)
  const FILTERS: [Filter, string][] = [['all', tr('الكل', 'All')], ['due', tr('غير مسددة', 'Unpaid')], ['done', tr('مسددة أو مسوّاة', 'Paid or settled')], ['closed', tr('ملغاة أو منع', 'Cancelled or barred')]]

  async function openAttachment(v: Violation) {
    try { setDoc(await api.myViolationAttachment(v.id)) } catch (e) { toast((e as Error).message, 'bad') }
  }

  return (
    <>
      <PageHead title={tr('المخالفات', 'Violations')} sub={tr('كل المخالفات والغرامات الصادرة بحقك: مخالفات الإدارة، وغرامات عدم التسمية في طلبات الاستثناء. تُسدَّد بالبطاقة أو Apple Pay من القائمة مباشرة.', 'Every violation and fine issued against you: administration violations and the fines for not naming a camel on exemption requests. Pay them by card or Apple Pay straight from the list.')} />
      {error ? <ErrorBox text={error} /> : loading && !list ? <Loading /> : all.length ? (
        <>
          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            <div className={`panel flex items-center gap-3 p-4 ${due.length ? 'border-bad/40 bg-bad/5' : ''}`}>
              <span className={`grid h-10 w-10 place-items-center rounded-full ${due.length ? 'bg-bad/10 text-bad' : 'bg-[#E2F0E8] text-ok'}`}><Icon name={due.length ? 'alert' : 'check'} /></span>
              <div><span className="block text-[13px] text-muted">{tr('المستحق للسداد', 'Due for payment')}</span><b className={`num text-[20px] ${due.length ? 'text-bad' : 'text-ok'}`}>{due.length ? sar(total) : tr('لا شيء', 'Nothing')}</b></div>
            </div>
            <div className="panel p-4"><span className="block text-[13px] text-muted">{tr('غير مسددة', 'Unpaid')}</span><b className="num text-[20px]">{num(due.length)}</b></div>
            <div className="panel p-4"><span className="block text-[13px] text-muted">{tr('إجمالي المخالفات والغرامات', 'All violations and fines')}</span><b className="num text-[20px]">{num(all.length)}</b></div>
          </div>
          <section className="panel overflow-hidden">
            <div className="flex flex-wrap gap-1.5 border-b border-line bg-stone/40 px-5 py-3" role="tablist" aria-label={tr('الحالة', 'Status')}>
              {FILTERS.map(([f, l]) => (
                <button key={f} type="button" role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}
                  className={`rounded-full border px-3 py-1.5 text-[13.5px] font-bold transition ${filter === f ? 'border-pine bg-pine text-paper' : 'border-line bg-paper text-ink hover:border-pine/40'}`}>
                  {l}<span className={`num ms-1.5 ${filter === f ? 'text-paper/75' : f === 'due' && count(f) ? 'text-bad' : 'text-muted'}`}>{num(count(f))}</span>
                </button>
              ))}
            </div>
            {shown.length ? (
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead><tr>
                    <th>{tr('الرقم', 'Number')}</th><th>{tr('المخالفة', 'Violation')}</th><th>{tr('المهرجان والشريحة', 'Festival & chip')}</th>
                    <th>{tr('القيمة', 'Amount')}</th><th>{tr('الحالة', 'Status')}</th><th>{tr('التاريخ', 'Date')}</th><th>{tr('الإجراء', 'Action')}</th>
                  </tr></thead>
                  <tbody>
                    {shown.map((f) => (
                      <tr key={f.key} className={f.state === 'closed' ? 'text-muted' : ''}>
                        <td className="num whitespace-nowrap font-bold" dir="ltr" style={{ textAlign: 'start' }}>{f.number}</td>
                        <td><b className="block text-[14.5px]">{f.title}</b>{f.kind === 'exemption' && <span className="text-[12.5px] text-muted">{tr('لمشاركة جمل بدون اسم', 'To race a camel without a name')}</span>}</td>
                        <td className="text-[13.5px]">{f.festival ?? <span className="text-muted">—</span>}{f.chip && <span className="num block text-[12px] text-muted" dir="ltr" style={{ textAlign: 'start' }}>{f.chip}</span>}</td>
                        <td className="num whitespace-nowrap font-extrabold">{f.amount > 0 ? sar(f.amount) : <span className="font-normal text-muted">{tr('بلا غرامة', 'No fine')}</span>}</td>
                        <td><FineStatusPill f={f} /></td>
                        <td className="whitespace-nowrap text-[13px] text-muted">{date(f.at)}</td>
                        <td>
                          <div className="flex flex-nowrap gap-1.5">
                            {f.state === 'due' && <button className="btn-gold btn-sm" onClick={() => setPaying(f)}>{tr('سداد', 'Pay')}</button>}
                            {f.exemption?.status === 'paid' && <Link to={`/dashboard/exemptions/${f.number}`} className="btn-primary btn-sm">{tr('الوثيقة', 'Document')}</Link>}
                            <button className="btn-ghost btn-sm" onClick={() => setOpen(f)}>{tr('التفاصيل', 'Details')}</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="px-5 py-10 text-center text-muted">{tr('لا توجد مخالفات بهذه الحالة.', 'No violations with this status.')}</p>}
          </section>
        </>
      ) : (
        <Empty title={tr('لا توجد مخالفات', 'No violations')}>
          <p className="text-muted">{tr('لم تصدر بحقك أي مخالفة أو غرامة. تظهر هنا إن صدرت، ويصلك إشعار بها.', 'No violation or fine has been issued against you. They appear here if issued, and you are notified.')}</p>
        </Empty>
      )}

      <FinePay fine={paying} onClose={() => setPaying(null)} onDone={() => { setPaying(null); setOpen(null); reload() }} />
      {open && <FineDetails f={open} canLink={free.length > 0} onClose={() => setOpen(null)} onPay={() => setPaying(open)}
        onAttachment={openAttachment} onLink={(v) => { setOpen(null); setLinking(v) }} />}
      <AttachmentViewer doc={doc} onClose={() => setDoc(null)} />
      {linking && <LinkNameModal v={linking} names={free} onClose={() => setLinking(null)} onDone={() => { setLinking(null); reload(); names.reload() }} />}
    </>
  )
}

/** one violation or fine in full: description, attachment, payment voucher, and the ways to settle it while it is unpaid */
function FineDetails({ f, canLink, onClose, onPay, onAttachment, onLink }: {
  f: Fine; canLink: boolean; onClose: () => void; onPay: () => void; onAttachment: (v: Violation) => void; onLink: (v: Violation) => void
}) {
  const v = f.violation, e = f.exemption
  const row = (l: string, x: ReactNode) => <div className="flex justify-between gap-3 border-b border-line/60 py-1.5 text-[14.5px]"><dt className="text-muted">{l}</dt><dd className="text-end font-bold">{x}</dd></div>
  const paidAt = v?.paidAt ?? e?.paidAt
  return (
    <Modal open onClose={onClose} title={`${f.title} — ${f.number}`} wide>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2"><FineStatusPill f={f} /><span className="text-[13.5px] text-muted">{dateTime(f.at)}</span></div>
        <dl className="grid gap-x-8 sm:grid-cols-2">
          {row(tr('القيمة', 'Amount'), f.amount > 0 ? <span className="num">{sar(f.amount)}</span> : tr('بلا غرامة', 'No fine'))}
          {f.festival && row(tr('المهرجان', 'Festival'), f.festival)}
          {f.chip && row(tr('الشريحة', 'Chip'), <span className="num" dir="ltr">{f.chip}</span>)}
          {e && row(tr('نوع الجمل', 'Camel'), camelTypeLabel(e.camelType))}
          {e?.race && row(tr('الشوط', 'Race'), e.race)}
        </dl>
        {v && <p className="whitespace-pre-line text-[15px] leading-7">{v.description}</p>}
        {e && <p className="text-[14.5px] leading-7 text-muted">{tr('غرامة حددتها اللجنة لعدم تسمية الجمل، ضمن طلب الاستثناء للمشاركة في المهرجان بدون اسم. تصدر وثيقة الاستثناء فور السداد.', 'A fine the committee set for not naming the camel, on the exemption request to race without a name. The exemption document is issued as soon as it is paid.')}{e.staffNote && <> {tr('ملاحظة اللجنة', 'Committee note')}: {e.staffNote}</>}</p>}
        {v?.attachmentName && (
          <button className="inline-flex items-center gap-1.5 text-[14px] font-bold text-pine underline" onClick={() => onAttachment(v)}>
            <Icon name="file" className="h-4 w-4" />{tr('المرفق', 'Attachment')}: <span dir="ltr">{v.attachmentName}</span>
          </button>
        )}
        {v?.status === 'resolved_name' && <p className="rounded-lg bg-pine-soft/60 px-3 py-2 text-[13.5px]">{tr('سُوّيت المخالفة بربط اسم بشريحة الجمل دون سداد.', 'Settled by linking a name to the camel chip, with no payment.')} {dateTime(v.resolvedAt)}{v.resolutionNote && <> — {v.resolutionNote}</>}</p>}
        {v?.status === 'banned' && <p className="rounded-lg bg-bad/10 px-3 py-2 text-[13.5px] text-bad"><b>{tr('مُنع الجمل من المشاركة في المهرجان', 'The camel is barred from the festival')}</b> {dateTime(v.resolvedAt)}{v.resolutionNote && <> — {tr('السبب', 'Reason')}: {v.resolutionNote}</>}</p>}
        {v?.status === 'cancelled' && <p className="rounded-lg bg-stone px-3 py-2 text-[13.5px]">{tr('أُلغيت', 'Cancelled')} {dateTime(v.cancelledAt)}{v.cancelReason && <> — {tr('السبب', 'Reason')}: {v.cancelReason}</>}</p>}
        {paidAt && (
          <div className="rounded-lg border border-ok/30 bg-[#E2F0E8]/50 p-4">
            <p className="mb-2 flex items-center gap-1.5 font-extrabold text-ok"><Icon name="receipt" className="h-4 w-4" />{tr('سند سداد', 'Payment voucher')}</p>
            <dl className="grid gap-x-6 gap-y-1.5 text-[14px] sm:grid-cols-2">
              <div className="flex justify-between gap-3"><dt className="text-muted">{tr('رقم السند', 'Voucher no.')}</dt><dd className="num font-bold" dir="ltr">{f.number}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">{tr('المبلغ المسدد', 'Amount paid')}</dt><dd className="num font-bold">{sar(f.amount)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">{tr('تاريخ السداد', 'Paid on')}</dt><dd className="num">{dateTime(paidAt)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">{tr('وسيلة الدفع', 'Payment method')}</dt><dd>{payMethodLabel(v?.paymentMethod ?? e?.paymentMethod)}</dd></div>
            </dl>
            <p className="mt-2 text-[12.5px] text-muted">{tr('غرامة بدون ضريبة القيمة المضافة؛ الغرامات غير خاضعة للضريبة ولا تصدر لها فاتورة ضريبية.', 'A fine without VAT; fines are not subject to VAT and no tax invoice is issued.')}</p>
          </div>
        )}
        {f.state === 'due' && (
          <div className="space-y-2 border-t border-line pt-4">
            <div className="flex flex-wrap gap-2">
              <button className="btn-gold" onClick={onPay}>{tr('سداد', 'Pay')} {sar(f.amount)}</button>
              {v?.allowsNameResolution && v.camelChip && (canLink
                ? <button className="btn-primary" onClick={() => onLink(v)}>{tr('ربط اسم أملكه بالشريحة بدل السداد', 'Link a name I own instead of paying')}</button>
                : <Link to="/auctions" className="btn-ghost">{tr('شراء اسم من المزادات ثم ربطه', 'Buy a name in the auctions, then link it')}</Link>)}
            </div>
            <p className="text-[13px] text-muted">{e
              ? tr('إن لم تُسدَّد الغرامة لا تصدر وثيقة الاستثناء، ولا يحق للجمل المشاركة بدون اسم.', 'Without payment, no exemption document is issued and the camel may not race without a name.')
              : tr('إن لم تُسوَّ المخالفة، يحق للجنة منع الجمل من المشاركة في المهرجان.', 'If the violation is not settled, the committee may bar the camel from the festival.')}</p>
          </div>
        )}
      </div>
    </Modal>
  )
}

/** pick one of the owner's قعدان/بكار names; it is linked to the fined camel's chip and the violation closes */
function LinkNameModal({ v, names, onClose, onDone }: { v: Violation; names: ReservedName[]; onClose: () => void; onDone: () => void }) {
  const { toast } = useApp()
  const [pick, setPick] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function save() {
    setBusy(true); setErr('')
    try {
      await api.linkNameToViolation(v.id, pick)
      toast(tr(`رُبط الاسم بالشريحة ${v.camelChip}، وأُغلقت المخالفة`, `The name is linked to chip ${v.camelChip}; the violation is closed`))
      onDone()
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title={tr(`ربط اسم بالشريحة ${v.camelChip ?? ''}`, `Link a name to chip ${v.camelChip ?? ''}`)}>
      <p className="mb-3 text-[14px] text-muted">{tr('اختر اسمًا تملكه. أسماء القعدان للذكور وأسماء البكار للإناث، والمنقية لا تُربط بشريحة.', 'Choose a name you own. Qaadan names are for males and bakkar names for females; manqiya names have no chip.')}</p>
      <ul className="space-y-2">
        {names.map((n) => (
          <li key={n.id}>
            <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${pick === n.id ? 'border-pine bg-pine-soft/40' : 'border-line'}`}>
              <input type="radio" name="vname" checked={pick === n.id} onChange={() => setPick(n.id)} />
              <b className="flex-1">{n.name}</b>
              <span className="pill bg-stone text-ink/80">{n.type === 'qaadan' ? tr('قعود', 'Qaadan') : tr('بكار', 'Bakkar')}</span>
            </label>
          </li>
        ))}
      </ul>
      {err && <p className="mt-3 text-[14px] text-bad">{err}</p>}
      <div className="mt-4 flex gap-2">
        <button className="btn-primary flex-1" disabled={!pick || busy} onClick={save}>{busy ? tr('جارٍ الربط…', 'Linking…') : tr('ربط الاسم وتسوية المخالفة', 'Link and settle')}</button>
        <button className="btn-ghost" onClick={onClose}>{tr('رجوع', 'Back')}</button>
      </div>
    </Modal>
  )
}
