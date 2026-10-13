import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Icon } from '../../components/dash'
import { TableTools, useTableFilter } from '../../components/TableTools'
import { Empty, Loading, NameSeal, PageHead, TypeBadge } from '../../components/ui'
import { RULES, typeOptions } from '../../lib/config'
import { dateTime, sar } from '../../lib/format'
import { api, useApp, useLoad } from '../../lib/store'
import type { ListingMode, NameListing } from '../../lib/types'

const pct = (r: number) => Math.round(r * 100)
const round2 = (n: number) => Math.round(n * 100) / 100

const STATUS: Record<NameListing['status'], [string, string]> = {
  scheduled: ['معلن، يبدأ المزاد قريبًا', 'bg-info-soft text-info-deep'],
  live: ['معروض الآن', 'bg-gold text-pine'],
  sold: ['بيع', 'bg-[#E2F0E8] text-ok'],
  unsold: ['انتهى دون مزايدات', 'bg-stone-deep text-ink'],
  expired: ['انتهت مدة العرض', 'bg-stone-deep text-ink'],
  cancelled: ['ألغيته', 'bg-stone-deep text-muted'],
}

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

  const sellable = useMemo(() => (names.data ?? []).filter((n) => !n.listingId && !invoices.data?.some((i) => i.status === 'unpaid' && i.name === n.name)), [names.data, invoices.data])
  const chosen = sellable.find((n) => n.id === reservedId)
  const rate = mode === 'auction' ? RULES.resaleCommission : RULES.instantCommission
  const value = Number(price)
  const valid = !!chosen && Number.isFinite(value) && value >= RULES.openingPrice && agree

  async function submit() {
    if (!chosen) return
    setBusy(true)
    try {
      const l = await api.createListing(chosen.id, mode, value)
      toast(mode === 'auction' ? `أُعلن مزاد «${l.name}» ويبدأ بعد ${RULES.resaleNoticeHours} ساعة` : `«${l.name}» معروض الآن للبيع الفوري`)
      setReservedId(''); setPrice(''); setAgree(false); names.reload(); listings.reload()
    } catch (e) { toast((e as Error).message, 'bad') } finally { setBusy(false) }
  }
  async function cancel(l: NameListing) {
    if (!confirm(`إلغاء عرض «${l.name}»؟`)) return
    try { await api.cancelListing(l.id); toast('أُلغي العرض وبقي الاسم باسمك'); names.reload(); listings.reload() } catch (e) { toast((e as Error).message, 'bad') }
  }

  const tf = useTableFilter(listings.data, {
    fields: (l) => [l.number, l.name],
    filters: [
      { key: 'mode', label: 'الطريقة', options: [['', 'الكل'], ['auction', 'مزاد'], ['instant', 'بيع فوري']], test: (l, v) => l.mode === v },
      { key: 'type', label: 'النوع', options: typeOptions('', 'الكل'), test: (l, v) => l.type === v },
    ],
  })
  const earned = (listings.data ?? []).filter((l) => l.payoutPaid).reduce((s, l) => s + (l.payout ?? 0), 0)

  return (
    <>
      <PageHead title="بيع اسم" sub={<>اعرض اسمًا تملكه للبيع بالمزاد أو بسعر ثابت، ويصلك الثمن في محفظتك بعد عمولة سمّها. <Link to="/market" className="font-bold text-pine underline">سوق الأسماء</Link></>} />

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="panel p-5">
          <h2 className="flex items-center gap-2 text-lg"><span className="grid h-9 w-9 place-items-center rounded-lg bg-gold-soft text-gold-deep"><Icon name="tag" /></span>عرض اسم للبيع</h2>
          {names.loading && !names.data ? <Loading /> : !sellable.length ? (
            <p className="mt-4 rounded-lg bg-stone p-4 text-[15px] text-muted">لا يوجد اسم متاح للبيع. تظهر هنا أسماؤك المسجلة غير المعروضة، بعد سداد فاتورتها.</p>
          ) : (
            <div className="mt-4 space-y-4">
              <div>
                <label className="label" htmlFor="sell-name">اختر الاسم</label>
                <select id="sell-name" className="field" value={reservedId} onChange={(e) => setReservedId(e.target.value)}>
                  <option value="">اختر من أسمائك</option>
                  {sellable.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
                </select>
                {chosen && <div className="mt-3 flex items-center gap-3"><NameSeal name={chosen.name} type={chosen.type} size="sm" /><TypeBadge type={chosen.type} /></div>}
              </div>
              <fieldset>
                <legend className="label">نوع الطرح</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {([['auction', 'طرح الاسم للمزاد', `يُعلن قبل ${RULES.resaleNoticeHours} ساعة، ويستمر ${RULES.resaleAuctionDays} أيام، وعمولة سمّها ${pct(RULES.resaleCommission)}%.`],
                    ['instant', 'بيع فوري', `يُعرض في السوق ${RULES.instantSaleHours} ساعة بسعر تحدده، وعمولة سمّها ${pct(RULES.instantCommission)}%.`]] as [ListingMode, string, string][]).map(([m, t, d]) => (
                    <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}
                      className={`rounded-xl border-2 p-4 text-start transition-colors ${mode === m ? 'border-pine bg-pine-soft' : 'border-line bg-paper hover:border-pine'}`}>
                      <span className="flex items-center gap-2 font-extrabold text-lg"><Icon name={m === 'auction' ? 'gavel' : 'coins'} />{t}</span>
                      <span className="mt-1 block text-[13.5px] text-muted">{d}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
              <div>
                <label className="label" htmlFor="sell-price">{mode === 'auction' ? 'حدد القيمة الأدنى للاسم (سعر فتح المزاد)' : 'حدد قيمة الاسم المراد بيعه'}</label>
                <input id="sell-price" className="field num text-lg" inputMode="numeric" placeholder={`${RULES.openingPrice} ريال أو أكثر`} value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ''))} />
                {value >= RULES.openingPrice && (
                  <p className="mt-1.5 text-[14px] text-muted">
                    {mode === 'auction' ? 'إن بيع بهذه القيمة' : 'عند البيع'} يصلك <b className="num text-ok">{sar(round2(value * (1 - rate)))}</b> بعد عمولة {pct(rate)}% ({sar(round2(value * rate))}).
                    {mode === 'auction' && ' وكلما ارتفعت المزايدة ارتفع نصيبك.'}
                  </p>
                )}
              </div>
              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg bg-stone p-3 text-[14.5px]">
                <input type="checkbox" className="mt-1" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                <span>{mode === 'auction'
                  ? `أوافق على عمولة سمّها ${pct(RULES.resaleCommission)}% من القيمة النهائية، وعلى أن يُنقل الاسم للفائز بعد سداده خلال ${RULES.resaleAuctionDays} أيام، وأن يُرسل إشعار بالمزاد لجميع المسجلين.`
                  : `أوافق على عمولة سمّها ${pct(RULES.instantCommission)}% من قيمة البيع، وعلى أن يُنقل الاسم للمشتري فور سداده، وأن يُرسل إشعار بالعرض لجميع المسجلين.`}</span>
              </label>
              <button className="btn-gold w-full sm:w-auto sm:px-6" disabled={!valid || busy} onClick={submit}>{busy ? 'جارٍ العرض…' : mode === 'auction' ? 'إرسال وإعلان المزاد' : 'إرسال وعرض الاسم للبيع'}</button>
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <div className="panel p-5">
            <h2 className="text-lg">مبيعاتك</h2>
            <div className="mt-3 rounded-lg bg-[#E2F0E8] p-3"><div className="text-[13px] text-ok">وصل إلى محفظتك</div><div className="num text-xl font-extrabold">{sar(earned)}</div></div>
          </div>
          <div className="panel space-y-3 p-5 text-[14.5px]">
            <h3 className="text-[16px]">إعادة البيع في المزاد</h3>
            <ul className="space-y-1.5 text-ink/80">
              <li>• يُدرج الاسم ويُعلن قبل {RULES.resaleNoticeHours} ساعة، ويُرسل إشعار لجميع المسجلين.</li>
              <li>• يفتح المزاد بالقيمة الأدنى التي تحددها، ومدته {RULES.resaleAuctionDays} أيام.</li>
              <li>• يدفع المشاركون ضمان {sar(RULES.resaleBidDeposit)} قبل المزايدة.</li>
              <li>• تُحوّل لك القيمة بعد خصم {pct(RULES.resaleCommission)}% فور سداد الفائز.</li>
            </ul>
            <h3 className="pt-2 text-[16px]">البيع الفوري</h3>
            <ul className="space-y-1.5 text-ink/80">
              <li>• يُعرض الاسم في «سوق الأسماء» {RULES.instantSaleHours} ساعة بالسعر الذي تحدده.</li>
              <li>• أول من يشتري ويدفع يُنقل له الاسم، ويُزال من السوق.</li>
              <li>• يصلك الثمن بعد خصم {pct(RULES.instantCommission)}% فورًا.</li>
            </ul>
          </div>
        </aside>
      </div>

      <h2 className="mb-3 mt-8 text-xl">عروضي</h2>
      {listings.loading && !listings.data ? <Loading /> : listings.data?.length ? (
        <>
          <TableTools t={tf} placeholder="بحث بالاسم أو رقم العرض" />
          <div className="panel overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>العرض</th><th>الاسم</th><th>الطريقة</th><th>القيمة</th><th>الحالة</th><th>المدة</th><th>صافي لك</th><th></th></tr></thead>
              <tbody>
                {tf.list.map((l) => (
                  <tr key={l.id}>
                    <td className="num font-semibold">{l.number}</td>
                    <td><span className="flex items-center gap-2 font-extrabold"><TypeBadge type={l.type} />{l.name}</span></td>
                    <td>{l.mode === 'auction' ? 'مزاد' : 'بيع فوري'}</td>
                    <td className="num">{l.mode === 'auction' && l.bidCount ? <>{sar(l.currentPrice ?? l.price)} <span className="text-[12px] text-muted">({l.bidCount} مزايدة)</span></> : sar(l.soldPrice ?? l.price)}</td>
                    <td><span className={`pill ${STATUS[l.status][1]}`}>{STATUS[l.status][0]}</span></td>
                    <td className="text-[13px] text-muted">{dateTime(l.startsAt)}<br />حتى {dateTime(l.endsAt)}</td>
                    <td className="num">{l.payout ? <><b className="text-ok">{sar(l.payout)}</b><br /><span className="text-[12px] text-muted">{l.payoutPaid ? 'وصل لمحفظتك' : 'بعد سداد المشتري'}</span></> : '—'}</td>
                    <td className="whitespace-nowrap">
                      {l.auctionId && <Link to={`/auctions/${l.auctionId}`} className="btn-ghost btn-sm">صفحة المزاد</Link>}
                      {(l.status === 'scheduled' || (l.mode === 'instant' && l.status === 'live')) && <button className="btn-ghost btn-sm ms-1 text-bad" onClick={() => cancel(l)}>إلغاء العرض</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : <Empty title="لم تعرض أي اسم للبيع بعد"><p className="text-muted">اختر اسمًا من أسمائك في النموذج أعلاه.</p></Empty>}
    </>
  )
}
