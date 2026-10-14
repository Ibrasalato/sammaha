import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../../components/dash'
import { PayModal } from '../../components/PayModal'
import { AttachmentViewer, ViolationStatusPill, payMethodLabel } from '../../components/ViolationUi'
import { Empty, ErrorBox, Loading, Modal, PageHead } from '../../components/ui'
import { dateTime, num, sar } from '../../lib/format'
import { tr } from '../../lib/i18n'
import { api, useApp, useLoad } from '../../lib/store'
import type { DocumentFile, ReservedName, Violation } from '../../lib/types'

/** «المخالفات»: fines and penalties issued to the owner; a fine is paid by card only, and its receipt shows here (fines carry no VAT, so no tax invoice). */
export function MyViolationsPage() {
  const { toast } = useApp()
  const { data, loading, error, reload } = useLoad(() => api.myViolations(), [])
  const [paying, setPaying] = useState<Violation | null>(null)
  const [doc, setDoc] = useState<DocumentFile | null>(null)
  const [linking, setLinking] = useState<Violation | null>(null)
  // قعدان and بكار names the owner holds that are not on a chip yet (منقية has no chip)
  const names = useLoad(() => Promise.all([api.myNames(), api.myInvoices()]), [])
  const unpaidNames = new Set((names.data?.[1] ?? []).filter((i) => i.status === 'unpaid').map((i) => i.name))
  const free = (names.data?.[0] ?? []).filter((n) => (n.type === 'qaadan' || n.type === 'bakkar') && !n.camelId && !unpaidNames.has(n.name))
  const list = data ?? []
  const unpaid = list.filter((v) => v.status === 'unpaid')
  const due = unpaid.reduce((s, v) => s + v.amount, 0)

  async function openAttachment(v: Violation) {
    try { setDoc(await api.myViolationAttachment(v.id)) } catch (e) { toast((e as Error).message, 'bad') }
  }

  return (
    <>
      <PageHead title={tr('المخالفات', 'Violations')} sub={tr('المخالفات والغرامات الصادرة بحقك من إدارة المنصة. تُسدَّد الغرامات بالبطاقة أو Apple Pay، ويظهر سند السداد مع كل مخالفة مسددة.', 'Violations and fines issued to you by the platform administration. Fines are paid by card or Apple Pay, and a payment voucher appears with each paid violation.')} />
      {error ? <ErrorBox text={error} /> : loading && !data ? <Loading /> : list.length ? (
        <>
          {unpaid.length > 0 && (
            <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-bad/30 bg-bad/5 px-5 py-4">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-bad/10 text-bad"><Icon name="alert" /></span>
              <p className="flex-1 text-[15px]">{tr(`عليك ${num(unpaid.length)} ${unpaid.length === 1 ? 'مخالفة غير مسددة' : 'مخالفات غير مسددة'} بإجمالي`, `You have ${num(unpaid.length)} unpaid ${unpaid.length === 1 ? 'violation' : 'violations'} totalling`)} <b className="num">{sar(due)}</b></p>
            </div>
          )}
          <ul className="space-y-3">
            {list.map((v) => (
              <li key={v.id} className={`panel p-5 ${v.status === 'cancelled' ? 'opacity-75' : ''}`}>
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-[14rem] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="num text-[13px] text-muted" dir="ltr">{v.number}</span>
                      <b className="text-[16.5px]">{tr(v.typeName, v.typeNameEn || v.typeName)}</b>
                      <ViolationStatusPill s={v.status} />
                    </div>
                    <p className="mt-1 text-[13.5px] text-muted">{tr('صدرت', 'Issued')} {dateTime(v.issuedAt)}</p>
                    {(v.festivalName || v.camelChip) && (
                      <p className="mt-2 flex flex-wrap items-center gap-2 text-[14px]">
                        {v.festivalName && <span className="pill bg-gold-soft text-gold-deep"><Icon name="trophy" className="h-3.5 w-3.5" />{v.festivalName}</span>}
                        {v.camelChip && <span className="pill bg-stone text-ink/80">{tr('الشريحة', 'Chip')} <span className="num" dir="ltr">{v.camelChip}</span></span>}
                      </p>
                    )}
                    <p className="mt-2 whitespace-pre-line text-[15px] leading-7">{v.description}</p>
                    {v.attachmentName && (
                      <button className="mt-2 inline-flex items-center gap-1.5 text-[14px] font-bold text-pine underline" onClick={() => openAttachment(v)}>
                        <Icon name="file" className="h-4 w-4" />{tr('المرفق', 'Attachment')}: <span dir="ltr">{v.attachmentName}</span>
                      </button>
                    )}
                    {v.status === 'resolved_name' && <p className="mt-2 rounded-lg bg-pine-soft/60 px-3 py-2 text-[13.5px]">{tr('سُوّيت المخالفة بربط اسم بشريحة الجمل دون سداد، ويمكنك مواصلة المشاركة.', 'Settled by linking a name to the camel chip, with no payment; you can keep taking part.')} {dateTime(v.resolvedAt)}{v.resolutionNote && <> — {v.resolutionNote}</>}</p>}
                    {v.status === 'banned' && <p className="mt-2 rounded-lg bg-bad/10 px-3 py-2 text-[13.5px] text-bad"><b>{tr('مُنع الجمل من المشاركة في المهرجان', 'The camel is barred from the festival')}</b> {dateTime(v.resolvedAt)}{v.resolutionNote && <> — {tr('السبب', 'Reason')}: {v.resolutionNote}</>}</p>}
                    {v.status === 'cancelled' && <p className="mt-2 rounded-lg bg-stone px-3 py-2 text-[13.5px]">{tr('أُلغيت', 'Cancelled')} {dateTime(v.cancelledAt)}{v.cancelReason && <> — {tr('السبب', 'Reason')}: {v.cancelReason}</>}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="num text-xl font-extrabold">{v.amount > 0 ? sar(v.amount) : tr('بلا غرامة', 'No fine')}</span>
                  </div>
                </div>
                {v.status === 'unpaid' && (
                  <div className="mt-4 border-t border-line pt-4">
                    <p className="mb-3 font-extrabold">{tr('كيف تسوّي هذه المخالفة؟', 'How do you want to settle this violation?')}</p>
                    <div className={`grid gap-3 ${v.allowsNameResolution ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
                      <div className="flex flex-col gap-2 rounded-xl border-2 border-gold/60 bg-gold-soft/30 p-4">
                        <b className="text-[15px]">{tr('سداد الغرامة ومواصلة المشاركة', 'Pay the fine and keep taking part')}</b>
                        <p className="flex-1 text-[13.5px] leading-6 text-muted">{tr('تسدّد الغرامة بالبطاقة أو Apple Pay فتُغلق المخالفة، ويواصل الجمل المشاركة في المهرجان.', 'Pay the fine by card or Apple Pay; the violation closes and the camel keeps taking part in the festival.')}</p>
                        <button className="btn-gold btn-sm" onClick={() => setPaying(v)}>{tr('سداد', 'Pay')} {sar(v.amount)}</button>
                      </div>
                      {v.allowsNameResolution && (
                        <div className="flex flex-col gap-2 rounded-xl border-2 border-pine/30 bg-pine-soft/30 p-4">
                          <b className="text-[15px]">{tr('ربط اسم تملكه بشريحة الجمل', 'Link a name you own to the camel chip')}</b>
                          {!v.camelChip ? (
                            <p className="flex-1 text-[13.5px] leading-6 text-muted">{tr('لم تُسجَّل شريحة الجمل في هذه المخالفة، تواصل مع الإدارة لإضافتها.', 'No camel chip was recorded on this violation; contact the administration to add it.')}</p>
                          ) : free.length ? (
                            <>
                              <p className="flex-1 text-[13.5px] leading-6 text-muted">{tr(`اربط اسم قعود أو بكار تملكه بالشريحة ${v.camelChip} فتُغلق المخالفة دون سداد.`, `Link a qaadan or bakkar name you own to chip ${v.camelChip}; the violation closes with no payment.`)}</p>
                              <button className="btn-primary btn-sm" onClick={() => setLinking(v)}>{tr('ربط اسم بالشريحة', 'Link a name')}</button>
                            </>
                          ) : (
                            <>
                              <p className="flex-1 text-[13.5px] leading-6 text-muted">{tr('ليس لديك اسم قعود أو بكار غير مربوط بشريحة. يمكنك شراء اسم من المزادات المفتوحة، ثم ربطه بالشريحة من هنا.', 'You have no qaadan or bakkar name that is not on a chip. You can buy a name in the open auctions, then link it here.')}</p>
                              <Link to="/auctions" className="btn-primary btn-sm">{tr('المزادات المفتوحة', 'Open auctions')}</Link>
                            </>
                          )}
                        </div>
                      )}
                      <div className="flex flex-col gap-2 rounded-xl border border-bad/30 bg-bad/5 p-4">
                        <b className="text-[15px] text-bad">{tr('المنع من المشاركة في المهرجان', 'Barred from the festival')}</b>
                        <p className="flex-1 text-[13.5px] leading-6 text-muted">{v.allowsNameResolution
                          ? tr('إن لم تُسدَّد الغرامة ولم يُربط اسم بشريحة الجمل، يحق للجنة منع الجمل من المشاركة في المهرجان.', 'Without payment or a name linked to the chip, the committee may bar the camel from the festival.')
                          : tr('إن لم تُسدَّد الغرامة، يحق للجنة منع الجمل من المشاركة في المهرجان.', 'Without payment, the committee may bar the camel from the festival.')}</p>
                      </div>
                    </div>
                  </div>
                )}
                {v.status === 'paid' && (
                  <div className="mt-4 rounded-lg border border-ok/30 bg-[#E2F0E8]/50 p-4">
                    <p className="mb-2 flex items-center gap-1.5 font-extrabold text-ok"><Icon name="receipt" className="h-4 w-4" />{tr('سند سداد', 'Payment voucher')}</p>
                    <dl className="grid gap-x-6 gap-y-1.5 text-[14px] sm:grid-cols-2">
                      <div className="flex justify-between gap-3"><dt className="text-muted">{tr('رقم السند', 'Voucher no.')}</dt><dd className="num font-bold" dir="ltr">{v.number}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-muted">{tr('المبلغ المسدد', 'Amount paid')}</dt><dd className="num font-bold">{sar(v.amount)}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-muted">{tr('تاريخ السداد', 'Paid on')}</dt><dd className="num">{dateTime(v.paidAt)}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-muted">{tr('وسيلة الدفع', 'Payment method')}</dt><dd>{payMethodLabel(v.paymentMethod)}</dd></div>
                      {v.paymentId && <div className="flex justify-between gap-3 sm:col-span-2"><dt className="text-muted">{tr('مرجع العملية', 'Payment reference')}</dt><dd className="num truncate text-[12.5px]" dir="ltr">{v.paymentId}</dd></div>}
                    </dl>
                    <p className="mt-2 text-[12.5px] text-muted">{tr('سند سداد غرامة بدون ضريبة القيمة المضافة؛ الغرامات غير خاضعة للضريبة ولا تصدر لها فاتورة ضريبية.', 'A fine payment voucher without VAT; fines are not subject to VAT and no tax invoice is issued.')}</p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <Empty title={tr('لا توجد مخالفات', 'No violations')}>
          <p className="text-muted">{tr('لم تصدر بحقك أي مخالفة. تظهر هنا المخالفات والغرامات إن صدرت، ويصلك إشعار بها.', 'No violation has been issued to you. Violations and fines appear here if issued, and you are notified.')}</p>
        </Empty>
      )}

      <PayModal open={!!paying} onClose={() => setPaying(null)} cardOnly
        title={paying ? tr(`سداد المخالفة ${paying.number}`, `Pay violation ${paying.number}`) : ''}
        amount={paying?.amount ?? 0}
        onPay={async () => {
          if (!paying) return
          try {
            await api.payViolation(paying.id)
            toast(tr('سُددت المخالفة، وسند السداد في صفحة المخالفات', 'Violation paid; the payment voucher is on this page'))
            reload()
          } catch (e) { toast((e as Error).message, 'bad'); throw e }
        }} />
      <AttachmentViewer doc={doc} onClose={() => setDoc(null)} />
      {linking && <LinkNameModal v={linking} names={free} onClose={() => setLinking(null)} onDone={() => { setLinking(null); reload(); names.reload() }} />}
    </>
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
