import { AuctionActionDialog, useAuctionRights } from '../../components/AuctionControls'
import type { AuctionAction } from '../../components/AuctionControls'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Icon, SectionCard, StatTile } from '../../components/dash'
import { NoResults, TableTools, useTableFilter } from '../../components/TableTools'
import { InvoiceDoc } from '../../components/InvoiceDoc'
import { Countdown, Empty, ErrorBox, Loading, Modal, NameSeal, PageHead, AuctionStatePill, RequestStatusPill, Segmented, TypeBadge } from '../../components/ui'
import { RULES, TYPE_LABEL, typeOptions } from '../../lib/config'
import { phaseOf } from '../../lib/demoApi'
import { date, dateTime, fromLocalInput, namesCount, num, sar, toLocalInput } from '../../lib/format'
import { api, useApp, useLoad } from '../../lib/store'
import type { Auction, AuctionScope, CamelEvent, EventKind, Invoice, NameType, RequestStatus, ReviewDecision } from '../../lib/types'
import { EVENT_KIND } from '../../lib/events'

export function AdminHome() {
  const { user } = useApp()
  const { data } = useLoad(() => api.overview(), [], 15000)
  const queue = useLoad(() => api.listRequests('under_review'), [])
  const live = useLoad(() => api.listAuctions({ phase: 'live' }), [], 15000)
  const today = new Date().toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Riyadh' })

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-xl bg-pine text-paper">
        <img src="./hero/mazayin.webp" alt="" className="absolute inset-0 h-full w-full object-cover opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-l from-pine via-pine/85 to-pine/40" />
        <div className="relative flex flex-wrap items-end gap-6 p-6 sm:p-8">
          <div className="flex-1">
            <p className="text-[14px] font-medium text-gold-light">{today}</p>
            <h1 className="mt-1 text-[28px] font-extrabold text-paper sm:text-[32px]">لوحة لجنة الاعتماد</h1>
            <p className="mt-1 text-paper/75">مرحبًا {user?.fullName.split(' ')[0]}. {data?.underReview ? `${data.underReview === 1 ? 'طلب واحد' : data.underReview === 2 ? 'طلبان' : `${data.underReview} طلبات`} بانتظار المراجعة.` : 'لا توجد طلبات بانتظار المراجعة.'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/admin/requests" className="btn-gold"><Icon name="shield" className="h-4 w-4" />مراجعة الطلبات</Link>
            <Link to="/admin/schedule" className="btn-on-dark">فتح المزادات</Link>
          </div>
        </div>
      </section>

      {data && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <StatTile icon="shield" tone="blue" label="تحت المراجعة" value={num(data.underReview)} hint="طلبات تنتظر قرار اللجنة" to="/admin/requests" highlight={data.underReview > 0} />
          <StatTile icon="calendar" tone="gold" label="بانتظار فتح المزاد" value={num(data.awaitingSchedule)} hint="أسماء مقبولة بلا موعد" to="/admin/schedule" highlight={data.awaitingSchedule > 0} />
          <StatTile icon="gavel" tone="green" label="مزادات جارية" value={num(data.live)} hint={`${num(data.scheduled)} مزاد قادم`} to="/admin/auctions" />
          <StatTile icon="receipt" tone="red" label="فواتير غير مدفوعة" value={num(data.unpaidInvoices)} to="/admin/invoices" />
          <StatTile icon="coins" tone="pine" label="إيرادات محصّلة" value={sar(data.revenue)} hint="شاملة الضريبة" to="/admin/invoices" />
          <StatTile icon="alert" tone="gold" label="شكاوى وبلاغات مفتوحة" value={num(data.openTickets ?? 0)} hint="من صفحة تواصل معنا" to="/admin/tickets" highlight={(data.openTickets ?? 0) > 0} />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <SectionCard title="قائمة المراجعة" icon="shield" action={<Link to="/admin/requests" className="text-[14px] font-bold text-gold-deep hover:underline">الكل</Link>}>
          {queue.data?.length ? (
            <ul className="divide-y divide-line/70">
              {[...queue.data].reverse().slice(0, 6).map((r) => {
                const flagged = r.candidates.filter((c) => c.similar.length).length
                return (
                  <li key={r.id}>
                    <Link to={`/admin/requests/${r.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 hover:bg-stone">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2"><span className="num font-bold">{r.number}</span><TypeBadge type={r.type} /><span className="truncate text-[14px] text-muted">{r.ownerName}</span></div>
                        <div className="mt-1 flex flex-wrap gap-1.5">{r.candidates.map((c) => <span key={c.id} className={`rounded px-2 py-0.5 text-[13px] font-bold ${c.similar.length ? 'bg-gold-soft text-gold-deep' : 'bg-stone-deep'}`}>{c.name}</span>)}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {flagged ? <span className="pill bg-gold-soft text-gold-deep"><Icon name="alert" className="h-3.5 w-3.5" />{flagged === 1 ? 'اسم شبيه' : `${flagged} أسماء شبيهة`}</span> : <span className="pill bg-[#E2F0E8] text-ok">بلا تشابه</span>}
                        <span className="text-[12.5px] text-muted">{dateTime(r.submittedAt)}</span>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          ) : <div className="p-8 text-center text-muted">لا توجد طلبات بانتظار المراجعة.</div>}
        </SectionCard>

        <SectionCard title="مزادات جارية" icon="gavel" action={<Link to="/admin/auctions" className="text-[14px] font-bold text-gold-deep hover:underline">متابعة</Link>}>
          {live.data?.length ? (
            <ul className="divide-y divide-line/70">
              {live.data.slice(0, 6).map((a) => (
                <li key={a.id}>
                  <Link to={`/auctions/${a.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-stone">
                    <NameSeal name={a.name} type={a.type} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-bold">{a.bidCount ? `${num(a.bidCount)} مزايدة` : 'بلا مزايدات'}</p>
                      <Countdown to={a.endsAt} prefix="ينتهي خلال" className="text-[13px]" />
                    </div>
                    <span className="num text-[18px] font-extrabold">{num(a.currentPrice)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <div className="p-8 text-center text-muted">لا توجد مزادات جارية.</div>}
        </SectionCard>
      </div>
    </div>
  )
}

export function AdminRequests() {
  const [status, setStatus] = useState<RequestStatus | 'all'>('under_review')
  const [type, setType] = useState<NameType | 'all'>('all')
  const { data, loading } = useLoad(() => api.listRequests(status), [status])
  const rows = useMemo(() => (data ?? []).filter((r) => type === 'all' || r.type === type), [data, type])
  const tf = useTableFilter(rows, {
    fields: (r) => [r.number, r.ownerName, ...r.candidates.map((c) => c.name)],
    filters: [
      { key: 'kind', label: 'الطلب', options: [['', 'الكل'], ['standard', 'طلب شعار'], ['compound', 'اسم مركب'], ['investment', 'استثمار الاسم']], test: (r, v) => (r.kind ?? 'standard') === v },
      { key: 'similar', label: 'التشابه', options: [['', 'الكل'], ['yes', 'فيها أسماء شبيهة'], ['no', 'بلا تشابه']], test: (r, v) => r.candidates.some((c) => c.similar.length) === (v === 'yes') },
    ],
  })
  const list = tf.list
  return (
    <>
      <PageHead title="طلبات الشعارات" />
      <div className="mb-4 flex flex-wrap gap-3">
        <Segmented value={status} onChange={setStatus} options={[['under_review', 'تحت المراجعة'], ['accepted', 'مقبولة'], ['rejected', 'مرفوضة'], ['cancelled', 'ملغاة'], ['all', 'الكل']]} />
        <Segmented value={type} onChange={setType} options={typeOptions('all', 'الكل')} />
      </div>
      <TableTools t={tf} placeholder="بحث برقم الطلب أو المالك أو الاسم" />
      {loading && !data ? <Loading /> : list.length ? (
        <div className="panel overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>الطلب</th><th>المالك</th><th>النوع</th><th>الأسماء</th><th>الحالة</th><th>التقديم</th></tr></thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id}>
                  <td><Link to={`/admin/requests/${r.id}`} className="num font-semibold underline-offset-4 hover:underline">{r.number}</Link>{r.kind === 'compound' && <span className="pill ms-2 bg-gold-soft text-gold-deep">اسم مركب</span>}{r.kind === 'investment' && <span className="pill ms-2 bg-invest-soft text-invest-deep">استثمار الاسم</span>}</td>
                  <td>{r.ownerName}</td>
                  <td><TypeBadge type={r.type} /></td>
                  <td className="font-extrabold">
                    {r.candidates.map((c, i) => (
                      <span key={c.id} className={c.status === 'rejected' ? 'text-bad line-through' : c.status === 'withdrawn' ? 'text-muted line-through' : c.status === 'accepted' ? 'text-ok' : ''}>
                        {c.name}{c.similar.length ? <sup className="text-gold-deep">●</sup> : null}{i < r.candidates.length - 1 ? '، ' : ''}
                      </span>
                    ))}
                  </td>
                  <td><RequestStatusPill status={r.status} /></td>
                  <td className="whitespace-nowrap text-muted">{date(r.submittedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Empty title="لا توجد طلبات بهذه التصفية" />}
      <p className="mt-2 text-[13px] text-muted"><span className="text-gold-deep">●</span> اسم له أسماء شبيهة يجب التدقيق فيها.</p>
    </>
  )
}

export function AdminReview() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const { toast } = useApp()
  const { data: r, error, loading, reload } = useLoad(() => api.getRequest(id), [id])
  const [dec, setDec] = useState<Record<string, ReviewDecision>>({})
  const [note, setNote] = useState('')
  const [action, setAction] = useState<'reject' | 'cancel' | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!r) return
    // default: exact matches rejected, everything else undecided
    setDec(Object.fromEntries(r.candidates.filter((c) => c.status !== 'withdrawn').map((c) => [c.id, c.similar.some((h) => h.score === 1)
      ? { candidateId: c.id, status: 'rejected', reason: `مطابق لـ«${c.similar.find((h) => h.score === 1)!.name}»` }
      : { candidateId: c.id, status: c.status === 'pending' ? (undefined as never) : (c.status as 'accepted' | 'rejected'), reason: c.rejectReason }])))
  }, [r])

  if (loading && !r) return <Loading />
  if (error || !r) return <ErrorBox text={error || 'الطلب غير موجود'} />
  const editable = r.status === 'under_review'
  const allDecided = r.candidates.every((c) => c.status === 'withdrawn' || dec[c.id]?.status)

  async function run(fn: () => Promise<unknown>, msg: string) {
    setBusy(true)
    try { await fn(); toast(msg); reload() } catch (e) { toast((e as Error).message, 'bad') } finally { setBusy(false) }
  }

  return (
    <>
      <Link to="/admin/requests" className="text-sm font-medium text-muted hover:text-ink">الطلبات</Link>
      {r.kind === 'compound' && (
        <div className="mb-4 mt-3 flex items-start gap-3 rounded-xl border border-gold/50 bg-gold-soft p-4 text-[15px]">
          <Icon name="tag" className="mt-0.5 h-5 w-5 shrink-0 text-gold-deep" />
          <span>طلب <b>اسم مركب</b> من الاسم المسجل «<b>{r.baseName}</b>» المملوك لمقدم الطلب. عند القبول يُسجّل الاسم المركب باسمه مباشرة <b>دون مزاد</b>، وعند الرفض لا يترتب شيء.</span>
        </div>
      )}
      {r.kind === 'investment' && (
        <div className="mb-4 mt-3 flex items-start gap-3 rounded-xl border border-invest/30 bg-invest-soft p-4 text-[15px]">
          <Icon name="coins" className="mt-0.5 h-5 w-5 shrink-0 text-invest-deep" />
          <span>طلب <b>استثمار الاسم</b>: حتى {RULES.investMaxNames} أسماء جديدة، يُدرس كل اسم وفق المعايير المعتمدة. رسوم الدراسة {sar(r.depositAmount)} <b>غير مستردة</b>. عند القبول يُطرح في <b>مزاد عام</b> ويُوزَّع العائد {100 - Math.round(RULES.investOwnerShare * 100)}% للمنظمة و{Math.round(RULES.investOwnerShare * 100)}% لصاحب الاسم، وعند عدم القبول يُبلَّغ برسالة نصية.</span>
        </div>
      )}
      <PageHead title={r.kind === 'compound' ? `مراجعة اسم مركب ${r.number}` : r.kind === 'investment' ? `دراسة استثمار الاسم ${r.number}` : `مراجعة الطلب ${r.number}`} sub={<span className="flex flex-wrap items-center gap-2"><TypeBadge type={r.type} /><RequestStatusPill status={r.status} /><span>{r.ownerName}، قُدّم {dateTime(r.submittedAt)}</span></span>} />

      <div className="space-y-4">
        {r.candidates.map((c) => {
          const d = dec[c.id]
          return (
            <section key={c.id} className="panel grid gap-5 p-5 md:grid-cols-[auto_1fr_260px]">
              <NameSeal name={c.name} type={r.type} size="md" />
              <div>
                <h2 className="text-2xl">{c.name}</h2>
                {c.similar.length ? (
                  <>
                    <p className="mt-1 text-sm font-semibold text-warn">أسماء شبيهة موجودة مسبقًا</p>
                    <table className="tbl mt-2">
                      <thead><tr><th>الاسم</th><th>النوع</th><th>المصدر</th><th>التشابه</th></tr></thead>
                      <tbody>
                        {c.similar.map((h) => (
                          <tr key={h.name + h.source}>
                            <td className="font-extrabold">{h.name}</td>
                            <td>{TYPE_LABEL[h.type]}</td>
                            <td className="text-muted">{r.kind === 'compound' && h.name === r.baseName ? <span className="font-bold text-pine">الاسم الأساسي، ملك مقدم الطلب</span> : h.source === 'reserved' ? 'سجل الأسماء' : h.source === 'auction' ? 'في مزاد' : 'طلب آخر'}</td>
                            <td><span className={`num font-semibold ${h.score === 1 ? 'text-bad' : h.score >= 0.85 ? 'text-warn' : 'text-muted'}`}>{h.score === 1 ? 'مطابق' : `${Math.round(h.score * 100)}%`}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                ) : <p className="mt-1 text-sm font-semibold text-ok">لا توجد أسماء شبيهة</p>}
              </div>
              <div>
                {c.status === 'withdrawn' ? (
                  <div><span className="pill bg-stone-deep text-muted">سحبه المالك</span><p className="mt-1 text-sm text-muted">لا يحتاج قرارًا.</p></div>
                ) : editable ? (
                  <fieldset className="space-y-2">
                    <legend className="label">القرار</legend>
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" aria-pressed={d?.status === 'accepted'} disabled={c.similar.some((h) => h.score === 1)}
                        className={`btn btn-sm border ${d?.status === 'accepted' ? 'border-ok bg-ok text-paper' : 'border-line bg-paper'}`}
                        onClick={() => setDec({ ...dec, [c.id]: { candidateId: c.id, status: 'accepted' } })}>قبول</button>
                      <button type="button" aria-pressed={d?.status === 'rejected'}
                        className={`btn btn-sm border ${d?.status === 'rejected' ? 'border-bad bg-bad text-paper' : 'border-line bg-paper'}`}
                        onClick={() => setDec({ ...dec, [c.id]: { candidateId: c.id, status: 'rejected', reason: d?.reason || 'مشابه لاسم مسجل' } })}>رفض</button>
                    </div>
                    {d?.status === 'rejected' && (
                      <input className="field text-sm" aria-label="سبب الرفض" value={d.reason ?? ''} onChange={(e) => setDec({ ...dec, [c.id]: { ...d, reason: e.target.value } })} />
                    )}
                  </fieldset>
                ) : (
                  <div>
                    <span className={`pill ${c.status === 'accepted' ? 'bg-ok/10 text-ok' : c.status === 'rejected' ? 'bg-bad/10 text-bad' : 'bg-stone-deep text-muted'}`}>{c.status === 'accepted' ? 'مقبول' : c.status === 'rejected' ? 'مرفوض' : 'لم يُراجع'}</span>
                    {c.rejectReason && <p className="mt-1 text-sm text-bad">{c.rejectReason}</p>}
                    {c.auctionId && <Link to={`/auctions/${c.auctionId}`} className="mt-2 block text-sm font-semibold text-gold-deep underline underline-offset-4">صفحة المزاد</Link>}
                  </div>
                )}
              </div>
            </section>
          )
        })}
      </div>

      {editable ? (
        <section className="panel mt-4 p-5">
          <label className="label" htmlFor="note">ملاحظة للمالك (اختياري)</label>
          <textarea id="note" className="field" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn-primary" disabled={!allDecided || busy}
              onClick={() => run(() => api.reviewRequest(r.id, Object.values(dec), note || undefined), 'تم اعتماد قرار اللجنة')}>اعتماد القرار</button>
            <button className="btn-danger" disabled={busy} onClick={() => { setAction('reject'); setReason('') }}>رفض الطلب كاملًا</button>
            <button className="btn-ghost" disabled={busy} onClick={() => { setAction('cancel'); setReason('') }}>إلغاء الطلب</button>
          </div>
          <p className="hint">{r.kind === 'compound'
            ? 'لا ضمان على طلب الاسم المركب. القبول يسجّل الاسم باسم المالك فورًا دون مزاد.'
            : r.kind === 'investment' ? 'رسوم الدراسة لا تُعاد عند الرفض أو الإلغاء. القبول ينقل الاسم إلى «فتح المزادات» لطرحه في مزاد عام.'
            : `الرفض أو الإلغاء يعيد ${sar(r.depositAmount)} إلى محفظة المالك. إن رُفضت الأسماء الثلاثة يُعدّ الطلب مرفوضًا ويُعاد الضمان.`}</p>
        </section>
      ) : r.status === 'accepted' && r.candidates.some((c) => c.status === 'accepted' && !c.auctionId) ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-gold bg-gold-soft p-4">
          <p className="flex-1 font-semibold">الطلب مقبول. حدّد موعد مزاد الأسماء المقبولة.</p>
          <button className="btn-gold" onClick={() => nav('/admin/schedule')}>فتح المزاد</button>
        </div>
      ) : r.reviewNote ? <p className="panel mt-4 p-4 text-sm"><span className="text-muted">ملاحظة اللجنة: </span>{r.reviewNote}</p> : null}

      <Modal open={!!action} onClose={() => setAction(null)} title={action === 'reject' ? 'رفض الطلب' : 'إلغاء الطلب'}>
        <label className="label" htmlFor="rs">السبب (يظهر للمالك)</label>
        <textarea id="rs" className="field" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        <button className={action === 'reject' ? 'btn-danger mt-4 w-full' : 'btn-primary mt-4 w-full'} disabled={!reason.trim() || busy}
          onClick={() => { const a = action; setAction(null); run(() => (a === 'reject' ? api.rejectRequest(r.id, reason) : api.cancelRequest(r.id, reason)), a === 'reject' ? 'رُفض الطلب وأُعيد الضمان' : 'أُلغي الطلب وأُعيد الضمان') }}>
          {action === 'reject' ? 'رفض الطلب وإعادة الضمان' : 'إلغاء الطلب وإعادة الضمان'}
        </button>
      </Modal>
    </>
  )
}

export function AdminSchedule() {
  const { toast } = useApp()
  const { data, loading, reload } = useLoad(() => api.awaitingSchedule(), [])
  const [sel, setSel] = useState<Set<string>>(new Set())
  const base = useMemo(() => { const d = new Date(); d.setMinutes(0, 0, 0); return d.getTime() + 3600_000 }, [])
  const [starts, setStarts] = useState(toLocalInput(base))
  const [ends, setEnds] = useState(toLocalInput(base + 3 * 86400_000))
  const [busy, setBusy] = useState(false)

  const tf = useTableFilter(data, {
    fields: (c) => [c.name, c.request.number, c.request.ownerName],
    filters: [{ key: 'type', label: 'النوع', options: typeOptions('', 'الكل'), test: (x, v) => x.request.type === v }],
  })
  const toggle = (id: string) => { const s = new Set(sel); if (s.has(id)) s.delete(id); else s.add(id); setSel(s) }
  const dur = (days: number) => setEnds(toLocalInput(Date.parse(fromLocalInput(starts)) + days * 86400_000))

  return (
    <>
      <PageHead title="فتح المزادات" sub={`الأسماء المقبولة بانتظار تحديد موعد المزاد. السعر الافتتاحي ${sar(RULES.openingPrice)}، والتوقيت بتوقيت الرياض.`} />
      {loading && !data ? <Loading /> : data?.length ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div>
          <TableTools t={tf} placeholder="بحث بالاسم أو الطلب أو المالك" />
          <div className="panel overflow-x-auto">
            <table className="tbl">
              <thead><tr><th><input type="checkbox" aria-label="تحديد الظاهر" checked={!!tf.list.length && tf.list.every((c) => sel.has(c.id))} onChange={(e) => { const s = new Set(sel); tf.list.forEach((c) => (e.target.checked ? s.add(c.id) : s.delete(c.id))); setSel(s) }} /></th><th>الاسم</th><th>النوع</th><th>الطلب</th><th>المالك</th></tr></thead>
              <tbody>
                {!tf.list.length && <NoResults cols={5} onReset={tf.reset} />}
                {tf.list.map((c) => (
                  <tr key={c.id} className="cursor-pointer hover:bg-stone" onClick={() => toggle(c.id)}>
                    <td><input type="checkbox" checked={sel.has(c.id)} onChange={() => toggle(c.id)} onClick={(e) => e.stopPropagation()} aria-label={c.name} /></td>
                    <td className="font-extrabold text-lg">{c.name}</td>
                    <td><TypeBadge type={c.request.type} /></td>
                    <td className="num">{c.request.number}</td>
                    <td>{c.request.ownerName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>
          <aside className="panel h-fit p-5">
            <h2 className="text-lg">موعد المزاد</h2>
            <label className="label mt-3" htmlFor="st">البداية</label>
            <input id="st" type="datetime-local" className="field num" value={starts} onChange={(e) => setStarts(e.target.value)} />
            <label className="label mt-3" htmlFor="en">النهاية</label>
            <input id="en" type="datetime-local" className="field num" value={ends} onChange={(e) => setEnds(e.target.value)} />
            <div className="mt-2 flex gap-2">{[1, 3, 7].map((d) => <button key={d} className="btn-ghost btn-sm flex-1" onClick={() => dur(d)}>{d === 1 ? 'يوم' : `${d} أيام`}</button>)}</div>
            <button className="btn-gold mt-5 w-full" disabled={!sel.size || busy} onClick={async () => {
              setBusy(true)
              try {
                const res = await api.scheduleAuctions([...sel], fromLocalInput(starts), fromLocalInput(ends))
                toast(`فُتح المزاد لـ${namesCount(res.length)}`)
                setSel(new Set()); reload()
              } catch (e) { toast((e as Error).message, 'bad') } finally { setBusy(false) }
            }}>{sel.size ? `فتح المزاد لـ${namesCount(sel.size)}` : 'اختر الأسماء'}</button>
          </aside>
        </div>
      ) : <Empty title="لا توجد أسماء بانتظار فتح المزاد"><p className="text-muted">تظهر هنا الأسماء بعد قبولها من اللجنة.</p></Empty>}
    </>
  )
}

type AdminState = 'active' | 'live' | 'scheduled' | 'paused' | 'ended' | 'cancelled' | 'all'

export function AdminAuctions() {
  const [state, setState] = useState<AdminState>('active')
  const [type, setType] = useState<NameType | 'all'>('all')
  const { data, loading, reload } = useLoad(() => api.adminAuctions(state, type), [state, type], 10000)
  const rights = useAuctionRights()
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [dialog, setDialog] = useState<{ action: AuctionAction; scope: AuctionScope; label: string } | null>(null)
  const tf = useTableFilter(data, {
    fields: (a) => [a.name, a.winnerName, a.leaderLabel],
    filters: [
      { key: 'bids', label: 'المزايدات', options: [['', 'الكل'], ['some', 'عليها مزايدات'], ['none', 'بلا مزايدات']], test: (a, v) => (v === 'some' ? a.bidCount > 0 : a.bidCount === 0) },
      { key: 'settle', label: 'الترسية', options: [['', 'الكل'], ['requester', 'رست على مقدم الطلب'], ['bidder', 'رست على مزايد'], ['open', 'لم تُرسَ']], test: (a, v) => (v === 'open' ? !a.settled : a.settled && !a.cancelled && (v === 'requester') === !!a.wonByRequester) },
    ],
  })
  const open = (a: Auction) => !a.settled && !a.cancelled
  const showAward = state === 'ended' || state === 'cancelled' || state === 'all'
  const selectable = tf.list.filter(open)
  const chosen = (data ?? []).filter((a) => sel.has(a.id))
  const ask = (action: AuctionAction, list: Auction[]) => setDialog({ action, scope: { ids: list.map((a) => a.id) }, label: list.length === 1 ? `«${list[0].name}»` : `${num(list.length)} مزادات` })
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  return (
    <>
      <PageHead title="التحكم في المزادات" sub="أوقف مؤقتًا أو استأنف أو مدّد أو ألغِ مزادًا محددًا، أو حدّد عدة مزادات. للتطبيق على كل الشعارات مرة واحدة استخدم «الإعدادات ← المزادات»." />
      <div className="mb-4 flex flex-wrap gap-3">
        <Segmented value={state} onChange={(v) => { setState(v); setSel(new Set()) }} options={[['active', 'الحالية'], ['live', 'جارية'], ['scheduled', 'قادمة'], ['paused', 'متوقفة'], ['ended', 'منتهية'], ['cancelled', 'ملغاة'], ['all', 'الكل']]} />
        <Segmented value={type} onChange={(v) => { setType(v); setSel(new Set()) }} options={typeOptions('all', 'الكل')} />
      </div>
      <TableTools t={tf} placeholder="بحث باسم الشعار أو الفائز" />

      {chosen.length > 0 && (rights.manage || rights.cancel) && (
        <div className="sticky top-2 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-pine/30 bg-pine-soft px-4 py-3 shadow-card">
          <b className="me-2">{num(chosen.length)} محدد</b>
          {rights.manage && <>
            <button className="btn-ghost btn-sm" onClick={() => ask('pause', chosen)}>إيقاف مؤقت</button>
            <button className="btn-ghost btn-sm" onClick={() => ask('resume', chosen)}>استئناف</button>
            <button className="btn-ghost btn-sm" onClick={() => ask('extend', chosen)}>تمديد</button>
          </>}
          {rights.cancel && <button className="btn-danger btn-sm" onClick={() => ask('cancel', chosen)}>إلغاء</button>}
          <button className="ms-auto text-sm text-muted underline" onClick={() => setSel(new Set())}>إلغاء التحديد</button>
        </div>
      )}

      {loading && !data ? <Loading /> : data?.length ? (
        <div className="panel overflow-x-auto">
          <table className="tbl">
            <thead><tr>
              <th className="w-8">{selectable.length > 0 && <input type="checkbox" aria-label="تحديد الكل" checked={selectable.every((a) => sel.has(a.id))} onChange={(e) => setSel(e.target.checked ? new Set(selectable.map((a) => a.id)) : new Set())} />}</th>
              <th>الاسم</th><th>الحالة</th><th>السعر</th><th>المزايدات</th><th>الوقت</th>{showAward && <th>الترسية</th>}<th></th>
            </tr></thead>
            <tbody>
              {!tf.list.length && <NoResults cols={showAward ? 8 : 7} onReset={tf.reset} />}
              {tf.list.map((a) => {
                const p = phaseOf(a)
                return (
                  <tr key={a.id} className={a.cancelled ? 'opacity-60' : ''}>
                    <td>{open(a) && <input type="checkbox" aria-label={`تحديد ${a.name}`} checked={sel.has(a.id)} onChange={() => toggle(a.id)} />}</td>
                    <td><Link to={`/auctions/${a.id}`} className="flex items-center gap-2 font-extrabold text-lg hover:text-gold-deep"><TypeBadge type={a.type} />{a.name}</Link></td>
                    <td><AuctionStatePill a={a} phase={p} />{(a.pauseReason || a.cancelReason) && <span className="mt-1 block max-w-[14rem] truncate text-[12.5px] text-muted" title={a.cancelReason || a.pauseReason}>{a.cancelReason || a.pauseReason}</span>}</td>
                    <td className="num whitespace-nowrap font-semibold">{sar(a.finalPrice ?? a.currentPrice)}</td>
                    <td className="num">{num(a.bidCount)}</td>
                    <td className="whitespace-nowrap text-sm">{a.paused ? <span className="text-muted">متوقف منذ {dateTime(a.pausedAt!)}</span> : p === 'live' && !a.cancelled ? <Countdown to={a.endsAt} /> : p === 'scheduled' ? dateTime(a.startsAt) : dateTime(a.endsAt)}</td>
                    {showAward && <td className="text-sm">{a.cancelled ? 'لا ترسية' : a.settled ? `${a.winnerName}${a.wonByRequester ? ' (مقدم الطلب)' : ''}` : '—'}</td>}
                    <td className="whitespace-nowrap">
                      {open(a) && (rights.manage || rights.cancel) && (
                        <select className="field w-auto py-1.5 text-[14px]" value="" aria-label={`إجراء على مزاد ${a.name}`}
                          onChange={(e) => { const v = e.target.value as AuctionAction; if (v) ask(v, [a]) }}>
                          <option value="">إجراء…</option>
                          {rights.manage && (a.paused ? <option value="resume">استئناف</option> : <option value="pause">إيقاف مؤقت</option>)}
                          {rights.manage && <option value="extend">تمديد</option>}
                          {rights.cancel && <option value="cancel">إلغاء المزاد</option>}
                        </select>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : <Empty title="لا توجد مزادات بهذه التصفية" />}
      <AuctionActionDialog action={dialog?.action ?? null} scope={dialog?.scope ?? {}} label={dialog?.label ?? ''} onClose={() => setDialog(null)} onDone={() => { setSel(new Set()); reload() }} />
    </>
  )
}

export function AdminInvoices() {
  const { toast } = useApp()
  const { data, loading, reload } = useLoad(() => api.allInvoices(), [])
  const [view, setView] = useState<Invoice | null>(null)
  const tf = useTableFilter(data, {
    fields: (i) => [i.number, i.buyerName, i.buyerPhone, i.name, i.total],
    filters: [
      { key: 'status', label: 'الحالة', options: [['', 'الكل'], ['unpaid', 'غير مدفوعة'], ['paid', 'مدفوعة']], test: (i, v) => i.status === v },
      { key: 'type', label: 'النوع', options: typeOptions('', 'الكل'), test: (x, v) => x.type === v },
    ],
  })
  const due = tf.list.filter((i) => i.status === 'unpaid').reduce((s, i) => s + i.amountDue, 0)
  return (
    <>
      <PageHead title="الفواتير الإلكترونية" />
      {loading && !data ? <Loading /> : data?.length ? (
        <>
        <TableTools t={tf} placeholder="بحث برقم الفاتورة أو المشتري أو الاسم">
          {due > 0 && <span className="pill bg-gold-soft text-gold-deep">مستحق غير محصّل {sar(due)}</span>}
        </TableTools>
        <div className="panel overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>الفاتورة</th><th>المشتري</th><th>الاسم</th><th>الإجمالي</th><th>الضريبة</th><th>المستحق</th><th>نصيب صاحب الاسم</th><th>الحالة</th><th></th></tr></thead>
            <tbody>
              {!tf.list.length && <NoResults cols={9} onReset={tf.reset} />}
              {tf.list.map((i) => (
                <tr key={i.id}>
                  <td className="num font-semibold">{i.number}</td>
                  <td>{i.buyerName}</td>
                  <td className="font-extrabold">{i.name}</td>
                  <td className="num">{sar(i.total)}</td>
                  <td className="num text-muted">{sar(i.vat)}</td>
                  <td className="num font-semibold">{sar(i.amountDue)}</td>
                  <td>{i.ownerShare ? <span className="whitespace-nowrap"><span className="num font-semibold text-invest-deep">{sar(i.ownerShare)}</span> <span className="text-[12.5px] text-muted">{i.ownerSharePaid ? '· حُوّل' : '· بعد السداد'}</span></span> : <span className="text-muted">—</span>}</td>
                  <td><span className={`pill ${i.status === 'paid' ? 'bg-ok/10 text-ok' : 'bg-gold-soft text-gold-deep'}`}>{i.status === 'paid' ? 'مدفوعة' : 'غير مدفوعة'}</span></td>
                  <td className="whitespace-nowrap">
                    <button className="btn-ghost btn-sm" onClick={() => setView(i)}>عرض</button>
                    {i.status === 'unpaid' && <button className="btn-ghost btn-sm ms-1" onClick={async () => {
                      if (!confirm('تسجيل سداد هذه الفاتورة نقدًا أو بتحويل بنكي؟')) return
                      try { await api.markInvoicePaid(i.id); toast('سُجّل السداد'); reload() } catch (e) { toast((e as Error).message, 'bad') }
                    }}>تسجيل سداد</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      ) : <Empty title="لا توجد فواتير بعد"><p className="text-muted">تُصدر الفاتورة تلقائيًا عند ترسية كل مزاد.</p></Empty>}
      <Modal open={!!view} onClose={() => setView(null)} title="الفاتورة" wide>{view && <InvoiceDoc inv={view} />}</Modal>
    </>
  )
}

const EMPTY_EVENT: CamelEvent = { id: '', title: '', titleEn: '', kind: 'mazayin', startsOn: '', endsOn: '', approx: true, city: '', country: 'السعودية', description: '', url: '' }

export function AdminEvents() {
  const { toast } = useApp()
  const { data, loading, reload } = useLoad(() => api.listEvents(), [])
  const [edit, setEdit] = useState<CamelEvent | null>(null)
  const set = (k: keyof CamelEvent, v: string | boolean) => setEdit((e) => (e ? { ...e, [k]: v } : e))
  const today = new Date().toISOString().slice(0, 10)
  const tf = useTableFilter(data, {
    fields: (e) => [e.title, e.titleEn, e.city, e.country, e.startsOn],
    filters: [
      { key: 'kind', label: 'النوع', options: [['', 'الكل'], ...(Object.entries(EVENT_KIND) as [EventKind, { label: string }][]).map(([k, v]) => [k, v.label] as [string, string])], test: (e, v) => e.kind === v },
      { key: 'when', label: 'الموعد', options: [['', 'الكل'], ['upcoming', 'قادمة'], ['now', 'جارية الآن'], ['past', 'منتهية']], test: (e, v) => (v === 'past' ? e.endsOn < today : v === 'now' ? e.startsOn <= today && e.endsOn >= today : e.startsOn > today) },
      { key: 'approx', label: 'الإعلان', options: [['', 'الكل'], ['yes', 'موعد متوقع'], ['no', 'معلن رسميًا']], test: (e, v) => e.approx === (v === 'yes') },
    ],
  })
  return (
    <>
      <PageHead title="المواعيد والفعاليات" sub="تظهر في تقويم المنصة وصفحتها الرئيسية. ألغِ علامة «موعد متوقع» عند الإعلان الرسمي."
        action={<button className="btn-gold" onClick={() => setEdit({ ...EMPTY_EVENT })}>إضافة فعالية</button>} />
      {loading && !data ? <Loading /> : data?.length ? (
        <>
        <TableTools t={tf} placeholder="بحث باسم الفعالية أو المدينة" />
        <div className="panel overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>الفعالية</th><th>النوع</th><th>من</th><th>إلى</th><th>المكان</th><th>الحالة</th><th></th></tr></thead>
            <tbody>
              {!tf.list.length && <NoResults cols={7} onReset={tf.reset} />}
              {tf.list.map((e) => (
                <tr key={e.id}>
                  <td className="font-bold">{e.title}</td>
                  <td><span className={`pill ${EVENT_KIND[e.kind].cls}`}>{EVENT_KIND[e.kind].label}</span></td>
                  <td className="num whitespace-nowrap">{e.startsOn}</td>
                  <td className="num whitespace-nowrap">{e.endsOn}</td>
                  <td className="text-muted">{e.city}، {e.country}</td>
                  <td>{e.approx ? <span className="pill border border-dashed border-gold text-gold-deep">متوقع</span> : <span className="pill bg-[#E2F0E8] text-ok">معلن رسميًا</span>}</td>
                  <td className="whitespace-nowrap">
                    <button className="btn-ghost btn-sm" onClick={() => setEdit({ ...e, url: e.url ?? '' })}>تعديل</button>
                    <button className="btn-ghost btn-sm ms-1 text-bad" onClick={async () => {
                      if (!confirm(`حذف «${e.title}» من التقويم؟`)) return
                      try { await api.deleteEvent(e.id); toast('حُذفت الفعالية'); reload() } catch (x) { toast((x as Error).message, 'bad') }
                    }}>حذف</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      ) : <Empty title="لا توجد فعاليات"><button className="btn-gold btn-sm" onClick={() => setEdit({ ...EMPTY_EVENT })}>إضافة فعالية</button></Empty>}

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'تعديل فعالية' : 'إضافة فعالية'} wide>
        {edit && (
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={async (ev) => {
            ev.preventDefault()
            try { await api.saveEvent({ ...edit, url: edit.url || undefined }); toast('حُفظت الفعالية'); setEdit(null); reload() } catch (x) { toast((x as Error).message, 'bad') }
          }}>
            <div className="sm:col-span-2"><label className="label" htmlFor="et">اسم الفعالية</label><input id="et" className="field" value={edit.title} onChange={(e) => set('title', e.target.value)} required /></div>
            <div><label className="label" htmlFor="ete">الاسم بالإنجليزية</label><input id="ete" className="field" dir="ltr" value={edit.titleEn} onChange={(e) => set('titleEn', e.target.value)} /></div>
            <div><label className="label" htmlFor="ek">النوع</label>
              <select id="ek" className="field" value={edit.kind} onChange={(e) => set('kind', e.target.value)}>
                {(Object.keys(EVENT_KIND) as EventKind[]).map((k) => <option key={k} value={k}>{EVENT_KIND[k].label}</option>)}
              </select>
            </div>
            <div><label className="label" htmlFor="es">من</label><input id="es" type="date" className="field num" value={edit.startsOn} onChange={(e) => set('startsOn', e.target.value)} required /></div>
            <div><label className="label" htmlFor="ee">إلى</label><input id="ee" type="date" className="field num" value={edit.endsOn} onChange={(e) => set('endsOn', e.target.value)} required /></div>
            <div><label className="label" htmlFor="ec">المدينة أو الموقع</label><input id="ec" className="field" value={edit.city} onChange={(e) => set('city', e.target.value)} /></div>
            <div><label className="label" htmlFor="eco">الدولة</label><input id="eco" className="field" value={edit.country} onChange={(e) => set('country', e.target.value)} /></div>
            <div className="sm:col-span-2"><label className="label" htmlFor="ed">الوصف</label><textarea id="ed" className="field" rows={3} value={edit.description} onChange={(e) => set('description', e.target.value)} /></div>
            <div className="sm:col-span-2"><label className="label" htmlFor="eu">رابط رسمي (اختياري)</label><input id="eu" className="field" dir="ltr" value={edit.url ?? ''} onChange={(e) => set('url', e.target.value)} /></div>
            <label className="flex items-center gap-2 text-[15px] font-bold sm:col-span-2"><input type="checkbox" checked={edit.approx} onChange={(e) => set('approx', e.target.checked)} />موعد متوقع (لم يُعلن رسميًا بعد)</label>
            <button className="btn-primary sm:col-span-2">حفظ</button>
          </form>
        )}
      </Modal>
    </>
  )
}
