import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PayModal } from '../../components/PayModal'
import { TableTools, useTableFilter } from '../../components/TableTools'
import { Empty, ErrorBox, Loading, Modal, NameSeal, PageHead, RequestStatusPill, TypeBadge } from '../../components/ui'
import { RULES, TYPE_HINT, TYPE_LABEL, typeOptions, TYPE_CLS, NAME_TYPES } from '../../lib/config'
import { dateTime, sar } from '../../lib/format'
import { api, useApp, useLoad } from '../../lib/store'
import type { Candidate, LogoRequest, NameCheck, NameType } from '../../lib/types'

const DEPOSIT_STATE: Record<LogoRequest['depositState'], string> = {
  none: 'لم يُسدَّد',
  held: 'محجوز لدى المنصة',
  applied: 'خُصم من قيمة الاسم الذي رسا عليك',
  refunded: 'أُعيد إلى محفظتك',
  fee: 'رسوم دراسة غير مستردة',
}

function CandidateChip({ c, type }: { c: Candidate; type: NameType }) {
  const tone = c.status === 'accepted' ? 'text-ok' : c.status === 'rejected' ? 'text-bad line-through' : c.status === 'withdrawn' ? 'text-muted line-through' : 'text-ink'
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1 font-extrabold ${tone}`}>
      <span className={`h-2 w-2 rounded-full ${TYPE_CLS[type].dot}`} />{c.name}
    </span>
  )
}

const CANCEL_REASONS = ['لم أعد أحتاج الأسماء', 'أريد تغيير الأسماء المقترحة', 'طال وقت المراجعة', 'سبب آخر']

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
      toast(refunded ? `أُلغي الطلب ${r.number} وأُعيد ${sar(refunded)} إلى محفظتك` : `أُلغي الطلب ${r.number}`)
      onDone()
      if (refunded) nav('/dashboard/wallet')
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title={`إلغاء الطلب ${r.number}`}>
      <div className="space-y-4">
        {err && <ErrorBox text={err} />}
        <ul className="space-y-2 rounded-lg bg-stone p-4 text-[15px]">
          {held
            ? <li className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ok" /><span>يُعاد ضمان المزاد <b>{sar(r.depositAmount)}</b> إلى محفظتك فورًا، وتستخدمه في طلب جديد.</span></li>
            : r.depositState === 'fee'
              ? <li className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-bad" /><span>رسوم الدراسة <b>{sar(r.depositAmount)}</b> غير مستردة، فلن يُعاد أي مبلغ.</span></li>
              : <li className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-muted" />لم تسدّد {r.kind === 'investment' ? 'الرسوم' : 'الضمان'} بعد، فلا يوجد مبلغ للاسترداد.</li>}
          {scheduled > 0 && <li className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" /><span>{scheduled === 1 ? 'يُلغى المزاد المجدول' : `تُلغى المزادات المجدولة (${scheduled})`} لأسماء هذا الطلب قبل أن يبدأ.</span></li>}
          <li className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-bad" />تصبح الأسماء متاحة لغيرك، ولا يمكن التراجع عن الإلغاء.</li>
        </ul>
        <div>
          <label className="label" htmlFor="cr">سبب الإلغاء</label>
          <select id="cr" className="field" value={reason} onChange={(e) => setReason(e.target.value)}>{CANCEL_REASONS.map((x) => <option key={x}>{x}</option>)}</select>
          {reason === 'سبب آخر' && <input className="field mt-2" maxLength={300} placeholder="اكتب السبب (اختياري)" value={other} onChange={(e) => setOther(e.target.value)} />}
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn bg-bad text-paper hover:bg-bad/90" disabled={busy} onClick={confirm}>{busy ? 'جارٍ الإلغاء…' : held ? `إلغاء واسترداد ${sar(r.depositAmount)}` : 'تأكيد الإلغاء'}</button>
          <button className="btn-ghost" disabled={busy} onClick={onClose}>تراجع</button>
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
      toast(res.requestCancelled ? (res.refunded ? `سُحبت كل الأسماء وأُعيد ${sar(res.refunded)} إلى محفظتك` : 'سُحبت كل الأسماء وأُلغي الطلب') : `سُحب الاسم «${c.name}» من الطلب`)
      onDone()
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title={`سحب الاسم «${c.name}»`}>
      <div className="space-y-4">
        {err && <ErrorBox text={err} />}
        <div className="flex justify-center"><NameSeal name={c.name} type={r.type} size="md" /></div>
        <ul className="space-y-2 rounded-lg bg-stone p-4 text-[15px]">
          {c.auctionId && <li className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" /><span>يُلغى مزاده المجدول قبل أن يبدأ.</span></li>}
          {last
            ? <li className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ok" /><span>هذا آخر اسم في الطلب، فيُلغى الطلب كاملًا{held ? <> ويُعاد الضمان <b>{sar(r.depositAmount)}</b> إلى محفظتك.</> : '.'}</span></li>
            : <li className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-pine" /><span>يستمر الطلب بالأسماء الباقية ({others.map((x) => x.name).join('، ')})، ويبقى الضمان لها. إن سحبتها كلها يُعاد الضمان إلى محفظتك.</span></li>}
          <li className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-bad" /><span>يصبح الاسم متاحًا لغيرك، ولا يمكن التراجع.</span></li>
        </ul>
        <div className="flex flex-wrap gap-2">
          <button className="btn bg-bad text-paper hover:bg-bad/90" disabled={busy} onClick={confirm}>{busy ? 'جارٍ السحب…' : last && held ? `سحب واسترداد ${sar(r.depositAmount)}` : 'سحب الاسم'}</button>
          <button className="btn-ghost" disabled={busy} onClick={onClose}>تراجع</button>
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
      { key: 'status', label: 'الحالة', options: [['', 'الكل'], ['pending_payment', 'بانتظار السداد'], ['under_review', 'تحت المراجعة'], ['accepted', 'مقبول'], ['rejected', 'مرفوض'], ['cancelled', 'ملغى']], test: (r, v) => r.status === v },
      { key: 'type', label: 'النوع', options: typeOptions('', 'الكل'), test: (r, v) => r.type === v },
      { key: 'kind', label: 'الطلب', options: [['', 'الكل'], ['standard', 'طلب شعار'], ['compound', 'اسم مركب'], ['investment', 'استثمار الاسم']], test: (r, v) => (r.kind ?? 'standard') === v },
    ],
  })

  return (
    <>
      <PageHead title="طلبات الشعارات" sub="كل طلب يضم ثلاثة أسماء وضمان مزاد قدره 50 ريال. ولأي اسم تملكه تقدر تطلب له اسمًا مركبًا."
        action={<div className="flex flex-wrap gap-2"><Link to="/dashboard/names" className="btn-ghost">طلب اسم مركب</Link><Link to="/dashboard/requests/new" className="btn-gold">طلب شعار جديد</Link></div>} />
      {loading && !data ? <Loading /> : data?.length ? (
        <>
        <TableTools t={tf} placeholder="بحث برقم الطلب أو الاسم" />
        {!tf.list.length && <p className="panel px-5 py-10 text-center text-muted">لا توجد نتائج مطابقة. <button className="font-bold text-pine underline" onClick={tf.reset}>مسح التصفية</button></p>}
        <ul className="space-y-3">
          {tf.list.map((r) => (
            <li key={r.id} className="panel p-4">
              <div className="flex flex-wrap items-center gap-3">
                <Link to={`/dashboard/requests/${r.id}`} className="num font-semibold hover:text-gold-deep">{r.number}</Link>
                <TypeBadge type={r.type} />
                {r.kind === 'compound' && <span className="pill bg-gold-soft text-gold-deep">اسم مركب لـ«{r.baseName}»</span>}
                {r.kind === 'investment' && <span className="pill bg-invest-soft text-invest-deep">استثمار الاسم</span>}
                <RequestStatusPill status={r.status} />
                <span className="ms-auto text-sm text-muted">{dateTime(r.submittedAt || r.createdAt)}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">{r.candidates.map((c) => <CandidateChip key={c.id} c={c} type={r.type} />)}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {r.status === 'pending_payment' && <button className="btn-gold btn-sm" onClick={() => setPaying(r)}>{r.kind === 'investment' ? 'سداد الرسوم' : 'سداد الضمان'} {sar(r.depositAmount)}</button>}
                <Link to={`/dashboard/requests/${r.id}`} className="btn-ghost btn-sm">التفاصيل</Link>
                {r.cancellable && <button className="btn-danger btn-sm" onClick={() => setCancelling(r)}>{r.depositState === 'held' ? 'إلغاء كل الأسماء واسترداد الضمان' : 'إلغاء الطلب'}</button>}
                {r.candidates.some((c) => c.withdrawable) && r.candidates.filter((c) => c.status === 'pending' || c.status === 'accepted').length > 1 && <Link to={`/dashboard/requests/${r.id}`} className="btn-ghost btn-sm">سحب اسم معيّن</Link>}
              </div>
            </li>
          ))}
        </ul>
        </>
      ) : (
        <Empty title="لم تقدّم أي طلب بعد">
          <p className="text-muted">اختر ثلاثة أسماء لإبلك وقدّمها للجنة الاعتماد.</p>
          <Link to="/dashboard/requests/new" className="btn-gold">طلب شعار جديد</Link>
        </Empty>
      )}
      {cancelling && <CancelRequest r={cancelling} onClose={() => setCancelling(null)} onDone={() => { setCancelling(null); reload() }} />}
      {paying && (
        <PayModal open title={`${paying.kind === 'investment' ? 'رسوم دراسة' : 'سداد ضمان'} الطلب ${paying.number}`} amount={paying.depositAmount} onClose={() => setPaying(null)}
          onPay={async (m) => {
            try { await api.payDeposit(paying.id, m); toast('تم السداد، طلبك الآن تحت المراجعة'); reload() } catch (e) { toast((e as Error).message, 'bad'); throw e }
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

  return (
    <>
      <PageHead title="طلب شعار جديد" sub="اختر نوع الشعار ثم اكتب ثلاثة أسماء مقترحة." />
      <section className="panel p-5">
        <h2 className="text-lg">نوع الشعار</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {NAME_TYPES.map((t) => (
            <button key={t} type="button" onClick={() => setType(t)} aria-pressed={type === t}
              className={`flex items-center gap-4 rounded-xl border-2 p-4 text-start transition-colors ${type === t ? TYPE_CLS[t].card : 'border-line bg-paper hover:border-pine'}`}>
              <NameSeal name={TYPE_LABEL[t]} type={t} size="sm" />
              <span><span className="block font-extrabold text-xl">{TYPE_LABEL[t]}</span><span className="text-sm text-muted">{TYPE_HINT[t]}</span></span>
            </button>
          ))}
        </div>
      </section>

      <section className={`panel mt-4 p-5 ${type ? '' : 'pointer-events-none opacity-50'}`} aria-disabled={!type}>
        <h2 className="text-lg">الأسماء المقترحة</h2>
        <p className="mt-1 text-sm text-muted">نتحقق من كل اسم أثناء الكتابة. الاسم المطابق تمامًا لاسم مسجل لا يُقبل، والاسم الشبيه تراجعه اللجنة.</p>
        <div className="mt-4 space-y-4">
          {names.map((n, i) => {
            const c = checks[i]
            return (
              <div key={i}>
                <label className="label" htmlFor={`n${i}`}>الاسم {['الأول', 'الثاني', 'الثالث'][i]}</label>
                <input id={`n${i}`} className={`field font-extrabold text-lg ${c && VERDICT_STYLE[c.verdict] === 'text-bad' ? 'border-bad' : ''}`} value={n} maxLength={30}
                  onChange={(e) => setNames(names.map((x, j) => (j === i ? e.target.value : x)))} />
                {c && (
                  <p className={`mt-1 text-sm font-semibold ${VERDICT_STYLE[c.verdict]}`}>
                    {c.message}
                    {c.verdict === 'similar' && <span className="font-normal text-muted"> ({c.hits.slice(0, 3).map((h) => h.name).join('، ')})</span>}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </section>

      <section className="panel mt-4 flex flex-wrap items-center gap-4 p-5">
        <div className="flex-1">
          <p className="font-semibold">ضمان المزاد {sar(RULES.depositAmount)}</p>
          <p className="text-sm text-muted">يُعاد إلى محفظتك إن رُفض الطلب أو أُلغي، ويُحتسب من قيمة الاسم إن رسا عليك.</p>
        </div>
        <button className="btn-gold px-6" disabled={!type || !complete || blocked || busy} onClick={submit}>رفع الطلب وسداد الضمان</button>
      </section>

      {created && (
        <PayModal open title={`سداد ضمان الطلب ${created.number}`} amount={created.depositAmount}
          onClose={() => { if (!paid.current) nav('/dashboard/requests') }}
          onPay={async (m) => {
            try { await api.payDeposit(created.id, m); paid.current = true; toast('تم رفع طلبك، وهو الآن تحت المراجعة'); nav(`/dashboard/requests/${created.id}`) } catch (e) { toast((e as Error).message, 'bad'); throw e }
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
  if (error || !r) return <ErrorBox text={error || 'الطلب غير موجود'} />

  const compound = r.kind === 'compound'
  const invest = r.kind === 'investment'
  const auctionOf = r.candidates.find((c) => c.auctionId)
  const steps: [string, boolean][] = invest ? [
    ['سداد رسوم الدراسة', r.depositPaid],
    ['دراسة اللجنة', !!r.reviewedAt],
    ['المزاد العام', !!auctionOf],
  ] : compound ? [
    ['تقديم الطلب', true],
    ['مراجعة اللجنة', !!r.reviewedAt],
    ['التسجيل باسمك', r.status === 'accepted'],
  ] : [
    ['تقديم الطلب', true],
    ['سداد الضمان', r.depositPaid],
    ['مراجعة اللجنة', !!r.reviewedAt],
    ['فتح المزاد', r.candidates.some((c) => c.auctionId)],
  ]

  return (
    <>
      <PageHead title={compound ? `طلب اسم مركب ${r.number}` : invest ? `استثمار الاسم ${r.number}` : `الطلب ${r.number}`} sub={<span className="flex flex-wrap items-center gap-2"><TypeBadge type={r.type} />{compound && <span className="pill bg-gold-soft text-gold-deep">مركب من «{r.baseName}»</span>}{invest && <span className="pill bg-invest-soft text-invest-deep">استثمار الاسم</span>}<RequestStatusPill status={r.status} /></span>}
        action={r.cancellable ? (
          <button className="btn-danger btn-sm" onClick={() => setCancelling(true)}>{r.depositState === 'held' ? 'إلغاء كل الأسماء واسترداد الضمان' : 'إلغاء الطلب'}</button>
        ) : undefined} />

      {r.status === 'cancelled' && (
        <div className="mb-4 rounded-xl border border-line bg-stone p-4 text-[15px]">
          <b>أُلغي هذا الطلب{r.cancelledBy === 'owner' ? ' بطلبك' : ''}{r.cancelledAt ? ` في ${dateTime(r.cancelledAt)}` : ''}.</b>
          {r.cancelReason && <span className="text-muted"> السبب: {r.cancelReason}.</span>}
          {r.depositState === 'refunded' && <> أُعيد الضمان {sar(r.depositAmount)} إلى <Link to="/dashboard/wallet" className="font-bold text-pine underline">محفظتك</Link>.</>}
        </div>
      )}
      {r.status === 'accepted' && !r.cancellable && !invest && (
        <p className="mb-4 text-[14px] text-muted">بدأ مزاد أحد أسماء هذا الطلب، لذلك لا يمكن إلغاؤه. يُعاد الضمان تلقائيًا إن رست كل الأسماء على غيرك.</p>
      )}

      {compound && (
        <div className={`mb-4 rounded-xl border p-4 text-[15px] ${r.status === 'accepted' ? 'border-ok/40 bg-[#E2F0E8]' : 'border-gold/50 bg-gold-soft'}`}>
          {r.status === 'accepted'
            ? <>اعتمدت اللجنة الاسم المركب وسُجّل باسمك مباشرة دون مزاد. <Link to="/dashboard/names" className="font-bold text-pine underline">شهادته في «أسمائي»</Link>.</>
            : r.status === 'under_review' ? 'يُراجع من لجنة الاعتماد. إذا اعتُمد يُسجّل باسمك مباشرة دون مزاد ودون ضمان.'
            : r.status === 'rejected' ? 'لم تعتمد اللجنة هذا الاسم المركب. تقدر تطلب صيغة أخرى من «أسمائي».' : 'أُلغي هذا الطلب.'}
        </div>
      )}
      {invest && (
        <div className={`mb-4 rounded-xl border p-4 text-[15px] ${r.status === 'rejected' ? 'border-bad/30 bg-bad/5' : 'border-invest/30 bg-invest-soft'}`}>
          {r.status === 'pending_payment' ? `سدّد رسوم الدراسة ${sar(r.depositAmount)} (غير مستردة) ليصل اسمك إلى اللجنة المختصة.`
            : r.status === 'under_review' ? 'تدرس اللجنة المختصة اسمك وفق المعايير المعتمدة، وتصلك رسالة بالنتيجة.'
            : r.status === 'rejected' ? 'لم يُقبل الاسم وفق معايير اللجنة، وأُبلغت برسالة نصية. رسوم الدراسة غير مستردة.'
            : r.status === 'accepted' ? <>قُبل اسمك ويُطرح في مزاد عام، ولك {Math.round(RULES.investOwnerShare * 100)}% من قيمة البيع قبل الضريبة. <Link to="/dashboard/invest" className="font-bold text-pine underline">تابع عوائدك</Link>.</>
            : 'أُلغي هذا الطلب.'}
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
          <p className="flex-1 font-semibold">{invest ? 'سدّد رسوم الدراسة ليصل اسمك إلى اللجنة المختصة.' : 'سدّد ضمان المزاد ليصل طلبك إلى لجنة الاعتماد.'}</p>
          <button className="btn-gold" onClick={() => setPaying(true)}>سداد {sar(r.depositAmount)}</button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {r.candidates.map((c) => (
          <div key={c.id} className="panel flex flex-col items-center gap-3 p-5 text-center">
            <NameSeal name={c.name} type={r.type} size="md" />
            <span className={`pill ${r.status === 'cancelled' || c.status === 'withdrawn' ? 'bg-stone-deep text-muted' : c.status === 'accepted' ? 'bg-ok/10 text-ok' : c.status === 'rejected' ? 'bg-bad/10 text-bad' : 'bg-stone-deep text-muted'}`}>
              {c.status === 'withdrawn' ? 'سحبته' : r.status === 'cancelled' ? 'ملغى' : c.status === 'accepted' ? 'مقبول' : c.status === 'rejected' ? 'مرفوض' : r.status === 'pending_payment' ? 'بانتظار السداد' : 'قيد المراجعة'}
            </span>
            {c.rejectReason && <p className="text-sm text-bad">{c.rejectReason}</p>}
            {c.withdrawable && <button className="text-[13.5px] font-bold text-bad hover:underline" onClick={() => setWithdrawing(c)}>سحب هذا الاسم</button>}
            {c.status === 'accepted' && r.status !== 'cancelled' && (c.auctionId
              ? <Link to={`/auctions/${c.auctionId}`} className="btn-ghost btn-sm">صفحة المزاد</Link>
              : <p className="text-sm text-muted">بانتظار تحديد موعد المزاد</p>)}
          </div>
        ))}
      </div>

      <dl className="panel mt-4 grid gap-4 p-5 text-sm sm:grid-cols-2">
        <div><dt className="text-muted">تاريخ التقديم</dt><dd className="font-semibold">{dateTime(r.submittedAt || r.createdAt)}</dd></div>
        {compound
          ? <div><dt className="text-muted">الاسم الأساسي</dt><dd className="font-semibold">{r.baseName}، بلا ضمان ولا مزاد</dd></div>
          : invest ? <div><dt className="text-muted">رسوم الدراسة</dt><dd className="font-semibold">{sar(r.depositAmount)}، {r.depositPaid ? 'مدفوعة وغير مستردة' : 'لم تُسدَّد'}</dd></div>
          : <div><dt className="text-muted">ضمان المزاد</dt><dd className="font-semibold">{sar(r.depositAmount)}، {DEPOSIT_STATE[r.depositState]}</dd></div>}
        {r.reviewedAt && <div><dt className="text-muted">تاريخ المراجعة</dt><dd className="font-semibold">{dateTime(r.reviewedAt)}</dd></div>}
        {r.reviewNote && <div><dt className="text-muted">ملاحظة اللجنة</dt><dd className="font-semibold">{r.reviewNote}</dd></div>}
      </dl>

      {cancelling && <CancelRequest r={r} onClose={() => setCancelling(false)} onDone={() => { setCancelling(false); reload() }} />}
      {withdrawing && <WithdrawName r={r} c={withdrawing} onClose={() => setWithdrawing(null)} onDone={() => { setWithdrawing(null); reload() }} />}
      {paying && (
        <PayModal open title={`${invest ? 'رسوم دراسة' : 'سداد ضمان'} الطلب ${r.number}`} amount={r.depositAmount} onClose={() => setPaying(false)}
          onPay={async (m) => { try { await api.payDeposit(r.id, m); toast('تم السداد، طلبك الآن تحت المراجعة'); reload() } catch (e) { toast((e as Error).message, 'bad'); throw e } }} />
      )}
    </>
  )
}
