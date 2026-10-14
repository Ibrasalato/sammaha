import { useMemo, useRef, useState } from 'react'
import { Icon, StatTile } from '../../components/dash'
import { Empty, ErrorBox, Loading, Modal, PageHead } from '../../components/ui'
import { NoResults, TableTools, useTableFilter } from '../../components/TableTools'
import { NAME_TYPES, TYPE_LABEL } from '../../lib/config'
import { countryName } from '../../lib/countries'
import { date, num, sar } from '../../lib/format'
import { can } from '../../lib/permissions'
import { downloadCsv } from '../../lib/print'
import { usePrint } from '../../components/usePrint'
import { api, useApp, useLoad } from '../../lib/store'
import type { NameType, OwnerCrm } from '../../lib/types'
import { tr } from '../../lib/i18n'

type Sort = 'recent' | 'names' | 'value' | 'name'
const byType = (o: OwnerCrm, t: NameType) => o.names.filter((n) => n.type === t)

export function AdminCustomers() {
  const print = usePrint()
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
      { key: 'type', label: tr('الفئة', 'Category'), options: [['', tr('كل الفئات', 'All categories')], ...NAME_TYPES.map((t) => [t, tr(`يملك ${TYPE_LABEL[t]}`, `Owns ${TYPE_LABEL[t]}`)] as [string, string]), ['none', tr('بلا شعارات', 'No marks')]], test: (o, v) => (v === 'none' ? !o.names.length : o.names.some((n) => n.type === v)) },
      { key: 'nat', label: tr('الجنسية', 'Nationality'), options: [['', tr('الكل', 'All')], ...nationalities.map((c) => [c, countryName(c)] as [string, string])], test: (o, v) => o.nationality === v },
      { key: 'city', label: tr('المدينة', 'City'), options: [['', tr('الكل', 'All')], ...cities.map((c) => [c, c] as [string, string])], test: (o, v) => o.residenceCity === v },
      { key: 'state', label: tr('الحساب', 'Account'), options: [['', tr('الكل', 'All')], ['incomplete', tr('غير مكتمل', 'Incomplete')], ['unverified', tr('بريد غير موثّق', 'Unverified email')], ['open', tr('له طلبات مفتوحة', 'Has open requests')], ['suspended', tr('موقوف', 'Suspended')]],
        test: (o, v) => (v === 'incomplete' ? o.completion < 100 : v === 'unverified' ? !o.emailVerified : v === 'open' ? o.openRequests > 0 : !o.active) },
    ],
  })
  const list = useMemo(() => [...tf.list].sort((a, b) => sort === 'names' ? b.names.length - a.names.length || b.totalValue - a.totalValue
    : sort === 'value' ? b.totalValue - a.totalValue : sort === 'name' ? a.fullName.localeCompare(b.fullName, 'ar') : b.createdAt.localeCompare(a.createdAt)), [tf.list, sort])
  const all = data ?? []
  const filterText = [tf.query && tr(`بحث: ${tf.query}`, `Search: ${tf.query}`), ...tf.filters.filter((f) => tf.values[f.key]).map((f) => `${f.label}: ${f.options.find(([k]) => k === tf.values[f.key])?.[1]}`)].filter(Boolean).join(' · ')

  async function report(kind: 'print' | 'csv') {
    try { await api.logOwnersReport(kind, list.length, filterText || undefined) } catch (e) { toast((e as Error).message, 'bad'); return }
    if (kind === 'print') print({ title: tr('تقرير العملاء (ملاك الإبل) وشعاراتهم', 'Customers (camel owners) and their marks'), subtitle: `${num(list.length)} ${tr('عميل', 'customers')}${filterText ? ` · ${filterText}` : ''}`, el: ref.current, landscape: true })
    else downloadCsv(`${tr('العملاء', 'customers')}-${new Date().toISOString().slice(0, 10)}.csv`, [
      [tr('رقم الهوية', 'ID number'), tr('الاسم', 'Name'), tr('الجنسية', 'Nationality'), tr('مدينة الإقامة', 'City of residence'), tr('رقم الجوال', 'Mobile'), tr('رقم آخر', 'Alternate number'), tr('البريد', 'Email'), ...NAME_TYPES.map((t) => tr(`شعارات ${TYPE_LABEL[t]}`, `${TYPE_LABEL[t]} marks`)), tr('عدد الشعارات', 'Marks count'), tr('قيمة الشعارات', 'Marks value'), tr('الطلبات', 'Requests'), tr('اكتمال الحساب', 'Account completion'), tr('التسجيل', 'Registered')],
      ...list.map((o) => [o.nationalId ?? '', o.fullName, countryName(o.nationality), o.residenceCity ?? '', o.phone, o.altPhone ?? '', o.email,
        ...NAME_TYPES.map((t) => byType(o, t).map((n) => n.name).join(tr('، ', ', '))), o.names.length, o.totalValue, o.requests, `${o.completion}%`, date(o.createdAt)]),
    ])
  }

  return (
    <>
      <PageHead title={tr('بيانات العملاء', 'Customers (CRM)')} sub={full ? tr('ملاك الإبل وشعاراتهم حسب الفئة. الطباعة والتصدير تُسجَّل باسمك في سجل التغييرات.', 'Camel owners and their marks by category. Printing and exporting are logged under your name in the change log.') : tr('رقم الهوية والجوال يظهران مخفيين جزئيًا؛ إظهارهما كاملين والطباعة بصلاحية «البيانات الكاملة».', 'ID and mobile numbers are partially masked; showing them in full and printing require the "Full data" permission.')}
        action={full && <div className="flex gap-2"><button className="btn-ghost" onClick={() => report('csv')}>{tr('تصدير Excel', 'Export to Excel')}</button><button className="btn-primary" onClick={() => report('print')}><Icon name="file" className="h-4 w-4" />{tr('طباعة التقرير', 'Print report')}</button></div>} />
      {error && <ErrorBox text={error} />}
      {loading && !data ? <Loading /> : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatTile icon="users" tone="pine" label={tr('العملاء', 'Customers')} value={num(all.length)} />
            {NAME_TYPES.map((t) => <StatTile key={t} icon="tag" tone={t === 'qaadan' ? 'blue' : t === 'bakkar' ? 'green' : 'gold'} label={tr(`شعارات ${TYPE_LABEL[t]}`, `${TYPE_LABEL[t]} marks`)} value={num(all.reduce((s, o) => s + byType(o, t).length, 0))} />)}
            <StatTile icon="coins" tone="gold" label={tr('قيمة الشعارات', 'Marks value')} value={sar(all.reduce((s, o) => s + o.totalValue, 0))} />
          </div>
          <TableTools t={tf} placeholder={tr('بحث بالاسم أو الهوية أو الجوال أو الشعار', 'Search by name, ID, mobile or mark')}>
            <select className="field w-auto py-2 text-[14px]" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label={tr('الترتيب', 'Sort')}>
              <option value="names">{tr('الأكثر شعارات', 'Most marks')}</option><option value="value">{tr('الأعلى قيمة', 'Highest value')}</option><option value="recent">{tr('الأحدث تسجيلًا', 'Newest registered')}</option><option value="name">{tr('الاسم أبجديًا', 'Name (A–Z)')}</option>
            </select>
          </TableTools>
          {all.length ? (
            <div ref={ref} className="panel overflow-x-auto">
              <table className="tbl">
                <thead><tr>
                  <th>{tr('رقم الهوية', 'ID number')}</th><th>{tr('الاسم', 'Name')}</th><th>{tr('الجنسية', 'Nationality')}</th><th>{tr('رقم الاتصال', 'Contact number')}</th>
                  {NAME_TYPES.map((t) => <th key={t}>{TYPE_LABEL[t]}</th>)}
                  <th>{tr('الإجمالي', 'Total')}</th><th>{tr('القيمة', 'Value')}</th><th className="no-print"></th>
                </tr></thead>
                <tbody>
                  {!list.length && <NoResults cols={8 + NAME_TYPES.length} onReset={tf.reset} />}
                  {list.map((o) => (
                    <tr key={o.id} className={o.active ? '' : 'opacity-60'}>
                      <td className="num whitespace-nowrap" dir="ltr" style={{ textAlign: 'right' }}>{o.nationalId || '—'}</td>
                      <td className="font-semibold">{o.fullName}{!o.active && <span className="pill ms-1 bg-bad/10 text-bad">{tr('موقوف', 'Suspended')}</span>}<span className="block text-[12px] font-normal text-muted">{o.residenceCity ?? ''}{o.completion < 100 ? tr(` · مكتمل ${o.completion}%`, ` · ${o.completion}% complete`) : ''}</span></td>
                      <td className="whitespace-nowrap">{countryName(o.nationality) || '—'}</td>
                      <td className="num whitespace-nowrap" dir="ltr" style={{ textAlign: 'right' }}>{o.phone}</td>
                      {NAME_TYPES.map((t) => {
                        const ns = byType(o, t)
                        return <td key={t} className="min-w-[7rem] text-[13.5px]">{ns.length ? <><b className="num">{num(ns.length)}</b> <span className="text-muted">·</span> {ns.map((n) => n.name).join(tr('، ', ', '))}</> : <span className="text-muted">—</span>}</td>
                      })}
                      <td className="num font-bold">{num(o.names.length)}</td>
                      <td className="num whitespace-nowrap">{o.totalValue ? sar(o.totalValue) : '—'}</td>
                      <td className="no-print"><button className="btn-ghost btn-sm" onClick={() => setView(o)}>{tr('الملف', 'Profile')}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <Empty title={tr('لا يوجد عملاء بعد', 'No customers yet')} />}
        </>
      )}
      <Modal open={!!view} onClose={() => setView(null)} title={view?.fullName ?? ''} wide>
        {view && (
          <div className="space-y-5">
            <dl className="grid gap-x-6 gap-y-2 text-[14.5px] sm:grid-cols-2">
              {([[tr('رقم الهوية', 'ID number'), view.nationalId], [tr('الجنسية', 'Nationality'), countryName(view.nationality)], [tr('الإقامة', 'Residence'), [view.residenceCity, countryName(view.residenceCountry)].filter(Boolean).join(tr('، ', ', '))],
                [tr('الجوال', 'Mobile'), view.phone], [tr('رقم آخر', 'Alternate number'), view.altPhone], [tr('البريد', 'Email'), `${view.email}${view.emailVerified ? ' ✓' : tr(' (غير موثّق)', ' (unverified)')}`], [tr('التسجيل', 'Registered'), date(view.createdAt)],
                [tr('آخر دخول', 'Last login'), view.lastLoginAt ? date(view.lastLoginAt) : undefined], [tr('اكتمال الحساب', 'Account completion'), `${view.completion}%`], [tr('الطلبات', 'Requests'), `${num(view.requests)}${view.openRequests ? ` (${num(view.openRequests)} ${tr('مفتوح', 'open')})` : ''}`]] as [string, string | undefined][]).map(([l, v]) => (
                <div key={l} className="flex justify-between gap-3 border-b border-line/60 pb-1.5"><dt className="text-muted">{l}</dt><dd className="num font-semibold" dir="auto">{v || '—'}</dd></div>
              ))}
            </dl>
            {NAME_TYPES.map((t) => {
              const ns = byType(view, t)
              if (!ns.length) return null
              return (
                <div key={t}>
                  <h3 className="mb-2 text-[15px] font-bold">{TYPE_LABEL[t]} <span className="num text-muted">({num(ns.length)})</span></h3>
                  <table className="tbl"><thead><tr><th>{tr('الشعار', 'Mark')}</th><th>{tr('السعر', 'Price')}</th><th>{tr('التاريخ', 'Date')}</th><th>{tr('الشهادة', 'Certificate')}</th></tr></thead>
                    <tbody>{ns.map((n) => <tr key={n.id}><td className="font-extrabold">{n.name}</td><td className="num">{sar(n.price)}</td><td>{date(n.acquiredAt)}</td><td className="num text-muted">{n.certCode}</td></tr>)}</tbody>
                  </table>
                </div>
              )
            })}
            {!view.names.length && <p className="text-muted">{tr('لا يملك شعارات بعد.', 'No marks owned yet.')}</p>}
          </div>
        )}
      </Modal>
    </>
  )
}
