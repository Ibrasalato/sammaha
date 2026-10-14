import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon, StatTile } from '../../components/dash'
import { OWNER_COLUMNS, OwnerCell, ownerColumns, useOwners } from '../../components/OwnerCell'
import { Empty, ErrorBox, Loading, PageHead, Segmented, TypeBadge } from '../../components/ui'
import { NoResults, TableTools, useTableFilter } from '../../components/TableTools'
import { TYPE_LABEL, typeOptions } from '../../lib/config'
import { date, num, sar } from '../../lib/format'
import { downloadCsv } from '../../lib/print'
import { usePrint } from '../../components/usePrint'
import { api, useLoad } from '../../lib/store'
import type { MarkRow, NameType } from '../../lib/types'
import { tr } from '../../lib/i18n'

const STATUS = (): Record<MarkRow['status'], [string, string]> => ({
  sold: [tr('مُرسى', 'Awarded'), 'bg-[#E2F0E8] text-ok'], live: [tr('جارٍ', 'Live'), 'bg-info-soft text-info-deep'], scheduled: [tr('قادم', 'Upcoming'), 'bg-gold-soft text-gold-deep'],
  paused: [tr('متوقف مؤقتًا', 'Paused'), 'bg-info-soft text-info-deep'], settling: [tr('جارٍ الترسية', 'Awarding'), 'bg-stone-deep text-muted'], cancelled: [tr('ملغى', 'Cancelled'), 'bg-bad/10 text-bad'],
})
const KIND = (): Record<MarkRow['kind'], string> => ({ request: tr('طلب شعار', 'Mark request'), investment: tr('استثمار الاسم', 'Name investment'), resale: tr('إعادة بيع', 'Resale') })

export function AdminMarksReport() {
  const print = usePrint()
  const owners = useOwners()
  const [state, setState] = useState('sold')
  const [type, setType] = useState<NameType | 'all'>('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const { data, loading, error } = useLoad(() => api.marksReport({ type, state, from: from ? new Date(from).toISOString() : undefined, to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined }), [type, state, from, to])
  const ref = useRef<HTMLDivElement>(null)
  const tf = useTableFilter(data, {
    fields: (r) => [r.number, r.name, r.requestNumber, r.listingNumber, r.ownerName, r.winnerName, r.invoiceNumber],
    filters: [
      { key: 'kind', label: tr('المصدر', 'Source'), options: [['', tr('الكل', 'All')], ['request', tr('طلب شعار', 'Mark request')], ['investment', tr('استثمار الاسم', 'Name investment')], ['resale', tr('إعادة بيع', 'Resale')]], test: (r, v) => r.kind === v },
      { key: 'winner', label: tr('الفائز', 'Winner'), options: [['', tr('الكل', 'All')], ['requester', tr('مقدم الطلب', 'Applicant')], ['bidder', tr('مزايد آخر', 'Another bidder')]], test: (r, v) => r.status === 'sold' && (v === 'requester') === !!r.wonByRequester },
      { key: 'inv', label: tr('الفاتورة', 'Invoice'), options: [['', tr('الكل', 'All')], ['paid', tr('مدفوعة', 'Paid')], ['unpaid', tr('غير مدفوعة', 'Unpaid')]], test: (r, v) => r.invoiceStatus === v },
    ],
  })
  const list = tf.list
  const sold = list.filter((r) => r.status === 'sold')
  const total = sold.reduce((s, r) => s + r.price, 0)
  const top = useMemo(() => [...sold].sort((a, b) => b.price - a.price)[0], [sold])
  const stateLabel = { sold: tr('المُرساة', 'Awarded'), live: tr('الجارية', 'Live'), scheduled: tr('القادمة', 'Upcoming'), paused: tr('المتوقفة', 'Paused'), cancelled: tr('الملغاة', 'Cancelled'), all: tr('كل المزادات', 'All auctions') }[state] ?? state
  const subtitle = `${stateLabel} · ${type === 'all' ? tr('كل الفئات', 'All categories') : TYPE_LABEL[type]}${from || to ? tr(` · من ${from || '…'} إلى ${to || '…'}`, ` · from ${from || '…'} to ${to || '…'}`) : ''} · ${num(list.length)} ${tr('مزاد', 'auctions')} · ${tr('إجمالي الإرساء', 'Total awarded')} ${sar(total)}`

  return (
    <>
      <PageHead title={tr('تقرير الشعارات', 'Marks report')} sub={tr('كل مزاد برقمه التسلسلي: الطلب والمالك والفائز وقيمة الفوز والفاتورة والشهادة.', 'Every auction by serial number: request, owner, winner, winning amount, invoice and certificate.')}
        action={<div className="flex gap-2">
          <button className="btn-ghost" onClick={() => downloadCsv(`${tr('تقرير-الشعارات', 'marks-report')}-${new Date().toISOString().slice(0, 10)}.csv`, [
            [tr('رقم المزاد', 'Auction no.'), tr('الشعار', 'Mark'), tr('الفئة', 'Category'), tr('المصدر', 'Source'), tr('رقم الطلب', 'Request no.'), tr('المالك', 'Owner'), ...OWNER_COLUMNS, tr('الحالة', 'Status'), tr('البداية', 'Start'), tr('النهاية', 'End'), tr('السعر الافتتاحي', 'Opening price'), tr('قيمة الفوز', 'Winning amount'), tr('المزايدات', 'Bids'), tr('المزايدون', 'Bidders'), tr('الفائز', 'Winner'), tr('هوية وجنسية وجوال الفائز', 'Winner ID, nationality and mobile'), tr('الفاتورة', 'Invoice'), tr('حالة الفاتورة', 'Invoice status'), tr('الضريبة', 'VAT'), tr('الشهادة', 'Certificate'), tr('التمديدات', 'Extensions')],
            ...list.map((r) => [r.number, r.name, TYPE_LABEL[r.type], KIND()[r.kind], r.requestNumber ?? r.listingNumber ?? '', r.ownerName, ...ownerColumns(owners.get(r.ownerId)), STATUS()[r.status][0], date(r.startsAt), date(r.endsAt), r.openingPrice, r.price, r.bidCount, r.bidders,
              r.winnerName ? `${r.winnerName}${r.wonByRequester ? tr(' (مقدم الطلب)', ' (applicant)') : ''}` : '', r.winnerId ? ownerColumns(owners.get(r.winnerId)).filter(Boolean).join(' · ') : '', r.invoiceNumber ?? '', r.invoiceStatus === 'paid' ? tr('مدفوعة', 'Paid') : r.invoiceStatus === 'unpaid' ? tr('غير مدفوعة', 'Unpaid') : '', r.vat ?? '', r.certCode ?? '', r.extensions]),
          ])}>{tr('تصدير Excel', 'Export to Excel')}</button>
          <button className="btn-primary" onClick={() => print({ title: tr('تقرير الشعارات', 'Marks report'), subtitle, el: ref.current, landscape: true })}><Icon name="file" className="h-4 w-4" />{tr('طباعة التقرير', 'Print report')}</button>
        </div>} />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Segmented value={state} onChange={setState} options={[['sold', tr('المُرساة', 'Awarded')], ['live', tr('جارية', 'Live')], ['scheduled', tr('قادمة', 'Upcoming')], ['paused', tr('متوقفة', 'Paused')], ['cancelled', tr('ملغاة', 'Cancelled')], ['all', tr('الكل', 'All')]]} />
        <Segmented value={type} onChange={setType} options={typeOptions('all', tr('الكل', 'All'))} />
        <label className="text-sm">{tr('من', 'From')}<input type="date" className="field mt-1 w-auto py-1.5" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="text-sm">{tr('إلى', 'To')}<input type="date" className="field mt-1 w-auto py-1.5" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      </div>
      {error && <ErrorBox text={error} />}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon="gavel" tone="pine" label={tr('المزادات', 'Auctions')} value={num(list.length)} />
        <StatTile icon="check" tone="green" label={tr('المُرساة', 'Awarded')} value={num(sold.length)} />
        <StatTile icon="coins" tone="gold" label={tr('إجمالي قيمة الفوز', 'Total winning amount')} value={sar(total)} />
        <StatTile icon="trophy" tone="blue" label={tr('أعلى قيمة', 'Highest value')} value={top ? sar(top.price) : '—'} />
      </div>
      <TableTools t={tf} placeholder={tr('بحث برقم المزاد أو الشعار أو الطلب أو المالك أو الفائز', 'Search by auction no., mark, request, owner or winner')} />
      {loading && !data ? <Loading /> : data?.length ? (
        <div ref={ref} className="panel overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>{tr('رقم المزاد', 'Auction no.')}</th><th>{tr('الشعار', 'Mark')}</th><th>{tr('رقم الطلب', 'Request no.')}</th><th>{tr('المالك', 'Owner')}</th><th>{tr('الحالة', 'Status')}</th><th>{tr('التاريخ', 'Date')}</th><th>{tr('الافتتاحي', 'Opening')}</th><th>{tr('قيمة الفوز', 'Winning amount')}</th><th>{tr('المزايدات', 'Bids')}</th><th>{tr('الفائز', 'Winner')}</th><th>{tr('الفاتورة', 'Invoice')}</th><th>{tr('الشهادة', 'Certificate')}</th></tr></thead>
            <tbody>
              {!list.length && <NoResults cols={12} onReset={tf.reset} />}
              {list.map((r) => (
                <tr key={r.auctionId}>
                  <td className="num whitespace-nowrap font-semibold"><Link to={`/auctions/${r.auctionId}`} className="hover:underline">{r.number}</Link></td>
                  <td><span className="flex items-center gap-1.5 font-extrabold"><TypeBadge type={r.type} />{r.name}</span><span className="text-[12px] text-muted">{KIND()[r.kind]}</span></td>
                  <td className="num whitespace-nowrap">{r.requestNumber ?? r.listingNumber ?? '—'}</td>
                  <td><OwnerCell id={r.ownerId} name={r.ownerName} /></td>
                  <td><span className={`pill ${STATUS()[r.status][1]}`}>{STATUS()[r.status][0]}</span></td>
                  <td className="whitespace-nowrap text-[13px]">{date(r.endsAt)}</td>
                  <td className="num whitespace-nowrap text-muted">{sar(r.openingPrice)}</td>
                  <td className="num whitespace-nowrap font-bold">{r.status === 'cancelled' ? '—' : sar(r.price)}</td>
                  <td className="num">{num(r.bidCount)}<span className="text-[12px] text-muted"> / {num(r.bidders)} {tr('مزايد', 'bidders')}</span></td>
                  <td className="text-[13.5px]">{r.winnerName ? <OwnerCell id={r.winnerId} name={r.winnerName} note={r.wonByRequester && <span className="block text-[12px] text-muted">{tr('مقدم الطلب', 'Applicant')}</span>} /> : '—'}</td>
                  <td className="num whitespace-nowrap text-[13px]">{r.invoiceNumber ? <>{r.invoiceNumber}<span className={`block ${r.invoiceStatus === 'paid' ? 'text-ok' : 'text-gold-deep'}`}>{r.invoiceStatus === 'paid' ? tr('مدفوعة', 'Paid') : tr('غير مدفوعة', 'Unpaid')}</span></> : '—'}</td>
                  <td className="num text-[12.5px] text-muted">{r.certCode ?? '—'}</td>
                </tr>
              ))}
            </tbody>
            {sold.length > 0 && <tfoot><tr className="bg-stone font-bold"><td colSpan={7}>{tr('الإجمالي', 'Total')} ({num(sold.length)} {tr('مُرسى', 'awarded')})</td><td className="num whitespace-nowrap">{sar(total)}</td><td colSpan={4}></td></tr></tfoot>}
          </table>
        </div>
      ) : <Empty title={tr('لا توجد مزادات بهذه التصفية', 'No auctions match this filter')} />}
    </>
  )
}
