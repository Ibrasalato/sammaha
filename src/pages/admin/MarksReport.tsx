import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon, StatTile } from '../../components/dash'
import { Empty, ErrorBox, Loading, PageHead, Segmented, TypeBadge } from '../../components/ui'
import { NoResults, TableTools, useTableFilter } from '../../components/TableTools'
import { TYPE_LABEL, typeOptions } from '../../lib/config'
import { date, num, sar } from '../../lib/format'
import { downloadCsv, printReport } from '../../lib/print'
import { api, useApp, useLoad } from '../../lib/store'
import type { MarkRow, NameType } from '../../lib/types'

const STATUS: Record<MarkRow['status'], [string, string]> = {
  sold: ['مُرسى', 'bg-[#E2F0E8] text-ok'], live: ['جارٍ', 'bg-info-soft text-info-deep'], scheduled: ['قادم', 'bg-gold-soft text-gold-deep'],
  paused: ['متوقف مؤقتًا', 'bg-info-soft text-info-deep'], settling: ['جارٍ الترسية', 'bg-stone-deep text-muted'], cancelled: ['ملغى', 'bg-bad/10 text-bad'],
}
const KIND: Record<MarkRow['kind'], string> = { request: 'طلب شعار', investment: 'استثمار الاسم', resale: 'إعادة بيع' }

export function AdminMarksReport() {
  const { user } = useApp()
  const [state, setState] = useState('sold')
  const [type, setType] = useState<NameType | 'all'>('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const { data, loading, error } = useLoad(() => api.marksReport({ type, state, from: from ? new Date(from).toISOString() : undefined, to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined }), [type, state, from, to])
  const ref = useRef<HTMLDivElement>(null)
  const tf = useTableFilter(data, {
    fields: (r) => [r.number, r.name, r.requestNumber, r.listingNumber, r.ownerName, r.winnerName, r.invoiceNumber],
    filters: [
      { key: 'kind', label: 'المصدر', options: [['', 'الكل'], ['request', 'طلب شعار'], ['investment', 'استثمار الاسم'], ['resale', 'إعادة بيع']], test: (r, v) => r.kind === v },
      { key: 'winner', label: 'الفائز', options: [['', 'الكل'], ['requester', 'مقدم الطلب'], ['bidder', 'مزايد آخر']], test: (r, v) => r.status === 'sold' && (v === 'requester') === !!r.wonByRequester },
      { key: 'inv', label: 'الفاتورة', options: [['', 'الكل'], ['paid', 'مدفوعة'], ['unpaid', 'غير مدفوعة']], test: (r, v) => r.invoiceStatus === v },
    ],
  })
  const list = tf.list
  const sold = list.filter((r) => r.status === 'sold')
  const total = sold.reduce((s, r) => s + r.price, 0)
  const top = useMemo(() => [...sold].sort((a, b) => b.price - a.price)[0], [sold])
  const stateLabel = { sold: 'المُرساة', live: 'الجارية', scheduled: 'القادمة', paused: 'المتوقفة', cancelled: 'الملغاة', all: 'كل المزادات' }[state] ?? state
  const subtitle = `${stateLabel} · ${type === 'all' ? 'كل الفئات' : TYPE_LABEL[type]}${from || to ? ` · من ${from || '…'} إلى ${to || '…'}` : ''} · ${num(list.length)} مزاد · إجمالي الإرساء ${sar(total)}`

  return (
    <>
      <PageHead title="تقرير الشعارات" sub="كل مزاد برقمه التسلسلي: الطلب والمالك والفائز وقيمة الفوز والفاتورة والشهادة."
        action={<div className="flex gap-2">
          <button className="btn-ghost" onClick={() => downloadCsv(`تقرير-الشعارات-${new Date().toISOString().slice(0, 10)}.csv`, [
            ['رقم المزاد', 'الشعار', 'الفئة', 'المصدر', 'رقم الطلب', 'المالك', 'الحالة', 'البداية', 'النهاية', 'السعر الافتتاحي', 'قيمة الفوز', 'المزايدات', 'المزايدون', 'الفائز', 'الفاتورة', 'حالة الفاتورة', 'الضريبة', 'الشهادة', 'التمديدات'],
            ...list.map((r) => [r.number, r.name, TYPE_LABEL[r.type], KIND[r.kind], r.requestNumber ?? r.listingNumber ?? '', r.ownerName, STATUS[r.status][0], date(r.startsAt), date(r.endsAt), r.openingPrice, r.price, r.bidCount, r.bidders,
              r.winnerName ? `${r.winnerName}${r.wonByRequester ? ' (مقدم الطلب)' : ''}` : '', r.invoiceNumber ?? '', r.invoiceStatus === 'paid' ? 'مدفوعة' : r.invoiceStatus === 'unpaid' ? 'غير مدفوعة' : '', r.vat ?? '', r.certCode ?? '', r.extensions]),
          ])}>تصدير Excel</button>
          <button className="btn-primary" onClick={() => printReport({ title: 'تقرير الشعارات', subtitle, by: user?.fullName, el: ref.current, landscape: true })}><Icon name="file" className="h-4 w-4" />طباعة التقرير</button>
        </div>} />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Segmented value={state} onChange={setState} options={[['sold', 'المُرساة'], ['live', 'جارية'], ['scheduled', 'قادمة'], ['paused', 'متوقفة'], ['cancelled', 'ملغاة'], ['all', 'الكل']]} />
        <Segmented value={type} onChange={setType} options={typeOptions('all', 'الكل')} />
        <label className="text-sm">من<input type="date" className="field mt-1 w-auto py-1.5" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="text-sm">إلى<input type="date" className="field mt-1 w-auto py-1.5" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      </div>
      {error && <ErrorBox text={error} />}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon="gavel" tone="pine" label="المزادات" value={num(list.length)} />
        <StatTile icon="check" tone="green" label="المُرساة" value={num(sold.length)} />
        <StatTile icon="coins" tone="gold" label="إجمالي قيمة الفوز" value={sar(total)} />
        <StatTile icon="trophy" tone="blue" label="أعلى قيمة" value={top ? sar(top.price) : '—'} />
      </div>
      <TableTools t={tf} placeholder="بحث برقم المزاد أو الشعار أو الطلب أو المالك أو الفائز" />
      {loading && !data ? <Loading /> : data?.length ? (
        <div ref={ref} className="panel overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>رقم المزاد</th><th>الشعار</th><th>رقم الطلب</th><th>المالك</th><th>الحالة</th><th>التاريخ</th><th>الافتتاحي</th><th>قيمة الفوز</th><th>المزايدات</th><th>الفائز</th><th>الفاتورة</th><th>الشهادة</th></tr></thead>
            <tbody>
              {!list.length && <NoResults cols={12} onReset={tf.reset} />}
              {list.map((r) => (
                <tr key={r.auctionId}>
                  <td className="num whitespace-nowrap font-semibold"><Link to={`/auctions/${r.auctionId}`} className="hover:underline">{r.number}</Link></td>
                  <td><span className="flex items-center gap-1.5 font-extrabold"><TypeBadge type={r.type} />{r.name}</span><span className="text-[12px] text-muted">{KIND[r.kind]}</span></td>
                  <td className="num whitespace-nowrap">{r.requestNumber ?? r.listingNumber ?? '—'}</td>
                  <td>{r.ownerName}</td>
                  <td><span className={`pill ${STATUS[r.status][1]}`}>{STATUS[r.status][0]}</span></td>
                  <td className="whitespace-nowrap text-[13px]">{date(r.endsAt)}</td>
                  <td className="num whitespace-nowrap text-muted">{sar(r.openingPrice)}</td>
                  <td className="num whitespace-nowrap font-bold">{r.status === 'cancelled' ? '—' : sar(r.price)}</td>
                  <td className="num">{num(r.bidCount)}<span className="text-[12px] text-muted"> / {num(r.bidders)} مزايد</span></td>
                  <td className="text-[13.5px]">{r.winnerName ? <>{r.winnerName}{r.wonByRequester && <span className="block text-[12px] text-muted">مقدم الطلب</span>}</> : '—'}</td>
                  <td className="num whitespace-nowrap text-[13px]">{r.invoiceNumber ? <>{r.invoiceNumber}<span className={`block ${r.invoiceStatus === 'paid' ? 'text-ok' : 'text-gold-deep'}`}>{r.invoiceStatus === 'paid' ? 'مدفوعة' : 'غير مدفوعة'}</span></> : '—'}</td>
                  <td className="num text-[12.5px] text-muted">{r.certCode ?? '—'}</td>
                </tr>
              ))}
            </tbody>
            {sold.length > 0 && <tfoot><tr className="bg-stone font-bold"><td colSpan={7}>الإجمالي ({num(sold.length)} مُرسى)</td><td className="num whitespace-nowrap">{sar(total)}</td><td colSpan={4}></td></tr></tfoot>}
          </table>
        </div>
      ) : <Empty title="لا توجد مزادات بهذه التصفية" />}
    </>
  )
}
