import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PayModal } from '../../components/PayModal'
import { Empty, ErrorBox, Loading, NameSeal, PageHead, RequestStatusPill, TypeBadge } from '../../components/ui'
import { RULES, TYPE_HINT, TYPE_LABEL } from '../../lib/config'
import { dateTime, sar } from '../../lib/format'
import { api, useApp, useLoad } from '../../lib/store'
import type { Candidate, LogoRequest, NameCheck, NameType } from '../../lib/types'

const DEPOSIT_STATE: Record<LogoRequest['depositState'], string> = {
  none: 'لم يُسدَّد',
  held: 'محجوز لدى المنصة',
  applied: 'خُصم من قيمة الاسم الذي رسا عليك',
  refunded: 'أُعيد إلى محفظتك',
}

function CandidateChip({ c, type }: { c: Candidate; type: NameType }) {
  const tone = c.status === 'accepted' ? 'text-ok' : c.status === 'rejected' ? 'text-bad line-through' : 'text-ink'
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1 font-kufi ${tone}`}>
      <span className={`h-2 w-2 rounded-full ${type === 'qaadan' ? 'bg-qaadan' : 'bg-bakkar'}`} />{c.name}
    </span>
  )
}

export function MyRequests() {
  const { toast } = useApp()
  const { data, loading, reload } = useLoad(() => api.myRequests(), [])
  const [paying, setPaying] = useState<LogoRequest | null>(null)

  return (
    <>
      <PageHead title="طلبات الشعارات" sub="كل طلب يضم ثلاثة أسماء وضمان مزاد قدره 50 ريال." action={<Link to="/dashboard/requests/new" className="btn-gold">طلب شعار جديد</Link>} />
      {loading && !data ? <Loading /> : data?.length ? (
        <ul className="space-y-3">
          {data.map((r) => (
            <li key={r.id} className="panel p-4">
              <div className="flex flex-wrap items-center gap-3">
                <Link to={`/dashboard/requests/${r.id}`} className="num font-semibold hover:text-gold-deep">{r.number}</Link>
                <TypeBadge type={r.type} />
                <RequestStatusPill status={r.status} />
                <span className="ms-auto text-sm text-muted">{dateTime(r.submittedAt || r.createdAt)}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">{r.candidates.map((c) => <CandidateChip key={c.id} c={c} type={r.type} />)}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {r.status === 'pending_payment' && <button className="btn-gold btn-sm" onClick={() => setPaying(r)}>سداد الضمان {sar(r.depositAmount)}</button>}
                <Link to={`/dashboard/requests/${r.id}`} className="btn-ghost btn-sm">التفاصيل</Link>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <Empty title="لم تقدّم أي طلب بعد">
          <p className="text-muted">اختر ثلاثة أسماء لإبلك وقدّمها للجنة الاعتماد.</p>
          <Link to="/dashboard/requests/new" className="btn-gold">طلب شعار جديد</Link>
        </Empty>
      )}
      {paying && (
        <PayModal open title={`سداد ضمان الطلب ${paying.number}`} amount={paying.depositAmount} onClose={() => setPaying(null)}
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
          {(['qaadan', 'bakkar'] as NameType[]).map((t) => (
            <button key={t} type="button" onClick={() => setType(t)} aria-pressed={type === t}
              className={`flex items-center gap-4 rounded-xl border-2 p-4 text-start transition-colors ${type === t ? (t === 'qaadan' ? 'border-qaadan bg-qaadan-soft' : 'border-bakkar bg-bakkar-soft') : 'border-line bg-paper hover:border-ink'}`}>
              <NameSeal name={TYPE_LABEL[t]} type={t} size="sm" />
              <span><span className="block font-kufi text-xl">{TYPE_LABEL[t]}</span><span className="text-sm text-muted">{TYPE_HINT[t]}</span></span>
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
                <input id={`n${i}`} className={`field font-kufi text-lg ${c && VERDICT_STYLE[c.verdict] === 'text-bad' ? 'border-bad' : ''}`} value={n} maxLength={30}
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
  if (loading && !r) return <Loading />
  if (error || !r) return <ErrorBox text={error || 'الطلب غير موجود'} />

  const steps: [string, boolean][] = [
    ['تقديم الطلب', true],
    ['سداد الضمان', r.depositPaid],
    ['مراجعة اللجنة', !!r.reviewedAt],
    ['فتح المزاد', r.candidates.some((c) => c.auctionId)],
  ]

  return (
    <>
      <PageHead title={`الطلب ${r.number}`} sub={<span className="flex flex-wrap items-center gap-2"><TypeBadge type={r.type} /><RequestStatusPill status={r.status} /></span>}
        action={r.status === 'pending_payment' || r.status === 'under_review' ? (
          <button className="btn-danger btn-sm" onClick={async () => {
            if (!confirm('إلغاء الطلب؟ سيُعاد الضمان إلى محفظتك إن كان مسددًا.')) return
            try { await api.cancelMyRequest(r.id); toast('أُلغي الطلب'); reload() } catch (e) { toast((e as Error).message, 'bad') }
          }}>إلغاء الطلب</button>
        ) : undefined} />

      <ol className="panel mb-4 grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
        {steps.map(([label, done], i) => (
          <li key={label} className="flex items-center gap-2">
            <span className={`num flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${done ? 'bg-ok text-paper' : 'border border-line text-muted'}`}>{i + 1}</span>
            <span className={done ? 'font-semibold' : 'text-muted'}>{label}</span>
          </li>
        ))}
      </ol>

      {r.status === 'pending_payment' && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-gold bg-gold-soft p-4">
          <p className="flex-1 font-semibold">سدّد ضمان المزاد ليصل طلبك إلى لجنة الاعتماد.</p>
          <button className="btn-gold" onClick={() => setPaying(true)}>سداد {sar(r.depositAmount)}</button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {r.candidates.map((c) => (
          <div key={c.id} className="panel flex flex-col items-center gap-3 p-5 text-center">
            <NameSeal name={c.name} type={r.type} size="md" />
            <span className={`pill ${c.status === 'accepted' ? 'bg-ok/10 text-ok' : c.status === 'rejected' ? 'bg-bad/10 text-bad' : 'bg-stone-deep text-muted'}`}>
              {c.status === 'accepted' ? 'مقبول' : c.status === 'rejected' ? 'مرفوض' : 'قيد المراجعة'}
            </span>
            {c.rejectReason && <p className="text-sm text-bad">{c.rejectReason}</p>}
            {c.status === 'accepted' && (c.auctionId
              ? <Link to={`/auctions/${c.auctionId}`} className="btn-ghost btn-sm">صفحة المزاد</Link>
              : <p className="text-sm text-muted">بانتظار تحديد موعد المزاد</p>)}
          </div>
        ))}
      </div>

      <dl className="panel mt-4 grid gap-4 p-5 text-sm sm:grid-cols-2">
        <div><dt className="text-muted">تاريخ التقديم</dt><dd className="font-semibold">{dateTime(r.submittedAt || r.createdAt)}</dd></div>
        <div><dt className="text-muted">ضمان المزاد</dt><dd className="font-semibold">{sar(r.depositAmount)}، {DEPOSIT_STATE[r.depositState]}</dd></div>
        {r.reviewedAt && <div><dt className="text-muted">تاريخ المراجعة</dt><dd className="font-semibold">{dateTime(r.reviewedAt)}</dd></div>}
        {r.reviewNote && <div><dt className="text-muted">ملاحظة اللجنة</dt><dd className="font-semibold">{r.reviewNote}</dd></div>}
      </dl>

      {paying && (
        <PayModal open title={`سداد ضمان الطلب ${r.number}`} amount={r.depositAmount} onClose={() => setPaying(false)}
          onPay={async (m) => { try { await api.payDeposit(r.id, m); toast('تم السداد، طلبك الآن تحت المراجعة'); reload() } catch (e) { toast((e as Error).message, 'bad'); throw e } }} />
      )}
    </>
  )
}
