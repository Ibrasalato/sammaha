import { useRef, useState } from 'react'
import { Icon } from '../../components/dash'
import { ErrorBox, Loading } from '../../components/ui'
import { usePrint } from '../../components/usePrint'
import { num } from '../../lib/format'
import { downloadCsv } from '../../lib/print'
import { api, useLoad } from '../../lib/store'
import type { ActivityEntry, ActivityFilter } from '../../lib/types'

const ROLE: Record<string, string> = { admin: 'مدير النظام', committee: 'موظف', owner: 'مالك', delegate: 'مفوض', '': 'زائر' }
/** date and time to the second, Riyadh time */
/** Riyadh time as plain digits, so no bidi marks can scramble the order */
const parts = (iso: string) => { const r = new Date(Date.parse(iso) + 3 * 3600_000).toISOString(); return [r.slice(0, 10), r.slice(11, 19)] as const }
const stamp = (iso: string) => parts(iso).join(' ')

function Who({ a }: { a: ActivityEntry }) {
  return (
    <span className="block min-w-[9rem]">
      <b className="font-semibold">{a.actorName || '—'}</b>
      <span className="block text-[12px] text-muted">{ROLE[a.actorRole] ?? a.actorRole}{a.onBehalfOfName ? ` عن ${a.onBehalfOfName}` : ''}</span>
    </span>
  )
}

/** every action on the platform with its date and time (logs.view) */
export function ActivityPanel() {
  const print = usePrint()
  const ref = useRef<HTMLDivElement>(null)
  const [f, setF] = useState<ActivityFilter>({ page: 1, size: 100 })
  const [q, setQ] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const filter: ActivityFilter = { ...f, q: f.q, from: from ? new Date(`${from}T00:00:00+03:00`).toISOString() : undefined, to: to ? new Date(`${to}T23:59:59+03:00`).toISOString() : undefined }
  const { data, loading, error, reload } = useLoad(() => api.activity(filter), [JSON.stringify(filter)], 30000)
  const set = (p: Partial<ActivityFilter>) => setF((x) => ({ ...x, ...p, page: p.page ?? 1 }))
  const pages = data ? Math.max(1, Math.ceil(data.total / (f.size ?? 100))) : 1
  const items = data?.items ?? []
  const subtitle = [from && `من ${from}`, to && `إلى ${to}`, f.category && data?.categories.find((c) => c.key === f.category)?.value, f.role && (f.role === 'staff' ? 'الموظفون' : ROLE[f.role]), f.failed && 'المحاولات الفاشلة فقط', f.q && `بحث: ${f.q}`].filter(Boolean).join(' · ')

  return (
    <section className="panel overflow-hidden">
      <header className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-pine-soft text-pine"><Icon name="history" className="h-[18px] w-[18px]" /></span>
        <div className="min-w-[14rem] flex-1">
          <h2 className="text-[17px]">سجل النشاط</h2>
          <p className="text-[13.5px] text-muted">كل ما يجري على المنصة بالتاريخ والوقت (بتوقيت الرياض): الدخول والطلبات والمزايدات والمدفوعات وإجراءات الموظفين والمفوضين، والمحاولات الفاشلة.</p>
        </div>
        <button className="btn-ghost btn-sm" onClick={() => downloadCsv(`سجل-النشاط-${new Date().toISOString().slice(0, 10)}.csv`, [
          ['التاريخ والوقت', 'المستخدم', 'الصفة', 'نيابة عن', 'الإجراء', 'القسم', 'التفاصيل', 'النتيجة', 'IP', 'الجهاز'],
          ...items.map((a) => [stamp(a.at), a.actorName, ROLE[a.actorRole] ?? a.actorRole, a.onBehalfOfName ?? '', a.action, a.categoryLabel, a.details ?? '', a.success ? 'تم' : `فشل: ${a.error ?? ''}`, a.ip ?? '', a.device ?? '']),
        ])}>تصدير Excel</button>
        <button className="btn-primary btn-sm" onClick={() => print({ title: 'سجل النشاط', subtitle: subtitle || 'كل النشاط', el: ref.current, landscape: true })}><Icon name="file" className="h-4 w-4" />طباعة</button>
      </header>

      <div className="flex flex-wrap items-end gap-2.5 border-b border-line bg-stone/40 px-5 py-3">
        <form className="relative w-full sm:w-64" onSubmit={(e) => { e.preventDefault(); set({ q: q.trim() || undefined }) }}>
          <input className="field py-2 text-[14px]" placeholder="بحث بالاسم أو الإجراء أو التفاصيل أو IP" value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => set({ q: q.trim() || undefined })} />
        </form>
        <select className="field w-auto py-2 text-[14px]" value={f.category ?? ''} onChange={(e) => set({ category: e.target.value || undefined })} aria-label="القسم">
          <option value="">كل الأقسام</option>
          {data?.categories.map((c) => <option key={c.key} value={c.key}>{c.value}</option>)}
        </select>
        <select className="field w-auto py-2 text-[14px]" value={f.role ?? ''} onChange={(e) => set({ role: e.target.value || undefined })} aria-label="المستخدم">
          <option value="">كل المستخدمين</option><option value="staff">الموظفون</option><option value="owner">الملاك</option><option value="delegate">المفوضون</option>
        </select>
        <label className="text-[13px]">من<input type="date" className="field mt-0.5 w-auto py-1.5" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="text-[13px]">إلى<input type="date" className="field mt-0.5 w-auto py-1.5" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <label className="flex items-center gap-1.5 pb-2 text-[13.5px]"><input type="checkbox" checked={!!f.failed} onChange={(e) => set({ failed: e.target.checked || undefined })} />المحاولات الفاشلة فقط</label>
        <button className="pb-2 text-[13px] text-muted underline" onClick={() => { setF({ page: 1, size: 100 }); setQ(''); setFrom(''); setTo('') }}>مسح</button>
        <span className="ms-auto pb-2 text-[13px] text-muted">{data ? `${num(data.total)} سجل` : ''}</span>
      </div>

      {error ? <div className="p-5"><ErrorBox text={error} /></div> : loading && !data ? <Loading /> : items.length ? (
        <div ref={ref} className="overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>التاريخ والوقت</th><th>المستخدم</th><th>الإجراء</th><th>التفاصيل</th><th>النتيجة</th><th>IP والجهاز</th></tr></thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id} className={a.success ? '' : 'bg-bad/5'}>
                  <td className="num whitespace-nowrap text-[13px]"><span dir="ltr" className="block">{parts(a.at)[0]}</span><span dir="ltr" className="block font-bold text-pine">{parts(a.at)[1]}</span></td>
                  <td><Who a={a} /></td>
                  <td><b className="block whitespace-nowrap text-[14px]">{a.action}</b><span className="pill mt-0.5 bg-stone text-[11.5px] text-muted">{a.categoryLabel}</span></td>
                  <td className="max-w-[22rem] text-[12.5px] leading-5 text-muted" style={{ wordBreak: 'break-word' }}>{a.details || '—'}</td>
                  <td className="text-[13px]">{a.success ? <span className="text-ok">✓ تم</span> : <span className="text-bad">✗ {a.error ?? 'فشل'}</span>}</td>
                  <td className="whitespace-nowrap text-[12.5px] text-muted"><span className="num block" dir="ltr" style={{ textAlign: 'right' }}>{a.ip ?? '—'}</span>{a.device}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="px-5 py-10 text-center text-muted">لا يوجد نشاط بهذه التصفية.</p>}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 border-t border-line px-5 py-3 text-[14px]">
          <button className="btn-ghost btn-sm" disabled={(f.page ?? 1) <= 1} onClick={() => setF((x) => ({ ...x, page: (x.page ?? 1) - 1 }))}>السابق</button>
          <span className="num">صفحة {num(f.page ?? 1)} من {num(pages)}</span>
          <button className="btn-ghost btn-sm" disabled={(f.page ?? 1) >= pages} onClick={() => setF((x) => ({ ...x, page: (x.page ?? 1) + 1 }))}>التالي</button>
          <button className="text-[13px] text-muted underline" onClick={() => reload()}>تحديث</button>
        </div>
      )}
    </section>
  )
}
