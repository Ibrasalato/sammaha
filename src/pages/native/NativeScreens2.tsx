import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon } from '../../components/dash'
import { InvoiceStatus } from '../../components/InvoiceStatus'
import { PayModal } from '../../components/PayModal'
import { ClosedPage, useClosed } from '../../components/SettingsUi'
import { Empty, Loading } from '../../components/ui'
import { NAME_TYPES, RULES, TYPE_CLS, TYPE_HINT, TYPE_LABEL } from '../../lib/config'
import { date, num, sar } from '../../lib/format'
import { tr } from '../../lib/i18n'
import { localizeServerText as L } from '../../lib/serverText'
import { api, useApp, useLoad } from '../../lib/store'
import type { LogoRequest, NameCheck, NameType } from '../../lib/types'
import { VERDICT_STYLE } from '../owner/Requests'

/** «طلب شعار جديد» as three steps: type, names, review & guarantee. Same checks and same payment as the website form. */
export function NativeNewRequest() {
  const { toast } = useApp()
  const nav = useNavigate()
  const [step, setStep] = useState(1)
  const [type, setType] = useState<NameType | null>(null)
  const [names, setNames] = useState<string[]>(Array(RULES.namesPerRequest).fill(''))
  const [checks, setChecks] = useState<(NameCheck | null)[]>([])
  const [created, setCreated] = useState<LogoRequest | null>(null)
  const [busy, setBusy] = useState(false)
  const paid = useRef(false)
  const closed = useClosed('requests')

  useEffect(() => {
    if (!type || names.every((n) => !n.trim())) { setChecks([]); return }
    const t = setTimeout(() => { api.checkNames(names, type).then((res) => setChecks(res.map((c, i) => (names[i].trim() ? c : null)))) }, 350)
    return () => clearTimeout(t)
  }, [names, type])

  const blocked = checks.some((c) => c && ['exact', 'invalid', 'duplicate'].includes(c.verdict))
  const complete = names.every((n) => n.trim()) && checks.length === names.length && checks.every(Boolean)
  async function submit() {
    if (!type) return
    setBusy(true)
    try { setCreated(await api.createRequest(type, names)) } catch (e) { toast((e as Error).message, 'bad') } finally { setBusy(false) }
  }
  if (closed && !created) return <ClosedPage intake="requests" title={tr('طلب شعار جديد', 'New name request')} back="/dashboard/services" />

  const labels = [tr('النوع', 'Type'), tr('الأسماء', 'Names'), tr('التأكيد', 'Confirm')]
  return (
    <div>
      <ol className="mb-4 flex items-center justify-between px-2" aria-label={tr('خطوات الطلب', 'Request steps')}>
        {labels.map((l, i) => (
          <li key={l} className="flex flex-1 flex-col items-center gap-1 text-[12.5px] font-bold" aria-current={step === i + 1 ? 'step' : undefined}>
            <span className={`grid h-8 w-8 place-items-center rounded-full border-2 ${step > i + 1 ? 'border-ok bg-ok text-paper' : step === i + 1 ? 'border-pine bg-pine text-paper' : 'border-line bg-paper text-muted'}`}>{step > i + 1 ? '✓' : i + 1}</span>
            <span className={step === i + 1 ? 'text-pine' : 'text-muted'}>{l}</span>
          </li>
        ))}
      </ol>

      {step === 1 && (
        <section className="space-y-2.5">
          <h1>{tr('نوع الشعار', 'Name type')}</h1>
          <p className="text-[14px] text-muted">{tr('اختر نوع الاسم الذي تريد تسجيله.', 'Choose the kind of name you want to register.')}</p>
          {NAME_TYPES.map((t) => (
            <button key={t} type="button" onClick={() => setType(t)} aria-pressed={type === t}
              className={`flex w-full items-center gap-3 rounded-2xl border-2 p-4 text-start ${type === t ? TYPE_CLS[t].card : 'border-line bg-paper'}`}>
              <span className={`h-3 w-3 rounded-full ${TYPE_CLS[t].dot}`} />
              <span className="flex-1"><b className="block text-[19px]">{TYPE_LABEL[t]}</b><span className="text-[13px] text-muted">{TYPE_HINT[t]}</span></span>
              {type === t && <Icon name="check" className="h-5 w-5 text-pine" />}
            </button>
          ))}
        </section>
      )}

      {step === 2 && type && (
        <section className="space-y-3">
          <h1>{tr('الأسماء المقترحة', 'Proposed names')}</h1>
          <p className="text-[13.5px] leading-6 text-muted">{tr('اكتب ثلاثة أسماء بالترتيب الذي تفضّله. نتحقق من كل اسم أثناء الكتابة.', 'Write three names in order of preference. Each is checked as you type.')}</p>
          {names.map((n, i) => {
            const c = checks[i]
            return (
              <div key={i}>
                <label className="label" htmlFor={`n${i}`}>{tr(`الاسم ${['الأول', 'الثاني', 'الثالث'][i]}`, `${['First', 'Second', 'Third'][i]} name`)}</label>
                <input id={`n${i}`} className={`field text-[19px] font-extrabold ${c && VERDICT_STYLE[c.verdict] === 'text-bad' ? 'border-bad' : ''}`} value={n} maxLength={30} onChange={(e) => setNames(names.map((x, j) => (j === i ? e.target.value : x)))} />
                {c && <p className={`mt-1 text-[13.5px] font-semibold ${VERDICT_STYLE[c.verdict]}`}>{L(c.message ?? '')}{c.verdict === 'similar' && c.hits.some((h) => h.name) && <span className="font-normal text-muted"> ({c.hits.filter((h) => h.name).slice(0, 3).map((h) => h.name).join(tr('، ', ', '))})</span>}</p>}
              </div>
            )
          })}
        </section>
      )}

      {step === 3 && type && (
        <section className="space-y-3">
          <h1>{tr('مراجعة الطلب', 'Review your request')}</h1>
          <div className="app-card">
            <div className="flex items-center justify-between"><span className="text-muted">{tr('نوع الشعار', 'Type')}</span><b>{TYPE_LABEL[type]}</b></div>
            <ul className="mt-3 divide-y divide-line/70">{names.map((n, i) => <li key={i} className="flex items-center justify-between py-2.5"><span className="text-[13px] text-muted">{i + 1}</span><b className="text-[19px]">{n}</b></li>)}</ul>
          </div>
          <div className="rounded-2xl border border-gold/50 bg-gold-soft p-4 text-[14px] leading-7">
            <b className="block text-[16px]">{tr('ضمان المزاد', 'Auction guarantee')} {sar(RULES.depositAmount)}</b>
            {tr('يُعاد إلى محفظتك إن رُفض الطلب أو أُلغي أو رسا الاسم على غيرك. وإن رسا عليك تسدّد قيمته خلال المهلة ثم يُعاد ضمانك.', 'Returned to your wallet if the request is declined or cancelled, or the name goes to someone else. If you win, you pay its price within the deadline and the guarantee is returned.')}
          </div>
        </section>
      )}

      <div className="mt-5 flex gap-2.5">
        {step > 1 && <button className="btn-ghost flex-1" onClick={() => setStep(step - 1)}>{tr('السابق', 'Back')}</button>}
        {step < 3
          ? <button className="btn-primary flex-[2]" disabled={step === 1 ? !type : !complete || blocked} onClick={() => setStep(step + 1)}>{tr('التالي', 'Next')}</button>
          : <button className="btn-gold flex-[2]" disabled={busy} onClick={submit}>{busy ? tr('جارٍ الإرسال…', 'Sending…') : tr('رفع الطلب وسداد الضمان', 'Submit and pay guarantee')}</button>}
      </div>

      {created && (
        <PayModal open title={tr(`سداد ضمان الطلب ${created.number}`, `Pay guarantee for request ${created.number}`)} amount={created.depositAmount}
          onClose={() => { if (!paid.current) nav('/dashboard/requests') }}
          onPay={async (m) => {
            try { await api.payDeposit(created.id, m); paid.current = true; toast(tr('تم رفع طلبك، وهو الآن تحت المراجعة', 'Your request was submitted and is now under review')); nav('/dashboard/requests') } catch (e) { toast((e as Error).message, 'bad'); throw e }
          }} />
      )}
    </div>
  )
}

/** Invoices as cards: what is due first, tap for the invoice (and to pay it). */
export function NativeInvoices() {
  const { data, loading } = useLoad(() => api.myInvoices(), [])
  const [f, setF] = useState<'all' | 'unpaid' | 'paid'>('all')
  const list = (data ?? []).filter((i) => f === 'all' || i.status === f)
  const due = (data ?? []).filter((i) => i.status === 'unpaid')
  return (
    <div className="space-y-3">
      <h1>{tr('الفواتير', 'Invoices')}</h1>
      {!!due.length && (
        <div className="rounded-2xl border border-gold/50 bg-gold-soft p-4">
          <span className="text-[13px] text-gold-deep">{tr('المستحق للسداد', 'Due for payment')}</span>
          <b className="num block text-[26px]">{sar(due.reduce((s, i) => s + i.amountDue, 0))}</b>
        </div>
      )}
      <div className="app-seg">
        {([['all', tr('الكل', 'All')], ['unpaid', tr('غير مدفوعة', 'Unpaid')], ['paid', tr('مدفوعة', 'Paid')]] as ['all' | 'unpaid' | 'paid', string][]).map(([v, l]) => <button key={v} className={f === v ? 'on' : ''} onClick={() => setF(v)}>{l}</button>)}
      </div>
      {loading && !data ? <Loading /> : list.length ? (
        <ul className="space-y-2.5">
          {list.map((i) => (
            <li key={i.id}>
              <Link to={`/dashboard/invoices/${i.id}`} className="app-card block">
                <div className="flex items-start justify-between gap-2"><b className="text-[20px]">{i.name}</b><InvoiceStatus i={i} /></div>
                <div className="num mt-0.5 text-[12.5px] text-muted" dir="ltr" style={{ textAlign: 'start' }}>{i.number}</div>
                <dl className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-stone px-3 py-2 text-center">
                  <div><dt className="text-[11.5px] text-muted">{tr('التاريخ', 'Date')}</dt><dd className="text-[13px] font-bold">{date(i.issuedAt)}</dd></div>
                  <div><dt className="text-[11.5px] text-muted">{tr('الإجمالي', 'Total')}</dt><dd className="num text-[14px] font-bold">{sar(i.total)}</dd></div>
                  <div><dt className="text-[11.5px] text-muted">{tr('المستحق', 'Due')}</dt><dd className="num text-[14px] font-extrabold">{sar(i.amountDue)}</dd></div>
                </dl>
                {i.status === 'unpaid' && <span className="btn-gold mt-3 w-full">{tr('سداد الفاتورة', 'Pay invoice')} <span className="num">{num(i.amountDue)}</span></span>}
              </Link>
            </li>
          ))}
        </ul>
      ) : <Empty title={tr('لا توجد فواتير بعد', 'No invoices yet')} />}
    </div>
  )
}
