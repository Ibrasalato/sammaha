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

const pct = Math.round(RULES.investOwnerShare * 100)

/** Where an investment name stands, in one line the owner can act on. */
function stage(it: InvestmentItem): { label: string; tone: string } {
  const { request: r, candidate: c, auction: a } = it
  if (r.status === 'pending_payment') return { label: 'بانتظار سداد رسوم الدراسة', tone: 'bg-gold-soft text-gold-deep' }
  if (c.status === 'withdrawn') return { label: 'سحبته', tone: 'bg-stone-deep text-muted' }
  if (r.status === 'cancelled') return { label: 'ملغى', tone: 'bg-stone-deep text-muted' }
  if (r.status === 'under_review') return { label: 'تدرسه اللجنة', tone: 'bg-stone-deep text-ink' }
  if (c.status === 'rejected') return { label: 'لم يُقبل', tone: 'bg-bad/10 text-bad' }
  if (!a) return { label: 'مقبول، بانتظار موعد المزاد', tone: 'bg-pine-soft text-pine' }
  if (!a.settled) return Date.parse(a.startsAt) > Date.now() ? { label: 'مزاده مجدول', tone: 'bg-pine-soft text-pine' } : { label: 'في المزاد الآن', tone: 'bg-gold text-pine' }
  if (it.keptByOwner) return { label: 'انتهى دون مزايدات، آل إليك', tone: 'bg-stone-deep text-ink' }
  return it.sharePaid ? { label: 'بيع، وأُضيف نصيبك', tone: 'bg-[#E2F0E8] text-ok' } : { label: 'بيع، بانتظار سداد الفائز', tone: 'bg-gold-soft text-gold-deep' }
}

const ORDINAL = ['الأول', 'الثاني', 'الثالث']
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
    filters: [{ key: 'type', label: 'النوع', options: typeOptions('', 'الكل'), test: (x, v) => x.request.type === v }],
  })

  return (
    <>
      <PageHead title="استثمار الاسم" sub={<>اقترح حتى {RULES.investMaxNames} أسماء جديدة. ما تعتمده اللجنة يُطرح في مزاد عام ولك {pct}% من قيمة بيعه. <Link to="/invest" className="font-bold text-pine underline">تفاصيل الخدمة</Link></>} />

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="panel p-5">
          <h2 className="flex items-center gap-2 text-lg"><span className="grid h-9 w-9 place-items-center rounded-lg bg-gold-soft text-gold-deep"><Icon name="coins" /></span>تقديم أسماء جديدة</h2>
          <ClosedNotice intake="investment" className="mt-3" />
          <p className="mt-2 text-sm text-muted">من اسم إلى {RULES.investMaxNames} أسماء في الطلب، جديدة وغير مكررة، ورسوم الدراسة {sar(RULES.investFee)} للطلب كاملًا.</p>
          <div className="mt-4"><TypePicker value={type} onChange={setType} compact /></div>
          <div className={`mt-4 space-y-3 ${type ? '' : 'pointer-events-none opacity-50'}`}>
            {names.map((n, i) => {
              const c = checks[i], bad = !!c && BLOCK.includes(c.verdict)
              return (
                <div key={i}>
                  <label className="label" htmlFor={`inv-name-${i}`}>الاسم {ORDINAL[i]} {i > 0 && <span className="font-normal text-muted">(اختياري)</span>}</label>
                  <input id={`inv-name-${i}`} className={`field font-extrabold text-lg ${bad ? 'border-bad' : ''}`} value={n} maxLength={30}
                    onChange={(e) => setNames(names.map((x, k) => (k === i ? e.target.value : x)))} />
                  {c && (
                    <p className={`mt-1 text-sm font-semibold ${bad ? 'text-bad' : c.verdict === 'similar' ? 'text-warn' : 'text-ok'}`}>
                      {c.verdict === 'exact' ? 'هذا الاسم مسجل أو مطلوب مسبقًا، اختر اسمًا جديدًا غير مكرر' : c.message}
                      {c.verdict === 'similar' && <span className="font-normal text-muted"> (تراجعه اللجنة، وقد يُرفض لتشابهه)</span>}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
          <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-lg bg-stone p-3 text-[14.5px]">
            <input type="checkbox" className="mt-1" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>أوافق على أن رسوم الدراسة <b>{sar(RULES.investFee)}</b> غير مستردة سواء قُبلت الأسماء أو لم تُقبل، وأن عائد كل اسم يُباع يوزّع {100 - pct}% للمنظمة و{pct}% لي، وإن لم يزايد أحد على اسم يؤول إليّ دون النسبة.</span>
          </label>
          <button className="btn-gold mt-4 w-full sm:w-auto sm:px-6" disabled={!ready || busy} onClick={submit}>{busy ? 'جارٍ الرفع…' : `تقديم ${filled.length > 1 ? `${filled.length} أسماء` : 'الاسم'} وسداد ${sar(RULES.investFee)}`}</button>
        </section>

        <aside className="space-y-4">
          <div className="panel p-5">
            <h2 className="text-lg">عوائدك</h2>
            <dl className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-[#E2F0E8] p-3"><dt className="text-[13px] text-ok">أُضيف لمحفظتك</dt><dd className="num text-xl font-extrabold">{sar(earned)}</dd></div>
              <div className="rounded-lg bg-gold-soft p-3"><dt className="text-[13px] text-gold-deep">بانتظار سداد الفائز</dt><dd className="num text-xl font-extrabold">{sar(pending)}</dd></div>
            </dl>
          </div>
          <ol className="panel space-y-3 p-5 text-[14.5px]">
            {[`تقدّم حتى ${RULES.investMaxNames} أسماء وتدفع رسوم الدراسة`, 'تدرسه لجنة مختصة، وعند عدم القبول تصلك رسالة نصية', 'يُطرح الاسم المقبول في مزاد عام', `بعد انتهاء المزاد يُضاف ${pct}% من قيمة البيع (قبل الضريبة) لمحفظتك فور سداد الفائز`].map((x, i) => (
              <li key={x} className="flex gap-3"><span className="num grid h-6 w-6 shrink-0 place-items-center rounded-full bg-pine text-[12px] font-bold text-paper">{i + 1}</span>{x}</li>
            ))}
          </ol>
        </aside>
      </div>

      <h2 className="mb-3 mt-8 text-xl">أسمائي المقدّمة للاستثمار</h2>
      {loading && !data ? <Loading /> : items.length ? (
        <>
          <TableTools t={tf} placeholder="بحث بالاسم أو رقم الطلب" />
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
                    {c?.rejectReason && <p className="mt-1 text-sm text-bad">سبب عدم القبول: {c.rejectReason}</p>}
                    {a && !a.settled && <p className="mt-1 text-sm">أعلى سعر الآن <b className="num">{sar(a.currentPrice)}</b>{a.bidCount ? ` · ${a.bidCount} مزايدة` : ''}</p>}
                    {a?.settled && !it.keptByOwner && <p className="mt-1 text-sm">بيع بـ <b className="num">{sar(a.finalPrice ?? a.currentPrice)}</b>، نصيبك <b className="num text-ok">{sar(it.share ?? 0)}</b></p>}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {r.status === 'pending_payment' && c.id === r.candidates[0].id && <button className="btn-gold btn-sm" onClick={() => setPaying(r)}>سداد الرسوم {sar(r.depositAmount)}</button>}
                      {a && <Link to={`/auctions/${a.id}`} className="btn-ghost btn-sm">صفحة المزاد</Link>}
                      <Link to={`/dashboard/requests/${r.id}`} className="btn-ghost btn-sm">التفاصيل</Link>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
          {!tf.list.length && <p className="panel px-5 py-10 text-center text-muted">لا توجد نتائج مطابقة.</p>}
        </>
      ) : (
        <Empty title="لم تقدّم أي اسم للاستثمار بعد"><p className="text-muted">اكتب اسمك المبتكر في النموذج أعلاه.</p></Empty>
      )}

      {paying && (
        <PayModal open title={`رسوم دراسة الطلب ${paying.number}`} amount={paying.depositAmount}
          onClose={() => { setPaying(null); reload() }}
          onPay={async (m) => {
            try { await api.payDeposit(paying.id, m); toast('وصل طلبك إلى اللجنة المختصة لدراسته'); setNames(Array(RULES.investMaxNames).fill('')); setType(null); setAgree(false); reload() } catch (e) { toast((e as Error).message, 'bad'); throw e }
          }} />
      )}
    </>
  )
}
