import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { InvoiceDoc } from '../../components/InvoiceDoc'
import { Countdown, Empty, ErrorBox, Loading, Modal, NameSeal, PageHead, PhasePill, RequestStatusPill, Segmented, TypeBadge } from '../../components/ui'
import { RULES, TYPE_LABEL } from '../../lib/config'
import { phaseOf } from '../../lib/demoApi'
import { date, dateTime, fromLocalInput, namesCount, num, sar, toLocalInput } from '../../lib/format'
import { api, useApp, useLoad } from '../../lib/store'
import type { AuctionPhase, CamelEvent, EventKind, Invoice, NameType, RequestStatus, ReviewDecision } from '../../lib/types'
import { EVENT_KIND } from '../../lib/events'

export function AdminHome() {
  const { data } = useLoad(() => api.overview(), [], 15000)
  const queue = useLoad(() => api.listRequests('under_review'), [])
  const tiles: [string, string, string][] = data ? [
    ['طلبات تحت المراجعة', num(data.underReview), '/admin/requests'],
    ['أسماء بانتظار فتح المزاد', num(data.awaitingSchedule), '/admin/schedule'],
    ['مزادات جارية', num(data.live), '/admin/auctions'],
    ['مزادات قادمة', num(data.scheduled), '/admin/auctions'],
    ['فواتير غير مدفوعة', num(data.unpaidInvoices), '/admin/invoices'],
    ['إيرادات محصلة', sar(data.revenue), '/admin/invoices'],
  ] : []
  return (
    <>
      <PageHead title="لوحة لجنة الاعتماد" />
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {tiles.map(([l, v, to]) => (
          <Link key={l} to={to} className="panel block p-4 hover:border-navy"><dt className="text-sm text-muted">{l}</dt><dd className="num mt-1 font-extrabold text-2xl font-semibold">{v}</dd></Link>
        ))}
      </dl>
      <h2 className="mb-3 mt-8 text-xl">أقدم الطلبات في قائمة المراجعة</h2>
      {queue.data?.length ? (
        <ul className="panel divide-y divide-line/70">
          {[...queue.data].reverse().slice(0, 6).map((r) => (
            <li key={r.id}>
              <Link to={`/admin/requests/${r.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-stone">
                <span className="num font-semibold">{r.number}</span><TypeBadge type={r.type} />
                <span className="font-extrabold">{r.candidates.map((c) => c.name).join('، ')}</span>
                {r.candidates.some((c) => c.similar.length) && <span className="pill bg-gold-soft text-gold-deep">أسماء شبيهة</span>}
                <span className="ms-auto text-sm text-muted">{dateTime(r.submittedAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : <Empty title="لا توجد طلبات بانتظار المراجعة" />}
    </>
  )
}

export function AdminRequests() {
  const [status, setStatus] = useState<RequestStatus | 'all'>('under_review')
  const [type, setType] = useState<NameType | 'all'>('all')
  const { data, loading } = useLoad(() => api.listRequests(status), [status])
  const list = (data ?? []).filter((r) => type === 'all' || r.type === type)
  return (
    <>
      <PageHead title="طلبات الشعارات" />
      <div className="mb-4 flex flex-wrap gap-3">
        <Segmented value={status} onChange={setStatus} options={[['under_review', 'تحت المراجعة'], ['accepted', 'مقبولة'], ['rejected', 'مرفوضة'], ['cancelled', 'ملغاة'], ['all', 'الكل']]} />
        <Segmented value={type} onChange={setType} options={[['all', 'الكل'], ['qaadan', 'قعدان'], ['bakkar', 'بكار']]} />
      </div>
      {loading && !data ? <Loading /> : list.length ? (
        <div className="panel overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>الطلب</th><th>المالك</th><th>النوع</th><th>الأسماء</th><th>الحالة</th><th>التقديم</th></tr></thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id}>
                  <td><Link to={`/admin/requests/${r.id}`} className="num font-semibold underline-offset-4 hover:underline">{r.number}</Link></td>
                  <td>{r.ownerName}</td>
                  <td><TypeBadge type={r.type} /></td>
                  <td className="font-extrabold">
                    {r.candidates.map((c, i) => (
                      <span key={c.id} className={c.status === 'rejected' ? 'text-bad line-through' : c.status === 'accepted' ? 'text-ok' : ''}>
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
    setDec(Object.fromEntries(r.candidates.map((c) => [c.id, c.similar.some((h) => h.score === 1)
      ? { candidateId: c.id, status: 'rejected', reason: `مطابق لـ«${c.similar.find((h) => h.score === 1)!.name}»` }
      : { candidateId: c.id, status: c.status === 'pending' ? (undefined as never) : c.status, reason: c.rejectReason }])))
  }, [r])

  if (loading && !r) return <Loading />
  if (error || !r) return <ErrorBox text={error || 'الطلب غير موجود'} />
  const editable = r.status === 'under_review'
  const allDecided = r.candidates.every((c) => dec[c.id]?.status)

  async function run(fn: () => Promise<unknown>, msg: string) {
    setBusy(true)
    try { await fn(); toast(msg); reload() } catch (e) { toast((e as Error).message, 'bad') } finally { setBusy(false) }
  }

  return (
    <>
      <Link to="/admin/requests" className="text-sm font-semibold text-muted hover:text-ink">الطلبات</Link>
      <PageHead title={`مراجعة الطلب ${r.number}`} sub={<span className="flex flex-wrap items-center gap-2"><TypeBadge type={r.type} /><RequestStatusPill status={r.status} /><span>{r.ownerName}، قُدّم {dateTime(r.submittedAt)}</span></span>} />

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
                            <td className="text-muted">{h.source === 'reserved' ? 'سجل الأسماء' : h.source === 'auction' ? 'في مزاد' : 'طلب آخر'}</td>
                            <td><span className={`num font-semibold ${h.score === 1 ? 'text-bad' : h.score >= 0.85 ? 'text-warn' : 'text-muted'}`}>{h.score === 1 ? 'مطابق' : `${Math.round(h.score * 100)}%`}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                ) : <p className="mt-1 text-sm font-semibold text-ok">لا توجد أسماء شبيهة</p>}
              </div>
              <div>
                {editable ? (
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
          <p className="hint">الرفض أو الإلغاء يعيد {sar(r.depositAmount)} إلى محفظة المالك. إن رُفضت الأسماء الثلاثة يُعدّ الطلب مرفوضًا ويُعاد الضمان.</p>
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

  const toggle = (id: string) => { const s = new Set(sel); if (s.has(id)) s.delete(id); else s.add(id); setSel(s) }
  const dur = (days: number) => setEnds(toLocalInput(Date.parse(fromLocalInput(starts)) + days * 86400_000))

  return (
    <>
      <PageHead title="فتح المزادات" sub={`الأسماء المقبولة بانتظار تحديد موعد المزاد. السعر الافتتاحي ${sar(RULES.openingPrice)}، والتوقيت بتوقيت الرياض.`} />
      {loading && !data ? <Loading /> : data?.length ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="panel overflow-x-auto">
            <table className="tbl">
              <thead><tr><th><input type="checkbox" aria-label="تحديد الكل" checked={sel.size === data.length} onChange={(e) => setSel(e.target.checked ? new Set(data.map((c) => c.id)) : new Set())} /></th><th>الاسم</th><th>النوع</th><th>الطلب</th><th>المالك</th></tr></thead>
              <tbody>
                {data.map((c) => (
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

export function AdminAuctions() {
  const [phase, setPhase] = useState<AuctionPhase | 'all'>('live')
  const [type, setType] = useState<NameType | 'all'>('all')
  const { data, loading } = useLoad(() => api.listAuctions({ phase, type }), [phase, type], 10000)
  return (
    <>
      <PageHead title="متابعة المزادات" />
      <div className="mb-4 flex flex-wrap gap-3">
        <Segmented value={phase} onChange={setPhase} options={[['live', 'جارية'], ['scheduled', 'قادمة'], ['ended', 'منتهية'], ['all', 'الكل']]} />
        <Segmented value={type} onChange={setType} options={[['all', 'الكل'], ['qaadan', 'قعدان'], ['bakkar', 'بكار']]} />
      </div>
      {loading && !data ? <Loading /> : data?.length ? (
        <div className="panel overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>الاسم</th><th>الحالة</th><th>السعر</th><th>المزايدات</th><th>الوقت</th><th>الترسية</th></tr></thead>
            <tbody>
              {data.map((a) => {
                const p = phaseOf(a)
                return (
                  <tr key={a.id}>
                    <td><Link to={`/auctions/${a.id}`} className="flex items-center gap-2 font-extrabold text-lg hover:text-gold-deep"><TypeBadge type={a.type} />{a.name}</Link></td>
                    <td><PhasePill phase={p} /></td>
                    <td className="num font-semibold">{sar(a.finalPrice ?? a.currentPrice)}</td>
                    <td className="num">{num(a.bidCount)}</td>
                    <td className="whitespace-nowrap text-sm">{p === 'live' ? <Countdown to={a.endsAt} /> : p === 'scheduled' ? dateTime(a.startsAt) : dateTime(a.endsAt)}</td>
                    <td className="text-sm">{a.settled ? `${a.winnerName}${a.wonByRequester ? ' (مقدم الطلب)' : ''}` : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : <Empty title="لا توجد مزادات بهذه التصفية" />}
    </>
  )
}

export function AdminInvoices() {
  const { toast } = useApp()
  const { data, loading, reload } = useLoad(() => api.allInvoices(), [])
  const [view, setView] = useState<Invoice | null>(null)
  return (
    <>
      <PageHead title="الفواتير الإلكترونية" />
      {loading && !data ? <Loading /> : data?.length ? (
        <div className="panel overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>الفاتورة</th><th>المشتري</th><th>الاسم</th><th>الإجمالي</th><th>الضريبة</th><th>المستحق</th><th>الحالة</th><th></th></tr></thead>
            <tbody>
              {data.map((i) => (
                <tr key={i.id}>
                  <td className="num font-semibold">{i.number}</td>
                  <td>{i.buyerName}</td>
                  <td className="font-extrabold">{i.name}</td>
                  <td className="num">{sar(i.total)}</td>
                  <td className="num text-muted">{sar(i.vat)}</td>
                  <td className="num font-semibold">{sar(i.amountDue)}</td>
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
      ) : <Empty title="لا توجد فواتير بعد"><p className="text-muted">تُصدر الفاتورة تلقائيًا عند ترسية كل مزاد.</p></Empty>}
      <Modal open={!!view} onClose={() => setView(null)} title="الفاتورة" wide>{view && <InvoiceDoc inv={view} />}</Modal>
    </>
  )
}

export function AdminUsers() {
  const { data, loading } = useLoad(() => api.listUsers(), [])
  return (
    <>
      <PageHead title="المستخدمون" />
      {loading && !data ? <Loading /> : (
        <div className="panel overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>الاسم</th><th>الجوال</th><th>البريد</th><th>الدور</th><th>التسجيل</th></tr></thead>
            <tbody>
              {data?.map((u) => (
                <tr key={u.id}>
                  <td className="font-semibold">{u.fullName}</td>
                  <td className="num" dir="ltr" style={{ textAlign: 'right' }}>{u.phone}</td>
                  <td className="text-muted">{u.email}</td>
                  <td>{u.role === 'owner' ? 'مالك' : u.role === 'committee' ? 'لجنة الاعتماد' : 'مدير'}</td>
                  <td className="text-muted">{date(u.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

const EMPTY_EVENT: CamelEvent = { id: '', title: '', titleEn: '', kind: 'mazayin', startsOn: '', endsOn: '', approx: true, city: '', country: 'السعودية', description: '', url: '' }

export function AdminEvents() {
  const { toast } = useApp()
  const { data, loading, reload } = useLoad(() => api.listEvents(), [])
  const [edit, setEdit] = useState<CamelEvent | null>(null)
  const set = (k: keyof CamelEvent, v: string | boolean) => setEdit((e) => (e ? { ...e, [k]: v } : e))
  return (
    <>
      <PageHead title="المواعيد والفعاليات" sub="تظهر في تقويم المنصة وصفحتها الرئيسية. ألغِ علامة «موعد متوقع» عند الإعلان الرسمي."
        action={<button className="btn-gold" onClick={() => setEdit({ ...EMPTY_EVENT })}>إضافة فعالية</button>} />
      {loading && !data ? <Loading /> : data?.length ? (
        <div className="panel overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>الفعالية</th><th>النوع</th><th>من</th><th>إلى</th><th>المكان</th><th>الحالة</th><th></th></tr></thead>
            <tbody>
              {data.map((e) => (
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
