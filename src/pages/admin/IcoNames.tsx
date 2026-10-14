import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../../components/dash'
import { NoResults, TableTools, useTableFilter } from '../../components/TableTools'
import { Empty, ErrorBox, Loading, Modal, PageHead, TypeBadge } from '../../components/ui'
import { RULES, typeOptions } from '../../lib/config'
import { dateTime, fromLocalInput, num, sar, toLocalInput } from '../../lib/format'
import { tr } from '../../lib/i18n'
import { api, useApp, useLoad } from '../../lib/store'
import type { IcoName } from '../../lib/types'

function AuctionDialog({ n, onClose, onDone }: { n: IcoName; onClose: () => void; onDone: () => void }) {
  const { toast, settings } = useApp()
  const base = (() => { const d = new Date(); d.setMinutes(0, 0, 0); return d.getTime() + 3600_000 })()
  const [starts, setStarts] = useState(toLocalInput(base))
  const [ends, setEnds] = useState(toLocalInput(base + 3 * 86400_000))
  const [opening, setOpening] = useState(String(n.forfeitedPrice ? Math.max(RULES.openingPrice, Math.round(n.forfeitedPrice / 2)) : RULES.openingPrice))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function go() {
    setBusy(true); setErr('')
    try { await api.auctionIcoName(n.id, fromLocalInput(starts), fromLocalInput(ends), Number(opening)); toast(tr(`طُرح «${n.name}» في مزاد`, `“${n.name}” is up for auction`)); onDone() } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title={tr(`طرح «${n.name}» في مزاد`, `Auction “${n.name}”`)}>
      <div className="space-y-4">
        {err && <ErrorBox text={err} />}
        <p className="text-[14.5px] leading-7">{tr(`يُطرح الاسم في مزاد عام باسم المنظمة الدولية للإبل. يدفع كل مزايد ضمان الدخول (${sar(settings?.depositAmount ?? RULES.depositAmount)})، ويسدّد الفائز قيمة الشعار خلال ${settings?.paymentDeadlineHours ?? 72} ساعة.`, `The name goes to a public auction on behalf of the International Camel Organization. Every bidder pays the entry guarantee (${sar(settings?.depositAmount ?? RULES.depositAmount)}), and the winner pays within ${settings?.paymentDeadlineHours ?? 72} hours.`)}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label" htmlFor="ia-s">{tr('البداية (بتوقيت الرياض)', 'Starts (Riyadh time)')}</label><input id="ia-s" type="datetime-local" className="field" value={starts} onChange={(e) => setStarts(e.target.value)} /></div>
          <div><label className="label" htmlFor="ia-e">{tr('النهاية (بتوقيت الرياض)', 'Ends (Riyadh time)')}</label><input id="ia-e" type="datetime-local" className="field" value={ends} onChange={(e) => setEnds(e.target.value)} /></div>
        </div>
        <div>
          <label className="label" htmlFor="ia-o">{tr('السعر الافتتاحي', 'Opening price')}</label>
          <input id="ia-o" type="number" min={0} className="field num" dir="ltr" value={opening} onChange={(e) => setOpening(e.target.value)} />
          {n.forfeitedPrice != null && <p className="hint">{tr(`كان قد رسا بـ ${sar(n.forfeitedPrice)}.`, `It was previously won at ${sar(n.forfeitedPrice)}.`)}</p>}
        </div>
        <div className="flex gap-2">
          <button className="btn-primary flex-1" disabled={busy || !(Number(opening) >= 0)} onClick={go}>{busy ? '…' : tr('طرح في المزاد', 'Put up for auction')}</button>
          <button className="btn-ghost" onClick={onClose}>{tr('إلغاء', 'Cancel')}</button>
        </div>
      </div>
    </Modal>
  )
}

/** «أسماء المنظمة الدولية»: names that passed to the organization because the winner did not pay in time (names.ico) */
export function AdminIcoNames() {
  const { data, loading, error, reload } = useLoad(() => api.icoNames(), [])
  const [auctioning, setAuctioning] = useState<IcoName | null>(null)
  const tf = useTableFilter(data, {
    fields: (n) => [n.name, n.latin, n.forfeitedFromName ?? ''],
    filters: [{ key: 'type', label: tr('النوع', 'Type'), options: typeOptions('', tr('الكل', 'All')), test: (x, v) => x.type === v }],
  })
  const forfeited = (data ?? []).reduce((s, n) => s + (n.forfeitedDeposit ?? 0), 0)
  return (
    <>
      <PageHead title={tr('أسماء المنظمة الدولية', 'Organization names')} sub={tr('أسماء رست في المزاد ولم يُسدّد الفائز قيمتها في المهلة، فخُصم ضمانه وآلت ملكيتها إلى المنظمة الدولية للإبل. تستطيع طرحها في مزاد جديد.', 'Names whose winner did not pay in time: the guarantee was forfeited and the name passed to the International Camel Organization. You can auction them again.')} />
      {error ? <ErrorBox text={error} /> : loading && !data ? <Loading /> : data?.length ? (
        <section className="panel overflow-hidden">
          <div className="flex flex-wrap items-center gap-4 border-b border-line px-5 py-3 text-[14px]">
            <span>{tr('عدد الأسماء', 'Names')} <b className="num">{num(data.length)}</b></span>
            <span>{tr('الضمانات المخصومة', 'Forfeited guarantees')} <b className="num">{sar(forfeited)}</b></span>
          </div>
          <div className="px-5 pt-4"><TableTools t={tf} placeholder={tr('بحث بالاسم أو الفائز السابق', 'Search by name or former winner')} /></div>
          {(
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead><tr><th>{tr('الاسم', 'Name')}</th><th>{tr('النوع', 'Type')}</th><th>{tr('الفائز السابق', 'Former winner')}</th><th>{tr('قيمة الفوز', 'Winning price')}</th><th>{tr('الضمان المخصوم', 'Forfeited guarantee')}</th><th>{tr('آل إلى المنظمة', 'Passed to the organization')}</th><th>{tr('المزاد', 'Auction')}</th></tr></thead>
                <tbody>
                  {tf.list.map((n) => (
                    <tr key={n.id}>
                      <td><b className="block text-[16px]">{n.name}</b><span className="text-[12.5px] text-muted" dir="ltr">{n.latin}</span></td>
                      <td><TypeBadge type={n.type} /></td>
                      <td className="text-[14px]">{n.forfeitedFromName ?? '—'}</td>
                      <td className="num">{n.forfeitedPrice != null ? sar(n.forfeitedPrice) : '—'}</td>
                      <td className="num font-semibold text-bad">{n.forfeitedDeposit != null ? sar(n.forfeitedDeposit) : '—'}</td>
                      <td className="whitespace-nowrap text-[13px] text-muted">{n.forfeitedAt ? dateTime(n.forfeitedAt) : '—'}</td>
                      <td className="whitespace-nowrap">{n.auction
                        ? <Link to={`/auctions/${n.auction.id}`} className="text-[13.5px] font-semibold text-pine underline">{n.auction.number ?? tr('مزاد', 'Auction')} · {Date.parse(n.auction.startsAt) > Date.now() ? tr('مجدول', 'Scheduled') : tr('قائم', 'Live')}</Link>
                        : <button className="btn-primary btn-sm" onClick={() => setAuctioning(n)}><Icon name="gavel" className="h-4 w-4" />{tr('طرح في مزاد', 'Auction')}</button>}</td>
                    </tr>
                  ))}
                  {!tf.list.length && <NoResults cols={7} onReset={tf.reset} />}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : <Empty title={tr('لا توجد أسماء للمنظمة', 'No organization names')}><p className="text-muted">{tr('تظهر هنا الأسماء التي لم يسدّد الفائز قيمتها في المهلة المحددة في الإعدادات.', 'Names appear here when a winner does not pay within the deadline set in settings.')}</p></Empty>}
      {auctioning && <AuctionDialog n={auctioning} onClose={() => setAuctioning(null)} onDone={() => { setAuctioning(null); reload() }} />}
    </>
  )
}
