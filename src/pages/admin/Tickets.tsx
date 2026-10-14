import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Icon, StatTile } from '../../components/dash'
import { TicketProgress, TicketStatusPill, TicketThread } from '../../components/TicketThread'
import { Empty, ErrorBox, Loading, PageHead, Segmented } from '../../components/ui'
import { dateTime, num } from '../../lib/format'
import { api, useApp, useLoad } from '../../lib/store'
import { KIND_LABEL, PRIORITY_LABEL, STATUS_LABEL, TICKET_KINDS } from '../../lib/tickets'
import type { Ticket, TicketKind, TicketPriority, TicketStatus } from '../../lib/types'

type View = 'open' | TicketStatus | 'all'

export function AdminTickets() {
  const { data, loading, error } = useLoad(() => api.listTickets(), [], 20000)
  const [view, setView] = useState<View>('open')
  const [kind, setKind] = useState<TicketKind | 'all'>('all')
  const [q, setQ] = useState('')
  const all = data ?? []
  const count = (f: (t: Ticket) => boolean) => all.filter(f).length
  const list = useMemo(() => {
    const s = q.trim()
    return all
      .filter((t) => (view === 'all' ? true : view === 'open' ? t.status === 'new' || t.status === 'in_progress' : t.status === view))
      .filter((t) => kind === 'all' || t.kind === kind)
      .filter((t) => !s || [t.number, t.name, t.phone, t.subject, t.refNumber ?? ''].some((x) => x.includes(s)))
      // urgent first, then oldest waiting first so nothing is forgotten
      .sort((a, b) => (a.priority === b.priority ? 0 : a.priority === 'urgent' ? -1 : 1) || (view === 'open' ? Date.parse(a.createdAt) - Date.parse(b.createdAt) : Date.parse(b.createdAt) - Date.parse(a.createdAt)))
  }, [all, view, kind, q])

  return (
    <>
      <PageHead title="الشكاوى والبلاغات والاستفسارات" sub="كل ما يصل من صفحة «تواصل معنا» برقم متابعة لكل طلب، مرتبة بالأولوية ثم الأقدم انتظارًا." />
      {error && <ErrorBox text={error} />}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon="alert" tone="gold" label="جديدة" value={num(count((t) => t.status === 'new'))} hint="لم يُرد عليها بعد" highlight={count((t) => t.status === 'new') > 0} />
        <StatTile icon="clock" tone="blue" label="قيد المعالجة" value={num(count((t) => t.status === 'in_progress'))} />
        <StatTile icon="shield" tone="red" label="عاجلة مفتوحة" value={num(count((t) => t.priority === 'urgent' && (t.status === 'new' || t.status === 'in_progress')))} hint="بلاغات وأولويات" />
        <StatTile icon="check" tone="green" label="تم الرد أو أُغلقت" value={num(count((t) => t.status === 'answered' || t.status === 'closed'))} />
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented value={view} onChange={setView} options={[['open', 'المفتوحة'], ['new', 'جديدة'], ['in_progress', 'قيد المعالجة'], ['answered', 'تم الرد'], ['closed', 'مغلقة'], ['all', 'الكل']]} />
        <select className="field w-auto py-2" value={kind} onChange={(e) => setKind(e.target.value as TicketKind | 'all')} aria-label="النوع">
          <option value="all">كل الأنواع</option>
          {TICKET_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k].ar}</option>)}
        </select>
        <input className="field w-full py-2 sm:w-64" placeholder="بحث بالرقم أو الاسم أو الجوال" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {loading && !data ? <Loading /> : list.length ? (
        <div className="panel overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>الرقم</th><th>النوع</th><th>العنوان</th><th>مقدّم الطلب</th><th>الحالة</th><th>الأولوية</th><th>آخر تحديث</th></tr></thead>
            <tbody>
              {list.map((t) => (
                <tr key={t.id} className={t.status === 'new' ? 'bg-gold-soft/30' : ''}>
                  <td><Link to={`/admin/tickets/${t.id}`} className="num font-bold underline-offset-4 hover:underline" dir="ltr">{t.number}</Link></td>
                  <td className="whitespace-nowrap">{KIND_LABEL[t.kind].ar}</td>
                  <td className="max-w-xs"><Link to={`/admin/tickets/${t.id}`} className="line-clamp-1 font-bold hover:text-pine">{t.subject}</Link><span className="text-[13px] text-muted">{t.topic}</span></td>
                  <td className="whitespace-nowrap">{t.name}<div className="num text-[13px] text-muted" dir="ltr">{t.phone}</div></td>
                  <td><TicketStatusPill status={t.status} /></td>
                  <td>{t.priority === 'urgent' ? <span className="pill bg-rose-soft text-rose-deep">عاجل</span> : <span className="text-muted">عادي</span>}</td>
                  <td className="whitespace-nowrap text-[14px] text-muted">{dateTime(t.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Empty title="لا توجد طلبات بهذه التصفية" />}
    </>
  )
}

export function AdminTicket() {
  const { id = '' } = useParams()
  const { toast } = useApp()
  const { data: t, error, setData } = useLoad(() => api.getTicket(id), [id])
  const [body, setBody] = useState('')
  const [internal, setInternal] = useState(false)
  const [busy, setBusy] = useState(false)

  async function run(p: Promise<Ticket>, msg: string) {
    setBusy(true)
    try { setData(await p); toast(msg) } catch (e) { toast((e as Error).message) } finally { setBusy(false) }
  }
  async function reply(e: FormEvent) {
    e.preventDefault()
    await run(api.replyTicket(id, body, internal), internal ? 'حُفظت الملاحظة الداخلية' : t?.email ? 'أُرسل الرد وأُبلغ العميل بالبريد' : 'أُرسل الرد')
    setBody('')
  }
  if (error) return <ErrorBox text={error} />
  if (!t) return <Loading />

  return (
    <>
      <Link to="/admin/tickets" className="mb-3 inline-flex items-center gap-1.5 text-[14px] font-bold text-muted hover:text-pine"><Icon name="arrow" className="h-4 w-4 ltr:rotate-180" />كل الطلبات</Link>
      <PageHead title={t.subject} sub={<span className="flex flex-wrap items-center gap-2"><span className="num font-bold text-ink" dir="ltr">{t.number}</span>·<span>{KIND_LABEL[t.kind].ar}</span>·<span>{t.topic}</span>·<span>{dateTime(t.createdAt)}</span></span>}
        action={<TicketStatusPill status={t.status} />} />
      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-5">
          <div className="panel px-5 py-4"><TicketProgress status={t.status} /></div>
          <div className="panel p-5"><TicketThread t={t} staffView /></div>
          {t.status !== 'closed' && (
            <form onSubmit={reply} className="panel space-y-3 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="label mb-0" htmlFor="rb">{internal ? 'ملاحظة داخلية (لا تظهر للعميل)' : 'الرد على العميل'}</label>
                <label className="flex cursor-pointer items-center gap-2 text-[14px]"><input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} className="h-4 w-4 accent-[#C99532]" />ملاحظة داخلية</label>
              </div>
              <textarea id="rb" className={`field ${internal ? 'border-gold/60 bg-gold-soft/30' : ''}`} rows={5} maxLength={3000} value={body} onChange={(e) => setBody(e.target.value)} required
                placeholder={internal ? 'ملاحظة للفريق فقط' : `مرحبًا ${t.name.split(' ')[0]}، …`} />
              <div className="flex flex-wrap items-center gap-3">
                <button className={internal ? 'btn-gold' : 'btn-primary'} disabled={busy || body.trim().length < 2}>{internal ? 'حفظ الملاحظة' : 'إرسال الرد'}</button>
                {!internal && <span className="text-[13px] text-muted">{t.email ? `يُرسل نسخة إلى ${t.email}` : 'لا يوجد بريد للعميل، سيظهر الرد في صفحة المتابعة'}{t.userId ? ' وإشعارًا في حسابه' : ''}.</span>}
              </div>
            </form>
          )}
        </div>
        <aside className="space-y-4">
          <div className="panel divide-y divide-line/70">
            <h2 className="px-5 py-3.5 text-[17px]">مقدّم الطلب</h2>
            {([
              ['الاسم', t.name, ''],
              ['الجوال', t.phone, `tel:${t.phone}`],
              ['واتساب', t.phone, `https://wa.me/966${t.phone.slice(1)}`],
              ['البريد', t.email ?? '—', t.email ? `mailto:${t.email}?subject=${encodeURIComponent(`[${t.number}] ${t.subject}`)}` : ''],
              ['رقم مرجعي', t.refNumber ?? '—', ''],
              ['الحساب', t.userId ? 'مستخدم مسجّل' : 'زائر', ''],
            ] as [string, string, string][]).map(([l, v, href]) => (
              <div key={l} className="flex items-center justify-between gap-3 px-5 py-3 text-[15px]">
                <span className="text-muted">{l}</span>
                {href ? <a href={href} target="_blank" rel="noreferrer" className="num font-bold text-pine hover:underline" dir="ltr">{v}</a> : <span className="num font-bold" dir="auto">{v}</span>}
              </div>
            ))}
          </div>
          <div className="panel space-y-4 p-5">
            <h2 className="text-[17px]">إدارة الطلب</h2>
            <div>
              <label className="label" htmlFor="ss">الحالة</label>
              <select id="ss" className="field" value={t.status} disabled={busy} onChange={(e) => run(api.updateTicket(id, { status: e.target.value as TicketStatus }), 'تم تحديث الحالة')}>
                {(Object.keys(STATUS_LABEL) as TicketStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s][0]}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="sp">الأولوية</label>
              <select id="sp" className="field" value={t.priority} disabled={busy} onChange={(e) => run(api.updateTicket(id, { priority: e.target.value as TicketPriority }), 'تم تحديث الأولوية')}>
                {(Object.keys(PRIORITY_LABEL) as TicketPriority[]).map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="sa">المسؤول</label>
              <input id="sa" className="field" defaultValue={t.assignee ?? ''} key={t.assignee ?? ''} placeholder="اسم الموظف"
                onBlur={(e) => { if (e.target.value !== (t.assignee ?? '')) run(api.updateTicket(id, { assignee: e.target.value }), 'تم تعيين المسؤول') }} />
            </div>
            {t.status !== 'closed'
              ? <button className="btn-ghost w-full" disabled={busy} onClick={() => run(api.updateTicket(id, { status: 'closed' }), 'أُغلق الطلب')}>إغلاق الطلب</button>
              : <button className="btn-ghost w-full" disabled={busy} onClick={() => run(api.updateTicket(id, { status: 'in_progress' }), 'أُعيد فتح الطلب')}>إعادة فتح الطلب</button>}
          </div>
        </aside>
      </div>
    </>
  )
}
