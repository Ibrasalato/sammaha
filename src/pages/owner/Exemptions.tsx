import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Icon } from '../../components/dash'
import { ExemptionDocument, ExemptionStatusPill, camelTypeLabel } from '../../components/ExemptionUi'
import { issuedVerifyUrl } from '../../components/IssuedCertificate'
import { PayModal } from '../../components/PayModal'
import { payMethodLabel } from '../../components/ViolationUi'
import { Empty, ErrorBox, Loading, Modal, PageHead } from '../../components/ui'
import { dateTime, num, sar } from '../../lib/format'
import { tr } from '../../lib/i18n'
import { api, useApp, useLoad } from '../../lib/store'
import type { Exemption } from '../../lib/types'

/**
 * «طلب استثناء المشاركة بدون اسم»: a camel without a registered name may not take part in a festival.
 * The owner asks for an exemption for one chip at one festival; staff set the fine for not naming it; once paid, the exemption document is issued.
 */
export function MyExemptionsPage() {
  const { toast } = useApp()
  const { data, loading, error, reload } = useLoad(() => api.myExemptions(), [])
  const [asking, setAsking] = useState(false)
  const [paying, setPaying] = useState<Exemption | null>(null)
  const [withdrawing, setWithdrawing] = useState<Exemption | null>(null)
  const list = data ?? []
  const due = list.filter((e) => e.status === 'priced')

  async function withdraw(e: Exemption) {
    try { await api.cancelMyExemption(e.id); toast(tr(`سُحب الطلب ${e.number}`, `Request ${e.number} withdrawn`)); setWithdrawing(null); reload() } catch (x) { toast((x as Error).message, 'bad') }
  }

  return (
    <>
      <PageHead title={tr('استثناء المشاركة بدون اسم', 'Exemption to race without a name')}
        sub={tr('لا يشارك الجمل في المهرجان دون اسم مسجل. إن لم يكن لجملك اسم بعد، اطلب استثناءً لشريحته في المهرجان، وتحدد اللجنة غرامة عدم التسمية، وبعد سدادها تصدر لك وثيقة الاستثناء.', 'A camel may not take part in a festival without a registered name. If yours has none yet, ask for an exemption for its chip at the festival; the committee sets the fine for not naming it, and once you pay it the exemption document is issued.')}
        action={<button className="btn-gold" onClick={() => setAsking(true)}><Icon name="plus" className="h-4 w-4" />{tr('طلب استثناء', 'Request an exemption')}</button>} />

      <ol className="mb-5 grid gap-3 sm:grid-cols-4">
        {[
          [tr('تقدّم بالطلب', 'Apply'), tr('رقم الشريحة والمهرجان', 'Chip number and festival')],
          [tr('تدرسه اللجنة', 'Committee review'), tr('وتحدد غرامة عدم التسمية', 'and set the fine for not naming')],
          [tr('تسدّد الغرامة', 'Pay the fine'), tr('بالبطاقة أو Apple Pay', 'by card or Apple Pay')],
          [tr('تصدر الوثيقة', 'Document issued'), tr('بختم ورمز تحقق QR', 'with a seal and a QR check')],
        ].map(([t, s], i) => (
          <li key={t} className="panel flex items-center gap-3 p-3">
            <span className="num grid h-8 w-8 shrink-0 place-items-center rounded-full bg-pine text-[14px] font-extrabold text-gold-light">{num(i + 1)}</span>
            <span className="leading-tight"><b className="block text-[14.5px]">{t}</b><span className="text-[12.5px] text-muted">{s}</span></span>
          </li>
        ))}
      </ol>

      {error ? <ErrorBox text={error} /> : loading && !data ? <Loading /> : list.length ? (
        <>
          {due.length > 0 && (
            <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-gold/50 bg-gold-soft/50 px-5 py-4">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-gold-soft text-gold-deep"><Icon name="receipt" /></span>
              <p className="flex-1 text-[15px]">{tr(`لديك ${num(due.length)} ${due.length === 1 ? 'طلب بانتظار سداد الغرامة' : 'طلبات بانتظار سداد الغرامة'}. تصدر الوثيقة فور السداد.`, `You have ${num(due.length)} ${due.length === 1 ? 'request' : 'requests'} awaiting the fine. The document is issued as soon as you pay.`)}</p>
            </div>
          )}
          <ul className="space-y-3">
            {list.map((e) => (
              <li key={e.id} className={`panel p-5 ${e.status === 'cancelled' || e.status === 'rejected' ? 'opacity-80' : ''}`}>
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-[14rem] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="num text-[13px] text-muted" dir="ltr">{e.number}</span>
                      <b className="text-[16.5px]">{tr('الشريحة', 'Chip')} <span className="num" dir="ltr">{e.camelChip}</span></b>
                      <span className="pill bg-stone text-ink/80">{camelTypeLabel(e.camelType)}</span>
                      <ExemptionStatusPill e={e} />
                    </div>
                    <p className="mt-2 flex flex-wrap items-center gap-2 text-[14px]">
                      <span className="pill bg-gold-soft text-gold-deep"><Icon name="trophy" className="h-3.5 w-3.5" />{e.festivalName}</span>
                      {e.race && <span className="text-muted">{tr('الشوط', 'Race')}: {e.race}</span>}
                    </p>
                    <p className="mt-1 text-[13.5px] text-muted">{tr('قُدّم', 'Submitted')} {dateTime(e.createdAt)}</p>
                    {e.ownerNote && <p className="mt-1 text-[14px]">{tr('ملاحظتك', 'Your note')}: {e.ownerNote}</p>}
                    {e.status === 'priced' && e.staffNote && <p className="mt-2 rounded-lg bg-stone px-3 py-2 text-[13.5px]">{tr('ملاحظة اللجنة', 'Committee note')}: {e.staffNote}</p>}
                    {e.status === 'rejected' && <p className="mt-2 rounded-lg bg-bad/10 px-3 py-2 text-[13.5px] text-bad">{tr('رُفض', 'Rejected')} {dateTime(e.rejectedAt)} — {tr('السبب', 'Reason')}: {e.rejectReason}</p>}
                    {e.status === 'cancelled' && <p className="mt-2 rounded-lg bg-stone px-3 py-2 text-[13.5px]">{tr('سحبت الطلب', 'You withdrew the request')} {dateTime(e.cancelledAt)}</p>}
                    {e.revokedAt && <p className="mt-2 rounded-lg bg-bad/10 px-3 py-2 text-[13.5px] text-bad">{tr('أُلغيت الوثيقة', 'The document was revoked')} {dateTime(e.revokedAt)} — {tr('السبب', 'Reason')}: {e.revokeReason}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="num text-xl font-extrabold">{e.amount != null ? sar(e.amount) : <span className="text-[14px] font-bold text-muted">{tr('الغرامة قيد التحديد', 'Fine to be set')}</span>}</span>
                    {e.status === 'priced' && <button className="btn-gold btn-sm" onClick={() => setPaying(e)}>{tr('سداد الغرامة', 'Pay the fine')}</button>}
                    {e.status === 'paid' && <Link to={`/dashboard/exemptions/${e.number}`} className="btn-primary btn-sm"><Icon name="file" className="h-4 w-4" />{tr('الوثيقة', 'Document')}</Link>}
                    {(e.status === 'pending' || e.status === 'priced') && <button className="btn-ghost btn-sm" onClick={() => setWithdrawing(e)}>{tr('سحب الطلب', 'Withdraw')}</button>}
                  </div>
                </div>
                {e.status === 'paid' && (
                  <dl className="mt-4 grid gap-x-6 gap-y-1.5 rounded-lg border border-ok/30 bg-[#E2F0E8]/50 p-4 text-[14px] sm:grid-cols-3">
                    <div className="flex justify-between gap-3"><dt className="text-muted">{tr('تاريخ السداد', 'Paid on')}</dt><dd className="num">{dateTime(e.paidAt)}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-muted">{tr('وسيلة الدفع', 'Payment method')}</dt><dd>{payMethodLabel(e.paymentMethod)}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-muted">{tr('رمز التوثيق', 'Authentication code')}</dt><dd className="num text-[12.5px] font-bold" dir="ltr">{e.signature}</dd></div>
                  </dl>
                )}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <Empty title={tr('لا توجد طلبات استثناء', 'No exemption requests')}>
          <p className="text-muted">{tr('إن كان لديك جمل بلا اسم مسجل وتريد مشاركته في مهرجان، اطلب له استثناءً من هنا.', 'If you have a camel without a registered name and want it to take part in a festival, request an exemption here.')}</p>
          <button className="btn-primary mt-3" onClick={() => setAsking(true)}>{tr('طلب استثناء', 'Request an exemption')}</button>
        </Empty>
      )}

      {asking && <RequestModal onClose={() => setAsking(false)} onDone={() => { setAsking(false); reload() }} />}
      <PayModal open={!!paying} onClose={() => setPaying(null)} cardOnly
        title={paying ? tr(`غرامة عدم التسمية — ${paying.number}`, `Fine for not naming — ${paying.number}`) : ''}
        amount={paying?.amount ?? 0}
        onPay={async () => {
          if (!paying) return
          try {
            const e = await api.payExemption(paying.id)
            toast(tr(`سُدّدت الغرامة وصدرت وثيقة الاستثناء ${e.number}`, `Fine paid; exemption document ${e.number} issued`))
            reload()
          } catch (x) { toast((x as Error).message, 'bad'); throw x }
        }} />
      <Modal open={!!withdrawing} onClose={() => setWithdrawing(null)} title={tr('سحب طلب الاستثناء', 'Withdraw the exemption request')}>
        <p className="text-[15px]">{tr(`هل تريد سحب الطلب ${withdrawing?.number ?? ''} للشريحة ${withdrawing?.camelChip ?? ''}؟ لن يحق للجمل المشاركة بدون اسم في هذا المهرجان إلا بطلب جديد.`, `Withdraw request ${withdrawing?.number ?? ''} for chip ${withdrawing?.camelChip ?? ''}? The camel cannot take part without a name at this festival unless you request again.`)}</p>
        <div className="mt-4 flex gap-2">
          <button className="btn-primary flex-1" onClick={() => withdrawing && withdraw(withdrawing)}>{tr('سحب الطلب', 'Withdraw')}</button>
          <button className="btn-ghost" onClick={() => setWithdrawing(null)}>{tr('رجوع', 'Back')}</button>
        </div>
      </Modal>
    </>
  )
}

/** the request form: festival, chip (typed, or picked from «إبلي»), قعود or بكرة, the race (optional) and a note */
function RequestModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { toast } = useApp()
  const festivals = useLoad(() => api.exemptionFestivals(), [])
  const camels = useLoad(() => api.myCamels().catch(() => null), [])
  const unnamed = (camels.data?.camels ?? []).filter((c) => !c.reservedId && c.chipNumbers.length)
  const [festivalId, setFestivalId] = useState('')
  const [chip, setChip] = useState('')
  const [type, setType] = useState<'qaadan' | 'bakkar' | ''>('')
  const [race, setRace] = useState('')
  const [note, setNote] = useState('')
  const [ok, setOk] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const fid = festivalId || festivals.data?.[0]?.id || ''

  function pickCamel(id: string) {
    const c = unnamed.find((x) => x.id === id)
    if (!c) return
    setChip(c.chipNumbers[0])
    if (c.sex === 'male') setType('qaadan')
    if (c.sex === 'female') setType('bakkar')
  }

  async function submit() {
    setBusy(true); setErr('')
    try {
      const e = await api.requestExemption({ camelChip: chip, camelType: type as 'qaadan' | 'bakkar', festivalId: fid, race: race.trim() || undefined, note: note.trim() || undefined })
      toast(tr(`أُرسل الطلب ${e.number}، وستصلك قيمة الغرامة بعد دراسته`, `Request ${e.number} sent; you will be told the fine once it is reviewed`))
      onDone()
    } catch (x) { setErr((x as Error).message) } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title={tr('طلب استثناء مشاركة بدون اسم', 'Request an exemption to race without a name')}>
      {festivals.loading && !festivals.data ? <Loading /> : !festivals.data?.length ? (
        <p className="text-[15px] text-muted">{tr('لا توجد مهرجانات مفتوحة لطلبات الاستثناء حاليًا.', 'No festival is open for exemption requests right now.')}</p>
      ) : (
        <div className="space-y-4">
          {err && <ErrorBox text={err} />}
          <div>
            <label htmlFor="exf" className="mb-1 block font-bold">{tr('المهرجان', 'Festival')}</label>
            <select id="exf" className="field" value={fid} onChange={(x) => setFestivalId(x.target.value)}>
              {festivals.data.map((f) => <option key={f.id} value={f.id}>{tr(f.name, f.nameEn || f.name)}</option>)}
            </select>
          </div>
          {unnamed.length > 0 && (
            <div>
              <label htmlFor="exc" className="mb-1 block font-bold">{tr('من إبلي غير المسماة', 'From my unnamed camels')}</label>
              <select id="exc" className="field" defaultValue="" onChange={(x) => pickCamel(x.target.value)}>
                <option value="">{tr('اختر جملًا لتعبئة الشريحة…', 'Pick a camel to fill in the chip…')}</option>
                {unnamed.map((c) => <option key={c.id} value={c.id}>{c.name ? `${c.name} · ` : ''}{c.chipNumbers[0]}</option>)}
              </select>
            </div>
          )}
          <div>
            <label htmlFor="exchip" className="mb-1 block font-bold">{tr('رقم الشريحة', 'Chip number')}</label>
            <input id="exchip" className="field num" dir="ltr" inputMode="numeric" value={chip} maxLength={40} onChange={(x) => setChip(x.target.value.replace(/\s/g, ''))} placeholder="9821000000000" />
          </div>
          <fieldset>
            <legend className="mb-1 font-bold">{tr('نوع الجمل', 'Camel')}</legend>
            <div className="grid grid-cols-2 gap-2">
              {(['qaadan', 'bakkar'] as const).map((t) => (
                <button key={t} type="button" aria-pressed={type === t} onClick={() => setType(t)} className={`rounded-lg border-2 p-3 font-bold ${type === t ? 'border-pine bg-pine-soft/60' : 'border-line'}`}>{camelTypeLabel(t)}</button>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor="exr" className="mb-1 block font-bold">{tr('الشوط (اختياري)', 'Race (optional)')}</label>
            <input id="exr" className="field" value={race} maxLength={150} onChange={(x) => setRace(x.target.value)} placeholder={tr('مثال: شوط الحقايق', 'e.g. the hiqq race')} />
          </div>
          <div>
            <label htmlFor="exn" className="mb-1 block font-bold">{tr('ملاحظة للجنة (اختياري)', 'Note to the committee (optional)')}</label>
            <textarea id="exn" className="field" rows={2} value={note} maxLength={500} onChange={(x) => setNote(x.target.value)} />
          </div>
          <div className="rounded-lg bg-stone/70 p-3 text-[13px] leading-6 text-muted">
            {tr('تدرس اللجنة الطلب وتحدد غرامة عدم التسمية، ويصلك إشعار بقيمتها. تُسدَّد الغرامة بالبطاقة أو Apple Pay، وهي غير خاضعة لضريبة القيمة المضافة. تسري الوثيقة لهذا المهرجان وهذه الشريحة فقط.', 'The committee reviews the request and sets the fine for not naming the camel; you are notified of the amount. The fine is paid by card or Apple Pay and carries no VAT. The document is valid for this festival and this chip only.')}
          </div>
          <label className="flex items-start gap-2 text-[14px]"><input type="checkbox" className="mt-1" checked={ok} onChange={(x) => setOk(x.target.checked)} />{tr('أقرّ بأن الشريحة لجمل أملكه، وأن البيانات صحيحة.', 'I confirm the chip belongs to a camel I own and the details are correct.')}</label>
          <div className="flex gap-2">
            <button className="btn-primary flex-1" disabled={busy || !ok || !fid || chip.length < 5 || !type} onClick={submit}>{busy ? tr('جارٍ الإرسال…', 'Sending…') : tr('إرسال الطلب', 'Send request')}</button>
            <button className="btn-ghost" onClick={onClose}>{tr('إلغاء', 'Cancel')}</button>
          </div>
        </div>
      )}
    </Modal>
  )
}

/** one exemption document: share the verification link, print it (A4 landscape) */
export function ExemptionView({ staff = false }: { staff?: boolean }) {
  const { number = '' } = useParams()
  const { toast } = useApp()
  const { data, loading, error } = useLoad(() => api.exemption(number), [number])
  if (loading && !data) return <Loading />
  if (error || !data) return <ErrorBox text={error ?? tr('طلب الاستثناء غير موجود', 'Exemption request not found')} />
  const e = data
  const back = staff ? '/admin/exemptions' : '/dashboard/exemptions'
  if (e.status !== 'paid' || !e.signature) {
    return (
      <div className="panel mx-auto max-w-xl p-6 text-center">
        <p className="text-[17px] font-extrabold">{tr('لم تصدر الوثيقة بعد', 'The document is not issued yet')}</p>
        <p className="mt-1 text-muted">{tr('تصدر وثيقة الاستثناء بعد سداد غرامة عدم التسمية.', 'The exemption document is issued once the fine is paid.')}</p>
        <Link to={back} className="btn-ghost btn-sm mt-4">{tr('رجوع', 'Back')}</Link>
      </div>
    )
  }
  const link = issuedVerifyUrl({ number: e.number, signature: e.signature })
  return (
    <>
      <style>{'@page { size: A4 landscape; margin: 0 }'}</style>
      <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
        <Link to={back} className="text-sm font-medium text-muted hover:text-pine">{staff ? tr('طلبات الاستثناء', 'Exemption requests') : tr('استثناء المشاركة', 'Exemptions')}</Link>
        <ExemptionStatusPill e={e} />
        <span className="ms-auto" />
        <button className="btn-ghost btn-sm" onClick={async () => { try { await navigator.clipboard.writeText(link); toast(tr('نُسخ رابط التحقق', 'Verification link copied')) } catch { toast(link) } }}>{tr('نسخ رابط التحقق', 'Copy verification link')}</button>
        <a className="btn-ghost btn-sm" href={link} target="_blank" rel="noreferrer">{tr('صفحة التحقق', 'Verification page')}</a>
        <button className="btn-primary" onClick={() => window.print()}><Icon name="file" className="h-4 w-4" />{tr('طباعة أو حفظ PDF', 'Print or save PDF')}</button>
      </div>
      {e.revokedAt && <p className="mb-3 rounded-lg bg-bad/10 p-3 text-[14px] text-bad print:hidden">{tr(`أُلغيت هذه الوثيقة: ${e.revokeReason ?? ''}`, `This document was revoked: ${e.revokeReason ?? ''}`)}</p>}
      <div className="overflow-x-auto print:overflow-visible"><div className="min-w-[860px] print:min-w-0"><ExemptionDocument e={e} /></div></div>
    </>
  )
}

export function StaffExemptionView() {
  return <ExemptionView staff />
}
