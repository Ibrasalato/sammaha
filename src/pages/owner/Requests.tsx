import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PayModal } from '../../components/PayModal'
import { TableTools, useTableFilter } from '../../components/TableTools'
import { Empty, ErrorBox, Loading, Modal, NameSeal, PageHead, RequestStatusPill, TypeBadge, TypePicker } from '../../components/ui'
import { RULES, typeOptions, TYPE_CLS } from '../../lib/config'
import { dateTime, sar } from '../../lib/format'
import { api, useApp, useLoad } from '../../lib/store'
import { ClosedPage, useClosed } from '../../components/SettingsUi'
import type { Candidate, LogoRequest, NameCheck, NameType } from '../../lib/types'
import { tr } from '../../lib/i18n'
import { localizeServerText as L } from '../../lib/serverText'

const depositStateLabels = (): Record<LogoRequest['depositState'], string> => ({
  none: tr('لم يُسدَّد', 'Not paid'),
  held: tr('محجوز لدى المنصة', 'Held by the platform'),
  applied: tr('خُصم من قيمة الاسم الذي رسا عليك', 'Deducted from the price of the name awarded to you'),
  refunded: tr('أُعيد إلى محفظتك', 'Returned to your wallet'),
  fee: tr('رسوم دراسة غير مستردة', 'Non-refundable review fee'),
})

function CandidateChip({ c, type }: { c: Candidate; type: NameType }) {
  const tone = c.status === 'accepted' ? 'text-ok' : c.status === 'rejected' ? 'text-bad line-through' : c.status === 'withdrawn' ? 'text-muted line-through' : 'text-ink'
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1 font-extrabold ${tone}`}>
      <span className={`h-2 w-2 rounded-full ${TYPE_CLS[type].dot}`} />{c.name}
    </span>
  )
}

// values are sent to the API as-is (Arabic); only the visible labels are translated
const CANCEL_REASONS = ['لم أعد أحتاج الأسماء', 'أريد تغيير الأسماء المقترحة', 'طال وقت المراجعة', 'سبب آخر']
const cancelReasonLabel = (x: string) => ({
  'لم أعد أحتاج الأسماء': tr('لم أعد أحتاج الأسماء', 'I no longer need the names'),
  'أريد تغيير الأسماء المقترحة': tr('أريد تغيير الأسماء المقترحة', 'I want to change the proposed names'),
  'طال وقت المراجعة': tr('طال وقت المراجعة', 'The review is taking too long'),
  'سبب آخر': tr('سبب آخر', 'Other reason'),
} as Record<string, string>)[x] ?? x

/** Confirms a cancellation, says exactly what happens to the guarantee and any scheduled auctions. */
function CancelRequest({ r, onClose, onDone }: { r: LogoRequest; onClose: () => void; onDone: () => void }) {
  const { toast } = useApp()
  const nav = useNavigate()
  const [reason, setReason] = useState(CANCEL_REASONS[0])
  const [other, setOther] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const held = r.depositState === 'held'
  const scheduled = r.candidates.filter((c) => c.auctionId).length
  async function confirm() {
    setBusy(true); setErr('')
    try {
      const { refunded } = await api.cancelMyRequest(r.id, reason === 'سبب آخر' ? other : reason)
      toast(refunded ? tr(`أُلغي الطلب ${r.number} وأُعيد ${sar(refunded)} إلى محفظتك`, `Request ${r.number} cancelled and ${sar(refunded)} returned to your wallet`) : tr(`أُلغي الطلب ${r.number}`, `Request ${r.number} cancelled`))
      onDone()
      if (refunded) nav('/dashboard/wallet')
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title={tr(`إلغاء الطلب ${r.number}`, `Cancel request ${r.number}`)}>
      <div className="space-y-4">
        {err && <ErrorBox text={err} />}
        <ul className="space-y-2 rounded-lg bg-stone p-4 text-[15px]">
          {held
            ? <li className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ok" /><span>{tr('يُعاد ضمان المزاد', 'The auction guarantee of')} <b>{sar(r.depositAmount)}</b> {tr('إلى محفظتك فورًا، وتستخدمه في طلب جديد.', 'is returned to your wallet immediately for use in a new request.')}</span></li>
            : r.depositState === 'fee'
              ? <li className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-bad" /><span>{tr('رسوم الدراسة', 'The review fee of')} <b>{sar(r.depositAmount)}</b> {tr('غير مستردة، فلن يُعاد أي مبلغ.', 'is non-refundable, so nothing will be returned.')}</span></li>
              : <li className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-muted" />{r.kind === 'investment' ? tr('لم تسدّد الرسوم بعد، فلا يوجد مبلغ للاسترداد.', 'You have not paid the fee yet, so there is nothing to refund.') : tr('لم تسدّد الضمان بعد، فلا يوجد مبلغ للاسترداد.', 'You have not paid the guarantee yet, so there is nothing to refund.')}</li>}
          {scheduled > 0 && <li className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" /><span>{scheduled === 1 ? tr('يُلغى المزاد المجدول لأسماء هذا الطلب قبل أن يبدأ.', 'The scheduled auction for this request’s names is cancelled before it starts.') : tr(`تُلغى المزادات المجدولة (${scheduled}) لأسماء هذا الطلب قبل أن يبدأ.`, `The scheduled auctions (${scheduled}) for this request’s names are cancelled before they start.`)}</span></li>}
          <li className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-bad" />{tr('تصبح الأسماء متاحة لغيرك، ولا يمكن التراجع عن الإلغاء.', 'The names become available to others, and the cancellation cannot be undone.')}</li>
        </ul>
        <div>
          <label className="label" htmlFor="cr">{tr('سبب الإلغاء', 'Cancellation reason')}</label>
          <select id="cr" className="field" value={reason} onChange={(e) => setReason(e.target.value)}>{CANCEL_REASONS.map((x) => <option key={x} value={x}>{cancelReasonLabel(x)}</option>)}</select>
          {reason === 'سبب آخر' && <input className="field mt-2" maxLength={300} placeholder={tr('اكتب السبب (اختياري)', 'Enter the reason (optional)')} value={other} onChange={(e) => setOther(e.target.value)} />}
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn bg-bad text-paper hover:bg-bad/90" disabled={busy} onClick={confirm}>{busy ? tr('جارٍ الإلغاء…', 'Cancelling…') : held ? tr(`إلغاء واسترداد ${sar(r.depositAmount)}`, `Cancel and refund ${sar(r.depositAmount)}`) : tr('تأكيد الإلغاء', 'Confirm cancellation')}</button>
          <button className="btn-ghost" disabled={busy} onClick={onClose}>{tr('تراجع', 'Back')}</button>
        </div>
      </div>
    </Modal>
  )
}

/** Withdraw a single name. The last remaining name cancels the request and refunds the guarantee. */
function WithdrawName({ r, c, onClose, onDone }: { r: LogoRequest; c: Candidate; onClose: () => void; onDone: () => void }) {
  const { toast } = useApp()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const others = r.candidates.filter((x) => x.id !== c.id && (x.status === 'pending' || x.status === 'accepted'))
  const last = others.length === 0
  const held = r.depositState === 'held'
  async function confirm() {
    setBusy(true); setErr('')
    try {
      const res = await api.withdrawName(r.id, c.id)
      toast(res.requestCancelled ? (res.refunded ? tr(`سُحبت كل الأسماء وأُعيد ${sar(res.refunded)} إلى محفظتك`, `All names withdrawn and ${sar(res.refunded)} returned to your wallet`) : tr('سُحبت كل الأسماء وأُلغي الطلب', 'All names withdrawn and the request cancelled')) : tr(`سُحب الاسم «${c.name}» من الطلب`, `«${c.name}» withdrawn from the request`))
      onDone()
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title={tr(`سحب الاسم «${c.name}»`, `Withdraw «${c.name}»`)}>
      <div className="space-y-4">
        {err && <ErrorBox text={err} />}
        <div className="flex justify-center"><NameSeal name={c.name} type={r.type} size="md" /></div>
        <ul className="space-y-2 rounded-lg bg-stone p-4 text-[15px]">
          {c.auctionId && <li className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" /><span>{tr('يُلغى مزاده المجدول قبل أن يبدأ.', 'Its scheduled auction is cancelled before it starts.')}</span></li>}
          {last
            ? <li className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ok" /><span>{tr('هذا آخر اسم في الطلب، فيُلغى الطلب كاملًا', 'This is the last name in the request, so the whole request is cancelled')}{held ? <> {tr('ويُعاد الضمان', 'and the guarantee of')} <b>{sar(r.depositAmount)}</b> {tr('إلى محفظتك.', 'is returned to your wallet.')}</> : '.'}</span></li>
            : <li className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-pine" /><span>{tr('يستمر الطلب بالأسماء الباقية', 'The request continues with the remaining names')} ({others.map((x) => x.name).join(tr('، ', ', '))}){tr('، ويبقى الضمان لها. إن سحبتها كلها يُعاد الضمان إلى محفظتك.', ', and the guarantee stays with them. If you withdraw them all, the guarantee is returned to your wallet.')}</span></li>}
          <li className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-bad" /><span>{tr('يصبح الاسم متاحًا لغيرك، ولا يمكن التراجع.', 'The name becomes available to others. This cannot be undone.')}</span></li>
        </ul>
        <div className="flex flex-wrap gap-2">
          <button className="btn bg-bad text-paper hover:bg-bad/90" disabled={busy} onClick={confirm}>{busy ? tr('جارٍ السحب…', 'Withdrawing…') : last && held ? tr(`سحب واسترداد ${sar(r.depositAmount)}`, `Withdraw and refund ${sar(r.depositAmount)}`) : tr('سحب الاسم', 'Withdraw name')}</button>
          <button className="btn-ghost" disabled={busy} onClick={onClose}>{tr('تراجع', 'Back')}</button>
        </div>
      </div>
    </Modal>
  )
}

export function MyRequests() {
  const { toast } = useApp()
  const { data, loading, reload } = useLoad(() => api.myRequests(), [])
  const [paying, setPaying] = useState<LogoRequest | null>(null)
  const [cancelling, setCancelling] = useState<LogoRequest | null>(null)
  const tf = useTableFilter(data, {
    fields: (r) => [r.number, ...r.candidates.map((c) => c.name)],
    filters: [
      { key: 'status', label: tr('الحالة', 'Status'), options: [['', tr('الكل', 'All')], ['pending_payment', tr('بانتظار السداد', 'Awaiting payment')], ['under_review', tr('تحت المراجعة', 'Under review')], ['accepted', tr('مقبول', 'Accepted')], ['rejected', tr('مرفوض', 'Rejected')], ['cancelled', tr('ملغى', 'Cancelled')]], test: (r, v) => r.status === v },
      { key: 'type', label: tr('النوع', 'Type'), options: typeOptions('', tr('الكل', 'All')), test: (r, v) => r.type === v },
      { key: 'kind', label: tr('الطلب', 'Request'), options: [['', tr('الكل', 'All')], ['standard', tr('طلب شعار', 'Name request')], ['compound', tr('اسم مركب', 'Compound name')], ['investment', tr('استثمار الاسم', 'Name investment')]], test: (r, v) => (r.kind ?? 'standard') === v },
    ],
  })

  return (
    <>
      <PageHead title={tr('طلبات الشعارات', 'Name requests')} sub={tr('كل طلب يضم ثلاثة أسماء مقترحة وضمان مزاد قدره 50 ريال، وتقبل اللجنة اسمًا واحدًا منها. ولأي اسم تملكه تقدر تطلب له اسمًا مركبًا.', 'Each request has three proposed names and a 50 SAR auction guarantee; the committee accepts one of them. For any name you own, you can request a compound name.')}
        action={<div className="flex flex-wrap gap-2"><Link to="/dashboard/names" className="btn-ghost">{tr('طلب اسم مركب', 'Request a compound name')}</Link><Link to="/dashboard/requests/new" className="btn-gold">{tr('طلب شعار جديد', 'New name request')}</Link></div>} />
      {loading && !data ? <Loading /> : data?.length ? (
        <>
        <TableTools t={tf} placeholder={tr('بحث برقم الطلب أو الاسم', 'Search by request number or name')} />
        {!tf.list.length && <p className="panel px-5 py-10 text-center text-muted">{tr('لا توجد نتائج مطابقة.', 'No matching results.')} <button className="font-bold text-pine underline" onClick={tf.reset}>{tr('مسح التصفية', 'Clear filters')}</button></p>}
        <ul className="space-y-3">
          {tf.list.map((r) => (
            <li key={r.id} className="panel p-4">
              <div className="flex flex-wrap items-center gap-3">
                <Link to={`/dashboard/requests/${r.id}`} className="num font-semibold hover:text-gold-deep">{r.number}</Link>
                <TypeBadge type={r.type} />
                {r.kind === 'compound' && <span className="pill bg-gold-soft text-gold-deep">{tr(`اسم مركب لـ«${r.baseName}»`, `Compound name for «${r.baseName}»`)}</span>}
                {r.kind === 'investment' && <span className="pill bg-invest-soft text-invest-deep">{tr('استثمار الاسم', 'Name investment')}</span>}
                <RequestStatusPill status={r.status} />
                <span className="ms-auto text-sm text-muted">{dateTime(r.submittedAt || r.createdAt)}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">{r.candidates.map((c) => <CandidateChip key={c.id} c={c} type={r.type} />)}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {r.status === 'pending_payment' && <button className="btn-gold btn-sm" onClick={() => setPaying(r)}>{r.kind === 'investment' ? tr('سداد الرسوم', 'Pay fee') : tr('سداد الضمان', 'Pay guarantee')} {sar(r.depositAmount)}</button>}
                <Link to={`/dashboard/requests/${r.id}`} className="btn-ghost btn-sm">{tr('التفاصيل', 'Details')}</Link>
                {r.cancellable && <button className="btn-danger btn-sm" onClick={() => setCancelling(r)}>{r.depositState === 'held' ? tr('إلغاء كل الأسماء واسترداد الضمان', 'Cancel all names and refund the guarantee') : tr('إلغاء الطلب', 'Cancel request')}</button>}
                {r.candidates.some((c) => c.withdrawable) && r.candidates.filter((c) => c.status === 'pending' || c.status === 'accepted').length > 1 && <Link to={`/dashboard/requests/${r.id}`} className="btn-ghost btn-sm">{tr('سحب اسم معيّن', 'Withdraw a specific name')}</Link>}
              </div>
            </li>
          ))}
        </ul>
        </>
      ) : (
        <Empty title={tr('لم تقدّم أي طلب بعد', 'You have not submitted any requests yet')}>
          <p className="text-muted">{tr('اختر ثلاثة أسماء لإبلك وقدّمها للجنة الاعتماد.', 'Choose three names for your camels and submit them to the Accreditation Committee.')}</p>
          <Link to="/dashboard/requests/new" className="btn-gold">{tr('طلب شعار جديد', 'New name request')}</Link>
        </Empty>
      )}
      {cancelling && <CancelRequest r={cancelling} onClose={() => setCancelling(null)} onDone={() => { setCancelling(null); reload() }} />}
      {paying && (
        <PayModal open title={paying.kind === 'investment' ? tr(`رسوم دراسة الطلب ${paying.number}`, `Review fee for request ${paying.number}`) : tr(`سداد ضمان الطلب ${paying.number}`, `Pay guarantee for request ${paying.number}`)} amount={paying.depositAmount} onClose={() => setPaying(null)}
          onPay={async (m) => {
            try { await api.payDeposit(paying.id, m); toast(tr('تم السداد، طلبك الآن تحت المراجعة', 'Payment received. Your request is now under review')); reload() } catch (e) { toast((e as Error).message, 'bad'); throw e }
          }} />
      )}
    </>
  )
}

const VERDICT_STYLE: Record<NameCheck['verdict'], string> = {
  available: 'text-ok',
  similar: 'text-warn',
  exact: 'text-bad',
  invalid: 'text-bad',
  duplicate: 'text-bad',
}

export function NewRequest() {
  const { toast } = useApp()
  const nav = useNavigate()
  const [type, setType] = useState<NameType | null>(null)
  const [names, setNames] = useState<string[]>(Array(RULES.namesPerRequest).fill(''))
  const [checks, setChecks] = useState<(NameCheck | null)[]>([])
  const [created, setCreated] = useState<LogoRequest | null>(null)
  const [busy, setBusy] = useState(false)
  const paid = useRef(false)
  const closed = useClosed('requests')

  // live matching check, debounced
  useEffect(() => {
    if (!type || names.every((n) => !n.trim())) { setChecks([]); return }
    const t = setTimeout(() => {
      api.checkNames(names, type).then((res) => setChecks(res.map((c, i) => (names[i].trim() ? c : null))))
    }, 350)
    return () => clearTimeout(t)
  }, [names, type])

  const blocked = checks.some((c) => c && ['exact', 'invalid', 'duplicate'].includes(c.verdict))
  const complete = names.every((n) => n.trim()) && checks.length === names.length && checks.every(Boolean)

  async function submit() {
    if (!type) return
    setBusy(true)
    try { setCreated(await api.createRequest(type, names)) } catch (e) { toast((e as Error).message, 'bad') } finally { setBusy(false) }
  }

  if (closed && !created) return <ClosedPage intake="requests" title={tr('طلب شعار جديد', 'New name request')} back="/dashboard/requests" />

  return (
    <>
      <PageHead title={tr('طلب شعار جديد', 'New name request')} sub={tr('اختر نوع الشعار ثم اكتب ثلاثة أسماء مقترحة بالترتيب الذي تفضّله. تقبل اللجنة اسمًا واحدًا منها فقط ويُطرح في المزاد.', 'Choose the name type, then enter three proposed names in your order of preference. The committee accepts only one, which goes to auction.')} />
      <section className="panel p-5">
        <h2 className="text-lg">{tr('نوع الشعار', 'Name type')}</h2>
        <div className="mt-3"><TypePicker value={type} onChange={setType} /></div>
      </section>

      <section className={`panel mt-4 p-5 ${type ? '' : 'pointer-events-none opacity-50'}`} aria-disabled={!type}>
        <h2 className="text-lg">{tr('الأسماء المقترحة', 'Proposed names')}</h2>
        <p className="mt-1 text-sm text-muted">{tr('نتحقق من كل اسم أثناء الكتابة. الاسم المطابق تمامًا لاسم مسجل لا يُقبل، والاسم الشبيه تراجعه اللجنة.', 'We check each name as you type. An exact match of a registered name is not accepted; similar names are reviewed by the committee.')}</p>
        <div className="mt-4 space-y-4">
          {names.map((n, i) => {
            const c = checks[i]
            return (
              <div key={i}>
                <label className="label" htmlFor={`n${i}`}>{tr(`الاسم ${['الأول', 'الثاني', 'الثالث'][i]}`, `${['First', 'Second', 'Third'][i]} name`)}</label>
                <input id={`n${i}`} className={`field font-extrabold text-lg ${c && VERDICT_STYLE[c.verdict] === 'text-bad' ? 'border-bad' : ''}`} value={n} maxLength={30}
                  onChange={(e) => setNames(names.map((x, j) => (j === i ? e.target.value : x)))} />
                {c && (
                  <p className={`mt-1 text-sm font-semibold ${VERDICT_STYLE[c.verdict]}`}>
                    {L(c.message ?? '')}
                    {c.verdict === 'similar' && <span className="font-normal text-muted"> ({c.hits.slice(0, 3).map((h) => h.name).join(tr('، ', ', '))})</span>}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </section>

      <section className="panel mt-4 flex flex-wrap items-center gap-4 p-5">
        <div className="flex-1">
          <p className="font-semibold">{tr('ضمان المزاد', 'Auction guarantee')} {sar(RULES.depositAmount)}</p>
          <p className="text-sm text-muted">{tr('يُعاد إلى محفظتك إن رُفض الطلب أو أُلغي، ويُحتسب من قيمة الاسم إن رسا عليك.', 'Returned to your wallet if the request is rejected or cancelled, and counted toward the price if the name is awarded to you.')}</p>
        </div>
        <button className="btn-gold px-6" disabled={!type || !complete || blocked || busy} onClick={submit}>{tr('رفع الطلب وسداد الضمان', 'Submit request and pay guarantee')}</button>
      </section>

      {created && (
        <PayModal open title={tr(`سداد ضمان الطلب ${created.number}`, `Pay guarantee for request ${created.number}`)} amount={created.depositAmount}
          onClose={() => { if (!paid.current) nav('/dashboard/requests') }}
          onPay={async (m) => {
            try { await api.payDeposit(created.id, m); paid.current = true; toast(tr('تم رفع طلبك، وهو الآن تحت المراجعة', 'Your request was submitted and is now under review')); nav(`/dashboard/requests/${created.id}`) } catch (e) { toast((e as Error).message, 'bad'); throw e }
          }} />
      )}
    </>
  )
}

export function RequestDetail() {
  const { id = '' } = useParams()
  const { toast } = useApp()
  const { data: r, error, loading, reload } = useLoad(() => api.getRequest(id), [id])
  const [paying, setPaying] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [withdrawing, setWithdrawing] = useState<Candidate | null>(null)
  if (loading && !r) return <Loading />
  if (error || !r) return <ErrorBox text={error || tr('الطلب غير موجود', 'Request not found')} />

  const compound = r.kind === 'compound'
  const invest = r.kind === 'investment'
  const auctionOf = r.candidates.find((c) => c.auctionId)
  const steps: [string, boolean][] = invest ? [
    [tr('سداد رسوم الدراسة', 'Pay review fee'), r.depositPaid],
    [tr('دراسة اللجنة', 'Committee review'), !!r.reviewedAt],
    [tr('المزاد العام', 'Public auction'), !!auctionOf],
  ] : compound ? [
    [tr('تقديم الطلب', 'Submit request'), true],
    [tr('مراجعة اللجنة', 'Committee review'), !!r.reviewedAt],
    [tr('التسجيل باسمك', 'Registered to you'), r.status === 'accepted'],
  ] : [
    [tr('تقديم الطلب', 'Submit request'), true],
    [tr('سداد الضمان', 'Pay guarantee'), r.depositPaid],
    [tr('مراجعة اللجنة', 'Committee review'), !!r.reviewedAt],
    [tr('فتح المزاد', 'Auction opens'), r.candidates.some((c) => c.auctionId)],
  ]

  return (
    <>
      <PageHead title={compound ? tr(`طلب اسم مركب ${r.number}`, `Compound name request ${r.number}`) : invest ? tr(`استثمار الاسم ${r.number}`, `Name investment ${r.number}`) : tr(`الطلب ${r.number}`, `Request ${r.number}`)} sub={<span className="flex flex-wrap items-center gap-2"><TypeBadge type={r.type} />{compound && <span className="pill bg-gold-soft text-gold-deep">{tr(`مركب من «${r.baseName}»`, `Compound of «${r.baseName}»`)}</span>}{invest && <span className="pill bg-invest-soft text-invest-deep">{tr('استثمار الاسم', 'Name investment')}</span>}<RequestStatusPill status={r.status} /></span>}
        action={r.cancellable ? (
          <button className="btn-danger btn-sm" onClick={() => setCancelling(true)}>{r.depositState === 'held' ? tr('إلغاء كل الأسماء واسترداد الضمان', 'Cancel all names and refund the guarantee') : tr('إلغاء الطلب', 'Cancel request')}</button>
        ) : undefined} />

      {r.status === 'cancelled' && (
        <div className="mb-4 rounded-xl border border-line bg-stone p-4 text-[15px]">
          <b>{tr('أُلغي هذا الطلب', 'This request was cancelled')}{r.cancelledBy === 'owner' ? tr(' بطلبك', ' at your request') : ''}{r.cancelledAt ? tr(` في ${dateTime(r.cancelledAt)}`, ` on ${dateTime(r.cancelledAt)}`) : ''}.</b>
          {r.cancelReason && <span className="text-muted"> {tr('السبب:', 'Reason:')} {r.cancelReason}.</span>}
          {r.depositState === 'refunded' && <> {tr('أُعيد الضمان', 'The guarantee of')} {sar(r.depositAmount)} {tr('إلى', 'was returned to')} <Link to="/dashboard/wallet" className="font-bold text-pine underline">{tr('محفظتك', 'your wallet')}</Link>.</>}
        </div>
      )}
      {r.status === 'accepted' && !r.cancellable && !invest && (
        <p className="mb-4 text-[14px] text-muted">{tr('بدأ مزاد أحد أسماء هذا الطلب، لذلك لا يمكن إلغاؤه. يُعاد الضمان تلقائيًا إن رست كل الأسماء على غيرك.', 'An auction for one of this request’s names has started, so it cannot be cancelled. The guarantee is returned automatically if all names are awarded to others.')}</p>
      )}

      {compound && (
        <div className={`mb-4 rounded-xl border p-4 text-[15px] ${r.status === 'accepted' ? 'border-ok/40 bg-[#E2F0E8]' : 'border-gold/50 bg-gold-soft'}`}>
          {r.status === 'accepted'
            ? <>{tr('اعتمدت اللجنة الاسم المركب وسُجّل باسمك مباشرة دون مزاد.', 'The committee approved the compound name and registered it to you directly, with no auction.')} <Link to="/dashboard/names" className="font-bold text-pine underline">{tr('شهادته في «أسمائي»', 'Its certificate is in «My names»')}</Link>.</>
            : r.status === 'under_review' ? tr('يُراجع من لجنة الاعتماد. إذا اعتُمد يُسجّل باسمك مباشرة دون مزاد ودون ضمان.', 'Under review by the Accreditation Committee. If approved, it is registered to you directly with no auction and no guarantee.')
            : r.status === 'rejected' ? tr('لم تعتمد اللجنة هذا الاسم المركب. تقدر تطلب صيغة أخرى من «أسمائي».', 'The committee did not approve this compound name. You can request another form from «My names».') : tr('أُلغي هذا الطلب.', 'This request was cancelled.')}
        </div>
      )}
      {invest && (
        <div className={`mb-4 rounded-xl border p-4 text-[15px] ${r.status === 'rejected' ? 'border-bad/30 bg-bad/5' : 'border-invest/30 bg-invest-soft'}`}>
          {r.status === 'pending_payment' ? tr(`سدّد رسوم الدراسة ${sar(r.depositAmount)} (غير مستردة) ليصل اسمك إلى اللجنة المختصة.`, `Pay the ${sar(r.depositAmount)} review fee (non-refundable) to send your name to the specialist committee.`)
            : r.status === 'under_review' ? tr('تدرس اللجنة المختصة اسمك وفق المعايير المعتمدة، وتصلك رسالة بالنتيجة.', 'The specialist committee is reviewing your name against the approved criteria. You will receive a message with the result.')
            : r.status === 'rejected' ? tr('لم يُقبل الاسم وفق معايير اللجنة، وأُبلغت برسالة نصية. رسوم الدراسة غير مستردة.', 'The name was not accepted under the committee’s criteria, and you were notified by SMS. The review fee is non-refundable.')
            : r.status === 'accepted' ? <>{tr(`قُبل اسمك ويُطرح في مزاد عام، ولك ${Math.round(RULES.investOwnerShare * 100)}% من قيمة البيع قبل الضريبة.`, `Your name was accepted and goes to public auction. You get ${Math.round(RULES.investOwnerShare * 100)}% of the sale price before VAT.`)} <Link to="/dashboard/invest" className="font-bold text-pine underline">{tr('تابع عوائدك', 'Track your returns')}</Link>.</>
            : tr('أُلغي هذا الطلب.', 'This request was cancelled.')}
        </div>
      )}
      <ol className={`panel mb-4 grid grid-cols-2 gap-3 p-4 ${compound || invest ? 'sm:grid-cols-3' : 'sm:grid-cols-4'}`}>
        {steps.map(([label, done], i) => (
          <li key={label} className="flex items-center gap-2">
            <span className={`num flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${done ? 'bg-ok text-paper' : 'border border-line text-muted'}`}>{i + 1}</span>
            <span className={done ? 'font-semibold' : 'text-muted'}>{label}</span>
          </li>
        ))}
      </ol>

      {r.status === 'pending_payment' && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-gold bg-gold-soft p-4">
          <p className="flex-1 font-semibold">{invest ? tr('سدّد رسوم الدراسة ليصل اسمك إلى اللجنة المختصة.', 'Pay the review fee to send your name to the specialist committee.') : tr('سدّد ضمان المزاد ليصل طلبك إلى لجنة الاعتماد.', 'Pay the auction guarantee to send your request to the Accreditation Committee.')}</p>
          <button className="btn-gold" onClick={() => setPaying(true)}>{tr('سداد', 'Pay')} {sar(r.depositAmount)}</button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {r.candidates.map((c) => (
          <div key={c.id} className="panel flex flex-col items-center gap-3 p-5 text-center">
            <NameSeal name={c.name} type={r.type} size="md" />
            <span className={`pill ${r.status === 'cancelled' || c.status === 'withdrawn' ? 'bg-stone-deep text-muted' : c.status === 'accepted' ? 'bg-ok/10 text-ok' : c.status === 'rejected' ? 'bg-bad/10 text-bad' : 'bg-stone-deep text-muted'}`}>
              {c.status === 'withdrawn' ? tr('سحبته', 'Withdrawn') : r.status === 'cancelled' ? tr('ملغى', 'Cancelled') : c.status === 'accepted' ? tr('مقبول', 'Accepted') : c.status === 'rejected' ? tr('مرفوض', 'Rejected') : r.status === 'pending_payment' ? tr('بانتظار السداد', 'Awaiting payment') : tr('قيد المراجعة', 'Under review')}
            </span>
            {c.rejectReason && <p className="text-sm text-bad">{L(c.rejectReason)}</p>}
            {c.withdrawable && <button className="text-[13.5px] font-bold text-bad hover:underline" onClick={() => setWithdrawing(c)}>{tr('سحب هذا الاسم', 'Withdraw this name')}</button>}
            {c.exceptedAt && <p className="rounded-md bg-gold-soft px-2 py-1 text-[13px] font-semibold text-gold-deep">{tr('سُجّل باسمك دون مزاد', 'Registered to you without auction')}</p>}
            {c.status === 'accepted' && !c.exceptedAt && r.status !== 'cancelled' && (c.auctionId
              ? <Link to={`/auctions/${c.auctionId}`} className="btn-ghost btn-sm">{tr('صفحة المزاد', 'Auction page')}</Link>
              : <p className="text-sm text-muted">{tr('بانتظار تحديد موعد المزاد', 'Awaiting an auction date')}</p>)}
          </div>
        ))}
      </div>

      <dl className="panel mt-4 grid gap-4 p-5 text-sm sm:grid-cols-2">
        <div><dt className="text-muted">{tr('تاريخ التقديم', 'Submitted')}</dt><dd className="font-semibold">{dateTime(r.submittedAt || r.createdAt)}</dd></div>
        {compound
          ? <div><dt className="text-muted">{tr('الاسم الأساسي', 'Base name')}</dt><dd className="font-semibold">{r.baseName}{tr('، بلا ضمان ولا مزاد', ', no guarantee and no auction')}</dd></div>
          : invest ? <div><dt className="text-muted">{tr('رسوم الدراسة', 'Review fee')}</dt><dd className="font-semibold">{sar(r.depositAmount)}{tr('، ', ', ')}{r.depositPaid ? tr('مدفوعة وغير مستردة', 'paid, non-refundable') : tr('لم تُسدَّد', 'not paid')}</dd></div>
          : <div><dt className="text-muted">{tr('ضمان المزاد', 'Auction guarantee')}</dt><dd className="font-semibold">{sar(r.depositAmount)}{tr('، ', ', ')}{depositStateLabels()[r.depositState]}</dd></div>}
        {r.reviewedAt && <div><dt className="text-muted">{tr('تاريخ المراجعة', 'Reviewed')}</dt><dd className="font-semibold">{dateTime(r.reviewedAt)}</dd></div>}
        {r.reviewNote && <div><dt className="text-muted">{tr('ملاحظة اللجنة', 'Committee note')}</dt><dd className="font-semibold">{r.reviewNote}</dd></div>}
      </dl>

      {cancelling && <CancelRequest r={r} onClose={() => setCancelling(false)} onDone={() => { setCancelling(false); reload() }} />}
      {withdrawing && <WithdrawName r={r} c={withdrawing} onClose={() => setWithdrawing(null)} onDone={() => { setWithdrawing(null); reload() }} />}
      {paying && (
        <PayModal open title={invest ? tr(`رسوم دراسة الطلب ${r.number}`, `Review fee for request ${r.number}`) : tr(`سداد ضمان الطلب ${r.number}`, `Pay guarantee for request ${r.number}`)} amount={r.depositAmount} onClose={() => setPaying(false)}
          onPay={async (m) => { try { await api.payDeposit(r.id, m); toast(tr('تم السداد، طلبك الآن تحت المراجعة', 'Payment received. Your request is now under review')); reload() } catch (e) { toast((e as Error).message, 'bad'); throw e } }} />
      )}
    </>
  )
}
