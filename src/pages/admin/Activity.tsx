import { useRef, useState } from 'react'
import { Icon } from '../../components/dash'
import { ErrorBox, Loading } from '../../components/ui'
import { usePrint } from '../../components/usePrint'
import { num } from '../../lib/format'
import { downloadCsv } from '../../lib/print'
import { api, useLoad } from '../../lib/store'
import { tr } from '../../lib/i18n'
import type { ActivityEntry, ActivityFilter } from '../../lib/types'
import { localizeActivityPage } from '../../lib/serverText'

const ROLE: Record<string, string> = { get 'admin'() { return tr('مدير النظام', 'System administrator') }, get 'committee'() { return tr('موظف', 'Staff') }, get 'owner'() { return tr('مالك', 'Owner') }, get 'delegate'() { return tr('مفوض', 'Delegate') }, get ''() { return tr('زائر', 'Visitor') } }
/** date and time to the second, Riyadh time */
/** Riyadh time as plain digits, so no bidi marks can scramble the order */
const parts = (iso: string) => { const r = new Date(Date.parse(iso) + 3 * 3600_000).toISOString(); return [r.slice(0, 10), r.slice(11, 19)] as const }
const stamp = (iso: string) => parts(iso).join(' ')

/** field names in the log are code names: show them in Arabic, and values in a readable form */
const FIELD: Record<string, string> = {
  get 'fullname'() { return tr('الاسم', 'Name') },
  get 'nationalid'() { return tr('الهوية', 'ID') },
  get 'phonecountry'() { return tr('مفتاح الدولة', 'Country code') },
  get 'phone'() { return tr('الجوال', 'Mobile') },
  get 'email'() { return tr('البريد', 'Email') },
  get 'capacity'() { return tr('الصفة', 'Capacity') },
  get 'capacitynote'() { return tr('وصف الصفة', 'Capacity details') },
  get 'scopes'() { return tr('الصلاحيات', 'Permissions') },
  get 'permanent'() { return tr('دائم', 'Permanent') },
  get 'startsat'() { return tr('من', 'From') },
  get 'endsat'() { return tr('إلى', 'To') },
  get 'amount'() { return tr('المبلغ', 'Amount') },
  get 'method'() { return tr('طريقة الدفع', 'Payment method') },
  get 'name'() { return tr('الاسم', 'Name') },
  get 'names'() { return tr('الأسماء', 'Names') },
  get 'reason'() { return tr('السبب', 'Reason') },
  get 'note'() { return tr('ملاحظة', 'Note') },
  get 'status'() { return tr('الحالة', 'Status') },
  get 'subject'() { return tr('الموضوع', 'Subject') },
  get 'message'() { return tr('الرسالة', 'Message') },
  get 'topic'() { return tr('الموضوع', 'Topic') },
  get 'kind'() { return tr('النوع', 'Type') },
  get 'price'() { return tr('السعر', 'Price') },
  get 'maxamount'() { return tr('الحد الأعلى', 'Maximum') },
  get 'category'() { return tr('الفئة', 'Category') },
  get 'login'() { return tr('المعرّف', 'Login') },
  get 'role'() { return tr('الدور', 'Role') },
  get 'permissions'() { return tr('الصلاحيات', 'Permissions') },
  get 'id'() { return tr('المعرّف', 'ID') },
  get 'auctionid'() { return tr('المزاد', 'Auction') },
  get 'requestid'() { return tr('الطلب', 'Request') },
  get 'delegationid'() { return tr('التفويض', 'Delegation') },
  get 'startprice'() { return tr('سعر البداية', 'Start price') },
  get 'staggerminutes'() { return tr('الفاصل بالدقائق', 'Interval (minutes)') },
  get 'city'() { return tr('المدينة', 'City') },
  get 'title'() { return tr('العنوان', 'Title') },
  get 'description'() { return tr('الوصف', 'Description') },
  get 'reference'() { return tr('المرجع', 'Reference') },
  get 'transferref'() { return tr('رقم الحوالة', 'Transfer reference') },
}
const ISO = /^\d{4}-\d{2}-\d{2}T(\d{2}:\d{2})/
export function prettyDetails(d?: string) {
  if (!d) return ''
  return d.split(' · ').map((part) => {
    const i = part.indexOf(': ')
    if (i < 0) return part
    const k = part.slice(0, i), v = part.slice(i + 2)
    const label = FIELD[k.toLowerCase()] ?? (/^[أبجد]$/.test(k) ? '' : k)
    const value = v === 'true' || v === 'True' ? tr('نعم', 'Yes') : v === 'false' || v === 'False' ? tr('لا', 'No') : ISO.test(v) ? v.slice(0, 10) : v
    return label ? `${label}: ${value}` : value
  }).join(' · ')
}

function Who({ a }: { a: ActivityEntry }) {
  return (
    <span className="block min-w-[9rem]">
      <b className="font-semibold">{a.actorName || '—'}</b>
      <span className="block text-[12px] text-muted">{ROLE[a.actorRole] ?? a.actorRole}{a.onBehalfOfName ? ` ${tr('عن', 'for')} ${a.onBehalfOfName}` : ''}</span>
    </span>
  )
}

const WHO: Record<string, string> = { get 'me'() { return tr('إجراءاتي', 'My actions') }, get 'delegates'() { return tr('إجراءات المفوضين على حسابي', 'Delegates’ actions on my account') }, get 'as_delegate'() { return tr('إجراءاتي كمفوض على حسابات أخرى', 'My actions as a delegate on other accounts') } }

/** every action on the platform with its date and time (logs.view); with `owner`, the owner's own account only */
export function ActivityPanel({ owner = false }: { owner?: boolean }) {
  const print = usePrint()
  const ref = useRef<HTMLDivElement>(null)
  const size = owner ? 50 : 100
  const [f, setF] = useState<ActivityFilter>({ page: 1, size })
  const [q, setQ] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const filter: ActivityFilter = { ...f, q: f.q, from: from ? new Date(`${from}T00:00:00+03:00`).toISOString() : undefined, to: to ? new Date(`${to}T23:59:59+03:00`).toISOString() : undefined }
  const { data, loading, error, reload } = useLoad(() => (owner ? api.myActivity(filter) : api.activity(filter)).then(localizeActivityPage), [JSON.stringify(filter)], 30000)
  const set = (p: Partial<ActivityFilter>) => setF((x) => ({ ...x, ...p, page: p.page ?? 1 }))
  const pages = data ? Math.max(1, Math.ceil(data.total / size)) : 1
  const items = data?.items ?? []
  const subtitle = [from && `${tr('من', 'From')} ${from}`, to && `${tr('إلى', 'To')} ${to}`, f.category && data?.categories.find((c) => c.key === f.category)?.value, f.role && (f.role === 'staff' ? tr('الموظفون', 'Staff') : ROLE[f.role]), f.who && WHO[f.who], f.failed && tr('المحاولات الفاشلة فقط', 'Failed attempts only'), f.q && `${tr('بحث', 'Search')}: ${f.q}`].filter(Boolean).join(' · ')

  return (
    <section className="panel overflow-hidden">
      <header className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-pine-soft text-pine"><Icon name="history" className="h-[18px] w-[18px]" /></span>
        <div className="min-w-[14rem] flex-1">
          <h2 className="text-[17px]">{tr('سجل النشاط', 'Activity log')}</h2>
          <p className="text-[13.5px] text-muted">{owner ? tr('كل ما جرى على حسابك بالتاريخ والوقت (بتوقيت الرياض): دخولك وطلباتك ومزايداتك ومدفوعاتك، وما أجراه المفوضون على حسابك، وما أجريته أنت مفوضًا عن غيرك.', 'Everything on your account with date and time (Riyadh time): your sign-ins, requests, bids and payments, actions by delegates on your account, and actions you took as a delegate for others.') : <>{tr('كل ما يجري على المنصة بالتاريخ والوقت (بتوقيت الرياض): الدخول والطلبات والمزايدات والمدفوعات وإجراءات الموظفين والمفوضين، والمحاولات الفاشلة.', 'Everything on the platform with date and time (Riyadh time): sign-ins, requests, bids, payments, actions by staff and delegates, and failed attempts.')}</>}</p>
        </div>
        <button className="btn-ghost btn-sm" onClick={() => downloadCsv(`${tr('سجل-النشاط', 'activity-log')}-${new Date().toISOString().slice(0, 10)}.csv`, [
          [tr('التاريخ والوقت', 'Date and time'), tr('المستخدم', 'User'), tr('الصفة', 'Capacity'), tr('نيابة عن', 'On behalf of'), tr('الإجراء', 'Action'), tr('القسم', 'Section'), tr('التفاصيل', 'Details'), tr('النتيجة', 'Result'), 'IP', tr('الجهاز', 'Device')],
          ...items.map((a) => [stamp(a.at), a.actorName, ROLE[a.actorRole] ?? a.actorRole, a.onBehalfOfName ?? '', a.action, a.categoryLabel, prettyDetails(a.details), a.success ? tr('تم', 'Done') : `${tr('فشل', 'Failed')}: ${a.error ?? ''}`, a.ip ?? '', a.device ?? '']),
        ])}>{tr('تصدير Excel', 'Export to Excel')}</button>
        <button className="btn-primary btn-sm" onClick={() => print({ title: owner ? tr('سجل نشاط الحساب', 'Account activity log') : tr('سجل النشاط', 'Activity log'), subtitle: subtitle || tr('كل النشاط', 'All activity'), el: ref.current, landscape: true })}><Icon name="file" className="h-4 w-4" />{tr('طباعة', 'Print')}</button>
      </header>

      <div className="flex flex-wrap items-end gap-2.5 border-b border-line bg-stone/40 px-5 py-3">
        <form className="relative w-full sm:w-64" onSubmit={(e) => { e.preventDefault(); set({ q: q.trim() || undefined }) }}>
          <input className="field py-2 text-[14px]" placeholder={owner ? tr('بحث بالإجراء أو التفاصيل أو IP', 'Search by action, details or IP') : tr('بحث بالاسم أو الإجراء أو التفاصيل أو IP', 'Search by name, action, details or IP')} value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => set({ q: q.trim() || undefined })} />
        </form>
        <select className="field w-auto py-2 text-[14px]" value={f.category ?? ''} onChange={(e) => set({ category: e.target.value || undefined })} aria-label={tr('القسم', 'Section')}>
          <option value="">{tr('كل الأقسام', 'All sections')}</option>
          {data?.categories.map((c) => <option key={c.key} value={c.key}>{c.value}</option>)}
        </select>
        {owner ? (
          <select className="field w-auto py-2 text-[14px]" value={f.who ?? ''} onChange={(e) => set({ who: (e.target.value || undefined) as ActivityFilter['who'] })} aria-label={tr('من', 'Who')}>
            <option value="">{tr('كل النشاط', 'All activity')}</option>{Object.entries(WHO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        ) : (
          <select className="field w-auto py-2 text-[14px]" value={f.role ?? ''} onChange={(e) => set({ role: e.target.value || undefined })} aria-label={tr('المستخدم', 'User')}>
            <option value="">{tr('كل المستخدمين', 'All users')}</option><option value="staff">{tr('الموظفون', 'Staff')}</option><option value="owner">{tr('الملاك', 'Owners')}</option><option value="delegate">{tr('المفوضون', 'Delegates')}</option>
          </select>
        )}
        <label className="text-[13px]">{tr('من', 'From')}<input type="date" className="field mt-0.5 w-auto py-1.5" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="text-[13px]">{tr('إلى', 'To')}<input type="date" className="field mt-0.5 w-auto py-1.5" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <label className="flex items-center gap-1.5 pb-2 text-[13.5px]"><input type="checkbox" checked={!!f.failed} onChange={(e) => set({ failed: e.target.checked || undefined })} />{tr('المحاولات الفاشلة فقط', 'Failed attempts only')}</label>
        <button className="pb-2 text-[13px] text-muted underline" onClick={() => { setF({ page: 1, size }); setQ(''); setFrom(''); setTo('') }}>{tr('مسح', 'Clear')}</button>
        <span className="ms-auto pb-2 text-[13px] text-muted">{data ? `${num(data.total)} ${tr('سجل', 'records')}` : ''}</span>
      </div>

      {error ? <div className="p-5"><ErrorBox text={error} /></div> : loading && !data ? <Loading /> : items.length ? (
        <div ref={ref} className="overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>{tr('التاريخ والوقت', 'Date and time')}</th><th>{tr('المستخدم', 'User')}</th><th>{tr('الإجراء', 'Action')}</th><th>{tr('التفاصيل', 'Details')}</th><th>{tr('النتيجة', 'Result')}</th><th>{tr('IP والجهاز', 'IP and device')}</th></tr></thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id} className={a.success ? '' : 'bg-bad/5'}>
                  <td className="num whitespace-nowrap text-[13px]"><span dir="ltr" className="block">{parts(a.at)[0]}</span><span dir="ltr" className="block font-bold text-pine">{parts(a.at)[1]}</span></td>
                  <td><Who a={a} /></td>
                  <td><b className="block whitespace-nowrap text-[14px]">{a.action}</b><span className="pill mt-0.5 bg-stone text-[11.5px] text-muted">{a.categoryLabel}</span></td>
                  <td className="max-w-[22rem] text-[12.5px] leading-5 text-muted" style={{ wordBreak: 'break-word' }}>{prettyDetails(a.details) || '—'}</td>
                  <td className="text-[13px]">{a.success ? <span className="text-ok">✓ {tr('تم', 'Done')}</span> : <span className="text-bad">✗ {a.error ?? tr('فشل', 'Failed')}</span>}</td>
                  <td className="whitespace-nowrap text-[12.5px] text-muted"><span className="num block" dir="ltr" style={{ textAlign: 'right' }}>{a.ip ?? '—'}</span>{a.device}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="px-5 py-10 text-center text-muted">{tr('لا يوجد نشاط بهذه التصفية.', 'No activity matches these filters.')}</p>}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 border-t border-line px-5 py-3 text-[14px]">
          <button className="btn-ghost btn-sm" disabled={(f.page ?? 1) <= 1} onClick={() => setF((x) => ({ ...x, page: (x.page ?? 1) - 1 }))}>{tr('السابق', 'Previous')}</button>
          <span className="num">{tr('صفحة', 'Page')} {num(f.page ?? 1)} {tr('من', 'of')} {num(pages)}</span>
          <button className="btn-ghost btn-sm" disabled={(f.page ?? 1) >= pages} onClick={() => setF((x) => ({ ...x, page: (x.page ?? 1) + 1 }))}>{tr('التالي', 'Next')}</button>
          <button className="text-[13px] text-muted underline" onClick={() => reload()}>{tr('تحديث', 'Refresh')}</button>
        </div>
      )}
    </section>
  )
}
