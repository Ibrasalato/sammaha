import { useMemo, useRef, useState } from 'react'
import { Icon, StatTile } from '../../components/dash'
import { Empty, ErrorBox, Loading, Modal, PageHead } from '../../components/ui'
import { NoResults, TableTools, useTableFilter } from '../../components/TableTools'
import { NAME_TYPES, TYPE_LABEL } from '../../lib/config'
import { countryName } from '../../lib/countries'
import { date, num, sar } from '../../lib/format'
import { can } from '../../lib/permissions'
import { downloadCsv, printReport } from '../../lib/print'
import { api, useApp, useLoad } from '../../lib/store'
import type { NameType, OwnerCrm } from '../../lib/types'

type Sort = 'recent' | 'names' | 'value' | 'name'
const byType = (o: OwnerCrm, t: NameType) => o.names.filter((n) => n.type === t)

export function AdminCustomers() {
  const { user, toast } = useApp()
  const { data, loading, error } = useLoad(() => api.listOwners(), [])
  const [sort, setSort] = useState<Sort>('names')
  const [view, setView] = useState<OwnerCrm | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const full = can(user, 'owners.full')
  const nationalities = useMemo(() => [...new Set((data ?? []).map((o) => o.nationality).filter(Boolean) as string[])], [data])
  const cities = useMemo(() => [...new Set((data ?? []).map((o) => o.residenceCity).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'ar')), [data])
  const tf = useTableFilter(data, {
    fields: (o) => [o.fullName, o.nationalId, o.phone, o.email, ...o.names.map((n) => n.name)],
    filters: [
      { key: 'type', label: 'الفئة', options: [['', 'كل الفئات'], ...NAME_TYPES.map((t) => [t, `يملك ${TYPE_LABEL[t]}`] as [string, string]), ['none', 'بلا شعارات']], test: (o, v) => (v === 'none' ? !o.names.length : o.names.some((n) => n.type === v)) },
      { key: 'nat', label: 'الجنسية', options: [['', 'الكل'], ...nationalities.map((c) => [c, countryName(c)] as [string, string])], test: (o, v) => o.nationality === v },
      { key: 'city', label: 'المدينة', options: [['', 'الكل'], ...cities.map((c) => [c, c] as [string, string])], test: (o, v) => o.residenceCity === v },
      { key: 'state', label: 'الحساب', options: [['', 'الكل'], ['incomplete', 'غير مكتمل'], ['unverified', 'بريد غير موثّق'], ['open', 'له طلبات مفتوحة'], ['suspended', 'موقوف']],
        test: (o, v) => (v === 'incomplete' ? o.completion < 100 : v === 'unverified' ? !o.emailVerified : v === 'open' ? o.openRequests > 0 : !o.active) },
    ],
  })
  const list = useMemo(() => [...tf.list].sort((a, b) => sort === 'names' ? b.names.length - a.names.length || b.totalValue - a.totalValue
    : sort === 'value' ? b.totalValue - a.totalValue : sort === 'name' ? a.fullName.localeCompare(b.fullName, 'ar') : b.createdAt.localeCompare(a.createdAt)), [tf.list, sort])
  const all = data ?? []
  const filterText = [tf.query && `بحث: ${tf.query}`, ...tf.filters.filter((f) => tf.values[f.key]).map((f) => `${f.label}: ${f.options.find(([k]) => k === tf.values[f.key])?.[1]}`)].filter(Boolean).join(' · ')

  async function report(kind: 'print' | 'csv') {
    try { await api.logOwnersReport(kind, list.length, filterText || undefined) } catch (e) { toast((e as Error).message, 'bad'); return }
    if (kind === 'print') printReport({ title: 'تقرير العملاء (ملاك الإبل) وشعاراتهم', subtitle: `${num(list.length)} عميل${filterText ? ` · ${filterText}` : ''}`, by: user?.fullName, el: ref.current, landscape: true })
    else downloadCsv(`العملاء-${new Date().toISOString().slice(0, 10)}.csv`, [
      ['رقم الهوية', 'الاسم', 'الجنسية', 'مدينة الإقامة', 'رقم الجوال', 'رقم آخر', 'البريد', ...NAME_TYPES.map((t) => `شعارات ${TYPE_LABEL[t]}`), 'عدد الشعارات', 'قيمة الشعارات', 'الطلبات', 'اكتمال الحساب', 'التسجيل'],
      ...list.map((o) => [o.nationalId ?? '', o.fullName, countryName(o.nationality), o.residenceCity ?? '', o.phone, o.altPhone ?? '', o.email,
        ...NAME_TYPES.map((t) => byType(o, t).map((n) => n.name).join('، ')), o.names.length, o.totalValue, o.requests, `${o.completion}%`, date(o.createdAt)]),
    ])
  }

  return (
    <>
      <PageHead title="بيانات العملاء" sub={full ? 'ملاك الإبل وشعاراتهم حسب الفئة. الطباعة والتصدير تُسجَّل باسمك في سجل التغييرات.' : 'رقم الهوية والجوال يظهران مخفيين جزئيًا؛ إظهارهما كاملين والطباعة بصلاحية «البيانات الكاملة».'}
        action={full && <div className="flex gap-2"><button className="btn-ghost" onClick={() => report('csv')}>تصدير Excel</button><button className="btn-primary" onClick={() => report('print')}><Icon name="file" className="h-4 w-4" />طباعة التقرير</button></div>} />
      {error && <ErrorBox text={error} />}
      {loading && !data ? <Loading /> : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatTile icon="users" tone="pine" label="العملاء" value={num(all.length)} />
            {NAME_TYPES.map((t) => <StatTile key={t} icon="tag" tone={t === 'qaadan' ? 'blue' : t === 'bakkar' ? 'green' : 'gold'} label={`شعارات ${TYPE_LABEL[t]}`} value={num(all.reduce((s, o) => s + byType(o, t).length, 0))} />)}
            <StatTile icon="coins" tone="gold" label="قيمة الشعارات" value={sar(all.reduce((s, o) => s + o.totalValue, 0))} />
          </div>
          <TableTools t={tf} placeholder="بحث بالاسم أو الهوية أو الجوال أو الشعار">
            <select className="field w-auto py-2 text-[14px]" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="الترتيب">
              <option value="names">الأكثر شعارات</option><option value="value">الأعلى قيمة</option><option value="recent">الأحدث تسجيلًا</option><option value="name">الاسم أبجديًا</option>
            </select>
          </TableTools>
          {all.length ? (
            <div ref={ref} className="panel overflow-x-auto">
              <table className="tbl">
                <thead><tr>
                  <th>رقم الهوية</th><th>الاسم</th><th>الجنسية</th><th>رقم الاتصال</th>
                  {NAME_TYPES.map((t) => <th key={t}>{TYPE_LABEL[t]}</th>)}
                  <th>الإجمالي</th><th>القيمة</th><th className="no-print"></th>
                </tr></thead>
                <tbody>
                  {!list.length && <NoResults cols={8 + NAME_TYPES.length} onReset={tf.reset} />}
                  {list.map((o) => (
                    <tr key={o.id} className={o.active ? '' : 'opacity-60'}>
                      <td className="num whitespace-nowrap" dir="ltr" style={{ textAlign: 'right' }}>{o.nationalId || '—'}</td>
                      <td className="font-semibold">{o.fullName}{!o.active && <span className="pill ms-1 bg-bad/10 text-bad">موقوف</span>}<span className="block text-[12px] font-normal text-muted">{o.residenceCity ?? ''}{o.completion < 100 ? ` · مكتمل ${o.completion}%` : ''}</span></td>
                      <td className="whitespace-nowrap">{countryName(o.nationality) || '—'}</td>
                      <td className="num whitespace-nowrap" dir="ltr" style={{ textAlign: 'right' }}>{o.phone}</td>
                      {NAME_TYPES.map((t) => {
                        const ns = byType(o, t)
                        return <td key={t} className="min-w-[7rem] text-[13.5px]">{ns.length ? <><b className="num">{num(ns.length)}</b> <span className="text-muted">·</span> {ns.map((n) => n.name).join('، ')}</> : <span className="text-muted">—</span>}</td>
                      })}
                      <td className="num font-bold">{num(o.names.length)}</td>
                      <td className="num whitespace-nowrap">{o.totalValue ? sar(o.totalValue) : '—'}</td>
                      <td className="no-print"><button className="btn-ghost btn-sm" onClick={() => setView(o)}>الملف</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <Empty title="لا يوجد عملاء بعد" />}
        </>
      )}
      <Modal open={!!view} onClose={() => setView(null)} title={view?.fullName ?? ''} wide>
        {view && (
          <div className="space-y-5">
            <dl className="grid gap-x-6 gap-y-2 text-[14.5px] sm:grid-cols-2">
              {([['رقم الهوية', view.nationalId], ['الجنسية', countryName(view.nationality)], ['الإقامة', [view.residenceCity, countryName(view.residenceCountry)].filter(Boolean).join('، ')],
                ['الجوال', view.phone], ['رقم آخر', view.altPhone], ['البريد', `${view.email}${view.emailVerified ? ' ✓' : ' (غير موثّق)'}`], ['التسجيل', date(view.createdAt)],
                ['آخر دخول', view.lastLoginAt ? date(view.lastLoginAt) : undefined], ['اكتمال الحساب', `${view.completion}%`], ['الطلبات', `${num(view.requests)}${view.openRequests ? ` (${num(view.openRequests)} مفتوح)` : ''}`]] as [string, string | undefined][]).map(([l, v]) => (
                <div key={l} className="flex justify-between gap-3 border-b border-line/60 pb-1.5"><dt className="text-muted">{l}</dt><dd className="num font-semibold" dir="auto">{v || '—'}</dd></div>
              ))}
            </dl>
            {NAME_TYPES.map((t) => {
              const ns = byType(view, t)
              if (!ns.length) return null
              return (
                <div key={t}>
                  <h3 className="mb-2 text-[15px] font-bold">{TYPE_LABEL[t]} <span className="num text-muted">({num(ns.length)})</span></h3>
                  <table className="tbl"><thead><tr><th>الشعار</th><th>السعر</th><th>التاريخ</th><th>الشهادة</th></tr></thead>
                    <tbody>{ns.map((n) => <tr key={n.id}><td className="font-extrabold">{n.name}</td><td className="num">{sar(n.price)}</td><td>{date(n.acquiredAt)}</td><td className="num text-muted">{n.certCode}</td></tr>)}</tbody>
                  </table>
                </div>
              )
            })}
            {!view.names.length && <p className="text-muted">لا يملك شعارات بعد.</p>}
          </div>
        )}
      </Modal>
    </>
  )
}
