import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Icon } from '../../components/dash'
import { TableTools, useTableFilter } from '../../components/TableTools'
import { Empty, Loading, NameSeal, PageHead, TypeBadge } from '../../components/ui'
import { RULES, typeOptions } from '../../lib/config'
import { dateTime, sar } from '../../lib/format'
import { api, useApp, useLoad } from '../../lib/store'
import { ClosedNotice, useClosed } from '../../components/SettingsUi'
import type { ListingMode, NameListing } from '../../lib/types'
import { tr } from '../../lib/i18n'

const pct = (r: number) => Math.round(r * 100)
const round2 = (n: number) => Math.round(n * 100) / 100

const statusMap = (): Record<NameListing['status'], [string, string]> => ({
  scheduled: [tr('معلن، يبدأ المزاد قريبًا', 'Announced, auction starts soon'), 'bg-info-soft text-info-deep'],
  live: [tr('معروض الآن', 'Listed now'), 'bg-gold text-pine'],
  sold: [tr('بيع', 'Sold'), 'bg-[#E2F0E8] text-ok'],
  unsold: [tr('انتهى دون مزايدات', 'Ended with no bids'), 'bg-stone-deep text-ink'],
  expired: [tr('انتهت مدة العرض', 'Listing expired'), 'bg-stone-deep text-ink'],
  cancelled: [tr('ألغيته', 'Cancelled by you'), 'bg-stone-deep text-muted'],
})

/** «بيع اسم»: an owner offers a name they own, by resale auction or at a fixed price. */
export function SellPage() {
  const { toast } = useApp()
  const [params] = useSearchParams()
  const names = useLoad(() => api.myNames(), [])
  const listings = useLoad(() => api.myListings(), [])
  const invoices = useLoad(() => api.myInvoices(), [])
  const [reservedId, setReservedId] = useState(params.get('name') ?? '')
  const [mode, setMode] = useState<ListingMode>('auction')
  const [price, setPrice] = useState('')
  const [agree, setAgree] = useState(false)
  const [busy, setBusy] = useState(false)
  const STATUS = statusMap()

  const sellable = useMemo(() => (names.data ?? []).filter((n) => !n.listingId && !invoices.data?.some((i) => i.status === 'unpaid' && i.name === n.name)), [names.data, invoices.data])
  const chosen = sellable.find((n) => n.id === reservedId)
  const rate = mode === 'auction' ? RULES.resaleCommission : RULES.instantCommission
  const value = Number(price)
  const closed = useClosed(mode === 'auction' ? 'resale' : 'instant')
  const valid = !!chosen && Number.isFinite(value) && value >= RULES.openingPrice && agree && !closed

  async function submit() {
    if (!chosen) return
    setBusy(true)
    try {
      const l = await api.createListing(chosen.id, mode, value)
      toast(mode === 'auction' ? tr(`أُعلن مزاد «${l.name}» ويبدأ بعد ${RULES.resaleNoticeHours} ساعة`, `Auction for «${l.name}» announced; it starts in ${RULES.resaleNoticeHours} hours`) : tr(`«${l.name}» معروض الآن للبيع الفوري`, `«${l.name}» is now listed for instant sale`))
      setReservedId(''); setPrice(''); setAgree(false); names.reload(); listings.reload()
    } catch (e) { toast((e as Error).message, 'bad') } finally { setBusy(false) }
  }
  async function cancel(l: NameListing) {
    if (!confirm(tr(`إلغاء عرض «${l.name}»؟`, `Cancel the listing for «${l.name}»?`))) return
    try { await api.cancelListing(l.id); toast(tr('أُلغي العرض وبقي الاسم باسمك', 'Listing cancelled; the name remains yours')); names.reload(); listings.reload() } catch (e) { toast((e as Error).message, 'bad') }
  }

  const tf = useTableFilter(listings.data, {
    fields: (l) => [l.number, l.name],
    filters: [
      { key: 'mode', label: tr('الطريقة', 'Method'), options: [['', tr('الكل', 'All')], ['auction', tr('مزاد', 'Auction')], ['instant', tr('بيع فوري', 'Instant sale')]], test: (l, v) => l.mode === v },
      { key: 'type', label: tr('النوع', 'Type'), options: typeOptions('', tr('الكل', 'All')), test: (l, v) => l.type === v },
    ],
  })
  const earned = (listings.data ?? []).filter((l) => l.payoutPaid).reduce((s, l) => s + (l.payout ?? 0), 0)

  return (
    <>
      <PageHead title={tr('بيع اسم', 'Sell a name')} sub={<>{tr('اعرض اسمًا تملكه للبيع بالمزاد أو بسعر ثابت، ويصلك الثمن في محفظتك بعد عمولة سمّها.', 'List a name you own for sale by auction or at a fixed price. The proceeds reach your wallet after the Sammha commission.')} <Link to="/market" className="font-bold text-pine underline">{tr('سوق الأسماء', 'Names market')}</Link></>} />

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="panel p-5">
          <h2 className="flex items-center gap-2 text-lg"><span className="grid h-9 w-9 place-items-center rounded-lg bg-gold-soft text-gold-deep"><Icon name="tag" /></span>{tr('عرض اسم للبيع', 'List a name for sale')}</h2>
          {names.loading && !names.data ? <Loading /> : !sellable.length ? (
            <p className="mt-4 rounded-lg bg-stone p-4 text-[15px] text-muted">{tr('لا يوجد اسم متاح للبيع. تظهر هنا أسماؤك المسجلة غير المعروضة، بعد سداد فاتورتها.', 'No names available to sell. Your registered names that are not listed appear here once their invoice is paid.')}</p>
          ) : (
            <div className="mt-4 space-y-4">
              <div>
                <label className="label" htmlFor="sell-name">{tr('اختر الاسم', 'Choose the name')}</label>
                <select id="sell-name" className="field" value={reservedId} onChange={(e) => setReservedId(e.target.value)}>
                  <option value="">{tr('اختر من أسمائك', 'Choose from your names')}</option>
                  {sellable.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
                </select>
                {chosen && <div className="mt-3 flex items-center gap-3"><NameSeal name={chosen.name} type={chosen.type} size="sm" /><TypeBadge type={chosen.type} /></div>}
              </div>
              <fieldset>
                <legend className="label">{tr('نوع الطرح', 'Listing type')}</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {([['auction', tr('طرح الاسم للمزاد', 'Put the name up for auction'), tr(`يُعلن قبل ${RULES.resaleNoticeHours} ساعة، ويستمر ${RULES.resaleAuctionDays} أيام، وعمولة سمّها ${pct(RULES.resaleCommission)}%.`, `Announced ${RULES.resaleNoticeHours} hours ahead, runs for ${RULES.resaleAuctionDays} days, Sammha commission ${pct(RULES.resaleCommission)}%.`)],
                    ['instant', tr('بيع فوري', 'Instant sale'), tr(`يُعرض في السوق ${RULES.instantSaleHours} ساعة بسعر تحدده، وعمولة سمّها ${pct(RULES.instantCommission)}%.`, `Listed in the market for ${RULES.instantSaleHours} hours at your price, Sammha commission ${pct(RULES.instantCommission)}%.`)]] as [ListingMode, string, string][]).map(([m, t, d]) => (
                    <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}
                      className={`rounded-xl border-2 p-4 text-start transition-colors ${mode === m ? 'border-pine bg-pine-soft' : 'border-line bg-paper hover:border-pine'}`}>
                      <span className="flex items-center gap-2 font-extrabold text-lg"><Icon name={m === 'auction' ? 'gavel' : 'coins'} />{t}</span>
                      <span className="mt-1 block text-[13.5px] text-muted">{d}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
              <ClosedNotice intake={mode === 'auction' ? 'resale' : 'instant'} />
              <div>
                <label className="label" htmlFor="sell-price">{mode === 'auction' ? tr('حدد القيمة الأدنى للاسم (سعر فتح المزاد)', 'Set the minimum value (auction opening price)') : tr('حدد قيمة الاسم المراد بيعه', 'Set the sale price')}</label>
                <input id="sell-price" className="field num text-lg" inputMode="numeric" placeholder={tr(`${RULES.openingPrice} ريال أو أكثر`, `${RULES.openingPrice} SAR or more`)} value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ''))} />
                {value >= RULES.openingPrice && (
                  <p className="mt-1.5 text-[14px] text-muted">
                    {mode === 'auction' ? tr('إن بيع بهذه القيمة', 'If sold at this value') : tr('عند البيع', 'On sale')} {tr('يصلك', 'you receive')} <b className="num text-ok">{sar(round2(value * (1 - rate)))}</b> {tr(`بعد عمولة ${pct(rate)}%`, `after the ${pct(rate)}% commission`)} ({sar(round2(value * rate))}).
                    {mode === 'auction' && tr(' وكلما ارتفعت المزايدة ارتفع نصيبك.', ' The higher the bidding, the bigger your share.')}
                  </p>
                )}
              </div>
              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg bg-stone p-3 text-[14.5px]">
                <input type="checkbox" className="mt-1" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                <span>{mode === 'auction'
                  ? tr(`أوافق على عمولة سمّها ${pct(RULES.resaleCommission)}% من القيمة النهائية، وعلى أن يُنقل الاسم للفائز بعد سداده خلال ${RULES.resaleAuctionDays} أيام، وأن يُرسل إشعار بالمزاد لجميع المسجلين.`, `I agree to the Sammha commission of ${pct(RULES.resaleCommission)}% of the final value, to the name being transferred to the winner once they pay within ${RULES.resaleAuctionDays} days, and to a notice of the auction being sent to all registered users.`)
                  : tr(`أوافق على عمولة سمّها ${pct(RULES.instantCommission)}% من قيمة البيع، وعلى أن يُنقل الاسم للمشتري فور سداده، وأن يُرسل إشعار بالعرض لجميع المسجلين.`, `I agree to the Sammha commission of ${pct(RULES.instantCommission)}% of the sale price, to the name being transferred to the buyer as soon as they pay, and to a notice of the listing being sent to all registered users.`)}</span>
              </label>
              <button className="btn-gold w-full sm:w-auto sm:px-6" disabled={!valid || busy} onClick={submit}>{busy ? tr('جارٍ العرض…', 'Listing…') : mode === 'auction' ? tr('إرسال وإعلان المزاد', 'Submit and announce the auction') : tr('إرسال وعرض الاسم للبيع', 'Submit and list the name for sale')}</button>
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <div className="panel p-5">
            <h2 className="text-lg">{tr('مبيعاتك', 'Your sales')}</h2>
            <div className="mt-3 rounded-lg bg-[#E2F0E8] p-3"><div className="text-[13px] text-ok">{tr('وصل إلى محفظتك', 'Paid to your wallet')}</div><div className="num text-xl font-extrabold">{sar(earned)}</div></div>
          </div>
          <div className="panel space-y-3 p-5 text-[14.5px]">
            <h3 className="text-[16px]">{tr('إعادة البيع في المزاد', 'Resale by auction')}</h3>
            <ul className="space-y-1.5 text-ink/80">
              <li>• {tr(`يُدرج الاسم ويُعلن قبل ${RULES.resaleNoticeHours} ساعة، ويُرسل إشعار لجميع المسجلين.`, `The name is listed and announced ${RULES.resaleNoticeHours} hours ahead, with a notice sent to all registered users.`)}</li>
              <li>• {tr(`يفتح المزاد بالقيمة الأدنى التي تحددها، ومدته ${RULES.resaleAuctionDays} أيام.`, `The auction opens at the minimum value you set and runs for ${RULES.resaleAuctionDays} days.`)}</li>
              <li>• {tr(`يدفع المشاركون ضمان ${sar(RULES.resaleBidDeposit)} قبل المزايدة.`, `Bidders pay a ${sar(RULES.resaleBidDeposit)} guarantee before bidding.`)}</li>
              <li>• {tr(`تُحوّل لك القيمة بعد خصم ${pct(RULES.resaleCommission)}% فور سداد الفائز.`, `The value is transferred to you, less ${pct(RULES.resaleCommission)}%, as soon as the winner pays.`)}</li>
            </ul>
            <h3 className="pt-2 text-[16px]">{tr('البيع الفوري', 'Instant sale')}</h3>
            <ul className="space-y-1.5 text-ink/80">
              <li>• {tr(`يُعرض الاسم في «سوق الأسماء» ${RULES.instantSaleHours} ساعة بالسعر الذي تحدده.`, `The name is listed in the «Names market» for ${RULES.instantSaleHours} hours at the price you set.`)}</li>
              <li>• {tr('أول من يشتري ويدفع يُنقل له الاسم، ويُزال من السوق.', 'The first buyer to pay gets the name, and it is removed from the market.')}</li>
              <li>• {tr(`يصلك الثمن بعد خصم ${pct(RULES.instantCommission)}% فورًا.`, `You receive the price immediately, less ${pct(RULES.instantCommission)}%.`)}</li>
            </ul>
          </div>
        </aside>
      </div>

      <h2 className="mb-3 mt-8 text-xl">{tr('عروضي', 'My listings')}</h2>
      {listings.loading && !listings.data ? <Loading /> : listings.data?.length ? (
        <>
          <TableTools t={tf} placeholder={tr('بحث بالاسم أو رقم العرض', 'Search by name or listing number')} />
          <div className="panel overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>{tr('العرض', 'Listing')}</th><th>{tr('الاسم', 'Name')}</th><th>{tr('الطريقة', 'Method')}</th><th>{tr('القيمة', 'Value')}</th><th>{tr('الحالة', 'Status')}</th><th>{tr('المدة', 'Period')}</th><th>{tr('صافي لك', 'Your net')}</th><th></th></tr></thead>
              <tbody>
                {tf.list.map((l) => (
                  <tr key={l.id}>
                    <td className="num font-semibold">{l.number}</td>
                    <td><span className="flex items-center gap-2 font-extrabold"><TypeBadge type={l.type} />{l.name}</span></td>
                    <td>{l.mode === 'auction' ? tr('مزاد', 'Auction') : tr('بيع فوري', 'Instant sale')}</td>
                    <td className="num">{l.mode === 'auction' && l.bidCount ? <>{sar(l.currentPrice ?? l.price)} <span className="text-[12px] text-muted">({tr(`${l.bidCount} مزايدة`, `${l.bidCount} ${l.bidCount === 1 ? 'bid' : 'bids'}`)})</span></> : sar(l.soldPrice ?? l.price)}</td>
                    <td><span className={`pill ${STATUS[l.status][1]}`}>{STATUS[l.status][0]}</span></td>
                    <td className="text-[13px] text-muted">{dateTime(l.startsAt)}<br />{tr('حتى', 'to')} {dateTime(l.endsAt)}</td>
                    <td className="num">{l.payout ? <><b className="text-ok">{sar(l.payout)}</b><br /><span className="text-[12px] text-muted">{l.payoutPaid ? tr('وصل لمحفظتك', 'Paid to your wallet') : tr('بعد سداد المشتري', 'After the buyer pays')}</span></> : '—'}</td>
                    <td className="whitespace-nowrap">
                      {l.auctionId && <Link to={`/auctions/${l.auctionId}`} className="btn-ghost btn-sm">{tr('صفحة المزاد', 'Auction page')}</Link>}
                      {(l.status === 'scheduled' || (l.mode === 'instant' && l.status === 'live')) && <button className="btn-ghost btn-sm ms-1 text-bad" onClick={() => cancel(l)}>{tr('إلغاء العرض', 'Cancel listing')}</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : <Empty title={tr('لم تعرض أي اسم للبيع بعد', 'You have not listed any names for sale yet')}><p className="text-muted">{tr('اختر اسمًا من أسمائك في النموذج أعلاه.', 'Choose one of your names in the form above.')}</p></Empty>}
    </>
  )
}
