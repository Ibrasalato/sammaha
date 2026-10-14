import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../../components/dash'
import { PayModal } from '../../components/PayModal'
import { TableTools, useTableFilter } from '../../components/TableTools'
import { Empty, Loading, NameSeal, PageHead, TypeBadge, TypePicker } from '../../components/ui'
import { RULES, typeOptions } from '../../lib/config'
import { dateTime, sar } from '../../lib/format'
import { api, useApp, useLoad } from '../../lib/store'
import { ClosedNotice, useClosed } from '../../components/SettingsUi'
import type { InvestmentItem, LogoRequest, NameCheck, NameType } from '../../lib/types'
import { tr } from '../../lib/i18n'
import { localizeServerText as L } from '../../lib/serverText'

const pct = Math.round(RULES.investOwnerShare * 100)

/** Where an investment name stands, in one line the owner can act on. */
function stage(it: InvestmentItem): { label: string; tone: string } {
  const { request: r, candidate: c, auction: a } = it
  if (r.status === 'pending_payment') return { label: tr('بانتظار سداد رسوم الدراسة', 'Awaiting review fee payment'), tone: 'bg-gold-soft text-gold-deep' }
  if (c.status === 'withdrawn') return { label: tr('سحبته', 'Withdrawn'), tone: 'bg-stone-deep text-muted' }
  if (r.status === 'cancelled') return { label: tr('ملغى', 'Cancelled'), tone: 'bg-stone-deep text-muted' }
  if (r.status === 'under_review') return { label: tr('تدرسه اللجنة', 'Under committee review'), tone: 'bg-stone-deep text-ink' }
  if (c.status === 'rejected') return { label: tr('لم يُقبل', 'Not accepted'), tone: 'bg-bad/10 text-bad' }
  if (!a) return { label: tr('مقبول، بانتظار موعد المزاد', 'Accepted, awaiting auction date'), tone: 'bg-pine-soft text-pine' }
  if (!a.settled) return Date.parse(a.startsAt) > Date.now() ? { label: tr('مزاده مجدول', 'Auction scheduled'), tone: 'bg-pine-soft text-pine' } : { label: tr('في المزاد الآن', 'In auction now'), tone: 'bg-gold text-pine' }
  if (it.keptByOwner) return { label: tr('انتهى دون مزايدات، آل إليك', 'Ended with no bids; it is yours'), tone: 'bg-stone-deep text-ink' }
  return it.sharePaid ? { label: tr('بيع، وأُضيف نصيبك', 'Sold; your share was added'), tone: 'bg-[#E2F0E8] text-ok' } : { label: tr('بيع، بانتظار سداد الفائز', 'Sold; awaiting winner payment'), tone: 'bg-gold-soft text-gold-deep' }
}

const ordinal = () => [tr('الأول', 'First'), tr('الثاني', 'Second'), tr('الثالث', 'Third')]
const BLOCK = ['exact', 'invalid', 'duplicate']

export function InvestPage() {
  const { toast } = useApp()
  const { data, loading, reload } = useLoad(() => api.myInvestments(), [])
  const [type, setType] = useState<NameType | null>(null)
  const [names, setNames] = useState<string[]>(Array(RULES.investMaxNames).fill(''))
  const [checks, setChecks] = useState<(NameCheck | null)[]>([])
  const [busy, setBusy] = useState(false)
  const [paying, setPaying] = useState<LogoRequest | null>(null)
  const [agree, setAgree] = useState(false)

  useEffect(() => {
    if (!type || names.every((n) => !n.trim())) { setChecks([]); return }
    const t = setTimeout(() => {
      // check the filled names together, so a name repeated in the same request is caught too
      const idx = names.map((n, i) => (n.trim() ? i : -1)).filter((i) => i >= 0)
      api.checkNames(idx.map((i) => names[i]), type).then((res) => {
        const out: (NameCheck | null)[] = names.map(() => null)
        idx.forEach((i, k) => { out[i] = res[k] ?? null })
        setChecks(out)
      })
    }, 350)
    return () => clearTimeout(t)
  }, [names, type])

  const filled = names.filter((n) => n.trim())
  const blocked = checks.some((c) => c && BLOCK.includes(c.verdict))
  const checked = names.every((n, i) => !n.trim() || checks[i])
  const closed = useClosed('investment')
  const ready = !!type && filled.length > 0 && checked && !blocked && agree && !closed

  async function submit() {
    if (!type) return
    setBusy(true)
    try { setPaying(await api.createInvestmentRequest(type, filled)) } catch (e) { toast((e as Error).message, 'bad') } finally { setBusy(false) }
  }

  const items = data ?? []
  const earned = items.filter((x) => x.sharePaid).reduce((s, x) => s + (x.share ?? 0), 0)
  const pending = items.filter((x) => x.share && !x.sharePaid).reduce((s, x) => s + (x.share ?? 0), 0)
  const tf = useTableFilter(data, {
    fields: (x) => [x.request.number, x.candidate.name],
    filters: [{ key: 'type', label: tr('النوع', 'Type'), options: typeOptions('', tr('الكل', 'All')), test: (x, v) => x.request.type === v }],
  })

  return (
    <>
      <PageHead title={tr('استثمار الاسم', 'Name investment')} sub={<>{tr(`اقترح حتى ${RULES.investMaxNames} أسماء جديدة. ما تعتمده اللجنة يُطرح في مزاد عام ولك ${pct}% من قيمة بيعه.`, `Propose up to ${RULES.investMaxNames} new names. Those the committee approves go to public auction, and you get ${pct}% of the sale price.`)} <Link to="/invest" className="font-bold text-pine underline">{tr('تفاصيل الخدمة', 'Service details')}</Link></>} />

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="panel p-5">
          <h2 className="flex items-center gap-2 text-lg"><span className="grid h-9 w-9 place-items-center rounded-lg bg-gold-soft text-gold-deep"><Icon name="coins" /></span>{tr('تقديم أسماء جديدة', 'Submit new names')}</h2>
          <ClosedNotice intake="investment" className="mt-3" />
          <p className="mt-2 text-sm text-muted">{tr(`من اسم إلى ${RULES.investMaxNames} أسماء في الطلب، جديدة وغير مكررة، ورسوم الدراسة ${sar(RULES.investFee)} للطلب كاملًا.`, `One to ${RULES.investMaxNames} new, unique names per request. The review fee is ${sar(RULES.investFee)} for the whole request.`)}</p>
          <div className="mt-4"><TypePicker value={type} onChange={setType} compact /></div>
          <div className={`mt-4 space-y-3 ${type ? '' : 'pointer-events-none opacity-50'}`}>
            {names.map((n, i) => {
              const c = checks[i], bad = !!c && BLOCK.includes(c.verdict)
              return (
                <div key={i}>
                  <label className="label" htmlFor={`inv-name-${i}`}>{tr(`الاسم ${ordinal()[i]}`, `${ordinal()[i]} name`)} {i > 0 && <span className="font-normal text-muted">{tr('(اختياري)', '(optional)')}</span>}</label>
                  <input id={`inv-name-${i}`} className={`field font-extrabold text-lg ${bad ? 'border-bad' : ''}`} value={n} maxLength={30}
                    onChange={(e) => setNames(names.map((x, k) => (k === i ? e.target.value : x)))} />
                  {c && (
                    <p className={`mt-1 text-sm font-semibold ${bad ? 'text-bad' : c.verdict === 'similar' ? 'text-warn' : 'text-ok'}`}>
                      {c.verdict === 'exact' ? tr('هذا الاسم مسجل أو مطلوب مسبقًا، اختر اسمًا جديدًا غير مكرر', 'This name is already registered or requested. Choose a new, unique name') : L(c.message ?? '')}
                      {c.verdict === 'similar' && <span className="font-normal text-muted"> {tr('(تراجعه اللجنة، وقد يُرفض لتشابهه)', '(the committee will review it; it may be rejected as too similar)')}</span>}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
          <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-lg bg-stone p-3 text-[14.5px]">
            <input type="checkbox" className="mt-1" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>{tr('أوافق على أن رسوم الدراسة', 'I agree that the review fee of')} <b>{sar(RULES.investFee)}</b> {tr(`غير مستردة سواء قُبلت الأسماء أو لم تُقبل، وأن عائد كل اسم يُباع يوزّع ${100 - pct}% للمنظمة و${pct}% لي، وإن لم يزايد أحد على اسم يؤول إليّ دون النسبة.`, `is non-refundable whether or not the names are accepted, that the proceeds of each name sold are split ${100 - pct}% to the organization and ${pct}% to me, and that if nobody bids on a name it passes to me without the share.`)}</span>
          </label>
          <button className="btn-gold mt-4 w-full sm:w-auto sm:px-6" disabled={!ready || busy} onClick={submit}>{busy ? tr('جارٍ الرفع…', 'Submitting…') : tr(`تقديم ${filled.length > 1 ? `${filled.length} أسماء` : 'الاسم'} وسداد ${sar(RULES.investFee)}`, `Submit ${filled.length > 1 ? `${filled.length} names` : 'the name'} and pay ${sar(RULES.investFee)}`)}</button>
        </section>

        <aside className="space-y-4">
          <div className="panel p-5">
            <h2 className="text-lg">{tr('عوائدك', 'Your returns')}</h2>
            <dl className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-[#E2F0E8] p-3"><dt className="text-[13px] text-ok">{tr('أُضيف لمحفظتك', 'Added to your wallet')}</dt><dd className="num text-xl font-extrabold">{sar(earned)}</dd></div>
              <div className="rounded-lg bg-gold-soft p-3"><dt className="text-[13px] text-gold-deep">{tr('بانتظار سداد الفائز', 'Awaiting winner payment')}</dt><dd className="num text-xl font-extrabold">{sar(pending)}</dd></div>
            </dl>
          </div>
          <ol className="panel space-y-3 p-5 text-[14.5px]">
            {[tr(`تقدّم حتى ${RULES.investMaxNames} أسماء وتدفع رسوم الدراسة`, `Submit up to ${RULES.investMaxNames} names and pay the review fee`), tr('تدرسه لجنة مختصة، وعند عدم القبول تصلك رسالة نصية', 'A specialist committee reviews it; if not accepted, you get an SMS'), tr('يُطرح الاسم المقبول في مزاد عام', 'An accepted name goes to public auction'), tr(`بعد انتهاء المزاد يُضاف ${pct}% من قيمة البيع (قبل الضريبة) لمحفظتك فور سداد الفائز`, `After the auction, ${pct}% of the sale price (before VAT) is added to your wallet once the winner pays`)].map((x, i) => (
              <li key={x} className="flex gap-3"><span className="num grid h-6 w-6 shrink-0 place-items-center rounded-full bg-pine text-[12px] font-bold text-paper">{i + 1}</span>{x}</li>
            ))}
          </ol>
        </aside>
      </div>

      <h2 className="mb-3 mt-8 text-xl">{tr('أسمائي المقدّمة للاستثمار', 'My investment names')}</h2>
      {loading && !data ? <Loading /> : items.length ? (
        <>
          <TableTools t={tf} placeholder={tr('بحث بالاسم أو رقم الطلب', 'Search by name or request number')} />
          <ul className="grid gap-3 md:grid-cols-2">
            {tf.list.map((it) => {
              const r = it.request, c = it.candidate, a = it.auction, s = stage(it)
              return (
                <li key={c.id} className="panel flex gap-4 p-4">
                  <NameSeal name={c?.name ?? '—'} type={r.type} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <b className="text-lg">{c?.name}</b><TypeBadge type={r.type} /><span className={`pill ${s.tone}`}>{s.label}</span>
                    </div>
                    <p className="mt-1 text-[13px] text-muted"><span className="num">{r.number}</span> · {dateTime(r.submittedAt || r.createdAt)}</p>
                    {c?.rejectReason && <p className="mt-1 text-sm text-bad">{tr('سبب عدم القبول:', 'Reason not accepted:')} {L(c.rejectReason)}</p>}
                    {a && !a.settled && <p className="mt-1 text-sm">{tr('أعلى سعر الآن', 'Top price now')} <b className="num">{sar(a.currentPrice)}</b>{a.bidCount ? tr(` · ${a.bidCount} مزايدة`, ` · ${a.bidCount} ${a.bidCount === 1 ? 'bid' : 'bids'}`) : ''}</p>}
                    {a?.settled && !it.keptByOwner && <p className="mt-1 text-sm">{tr('بيع بـ', 'Sold for')} <b className="num">{sar(a.finalPrice ?? a.currentPrice)}</b>{tr('، نصيبك', ', your share')} <b className="num text-ok">{sar(it.share ?? 0)}</b></p>}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {r.status === 'pending_payment' && c.id === r.candidates[0].id && <button className="btn-gold btn-sm" onClick={() => setPaying(r)}>{tr('سداد الرسوم', 'Pay fee')} {sar(r.depositAmount)}</button>}
                      {a && <Link to={`/auctions/${a.id}`} className="btn-ghost btn-sm">{tr('صفحة المزاد', 'Auction page')}</Link>}
                      <Link to={`/dashboard/requests/${r.id}`} className="btn-ghost btn-sm">{tr('التفاصيل', 'Details')}</Link>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
          {!tf.list.length && <p className="panel px-5 py-10 text-center text-muted">{tr('لا توجد نتائج مطابقة.', 'No matching results.')}</p>}
        </>
      ) : (
        <Empty title={tr('لم تقدّم أي اسم للاستثمار بعد', 'You have not submitted any names for investment yet')}><p className="text-muted">{tr('اكتب اسمك المبتكر في النموذج أعلاه.', 'Enter your original name in the form above.')}</p></Empty>
      )}

      {paying && (
        <PayModal open title={tr(`رسوم دراسة الطلب ${paying.number}`, `Review fee for request ${paying.number}`)} amount={paying.depositAmount}
          onClose={() => { setPaying(null); reload() }}
          onPay={async (m) => {
            try { await api.payDeposit(paying.id, m); toast(tr('وصل طلبك إلى اللجنة المختصة لدراسته', 'Your request has reached the specialist committee for review')); setNames(Array(RULES.investMaxNames).fill('')); setType(null); setAgree(false); reload() } catch (e) { toast((e as Error).message, 'bad'); throw e }
          }} />
      )}
    </>
  )
}
