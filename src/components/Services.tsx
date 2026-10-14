import { Link } from 'react-router-dom'
import { Icon } from './dash'
import type { IconName } from './dash'
import { RULES } from '../lib/config'
import { sar } from '../lib/format'
import { tr } from '../lib/i18n'
import { useApp } from '../lib/store'

export type ServiceKey = 'mark' | 'invest' | 'resale' | 'transfer' | 'compound'

export interface EService {
  key: ServiceKey
  icon: IconName
  title: string
  desc: string
  /** the price line; «مجانًا» when the service costs nothing */
  price: string
  /** small print under the price (refund rule, who pays what) */
  priceNote?: string
  free: boolean
  open: boolean
  /** why the service is closed, shown only while it is closed */
  closedNote?: string
  /** where an owner applies for it */
  to: string
}

const pct = (r: number) => Math.round(r * 100)
const FREE = () => tr('مجانًا', 'Free')

/** The five e-services with live prices and open/closed state from the public settings. */
export function useServices(): EService[] {
  const { settings: s } = useApp()
  const closed = (note?: string) => note || tr('الخدمة متوقفة مؤقتًا، تابعنا لمعرفة موعد الفتح.', 'The service is temporarily paused. Follow us to know when it reopens.')
  const deposit = s.depositAmount ?? RULES.depositAmount
  const fee = s.transferFee ?? 0
  return [
    {
      key: 'mark', icon: 'file', to: '/dashboard/requests/new',
      title: tr('طلب شعار', 'Request a mark'),
      desc: tr(`سجّل حتى ${RULES.namesPerRequest} أسماء مقترحة، تراجعها اللجنة ثم يُطرح المعتمد منها في مزاد علني.`, `Submit up to ${RULES.namesPerRequest} proposed names; the committee reviews them and the approved one goes to a public auction.`),
      price: deposit ? tr(`ضمان مسترد ${sar(deposit)}`, `Refundable guarantee ${sar(deposit)}`) : FREE(),
      priceNote: deposit ? tr('يُعاد إلى محفظتك عند عدم الترسية أو الرفض، ويدفع الفائز قيمة الشعار منفصلة.', 'Returned to your wallet if not awarded or declined; the winner pays the mark value separately.') : undefined,
      free: !deposit, open: s.requestsOpen, closedNote: s.requestsOpen ? undefined : closed(s.requestsClosedNote),
    },
    {
      key: 'invest', icon: 'coins', to: '/dashboard/invest',
      title: tr('طلب شعار للاستثمار', 'Name investment'),
      desc: tr(`اقترح أسماء جديدة، تطرحها المنظمة في مزاد عام ولك ${pct(RULES.investOwnerShare)}٪ من قيمة بيعها.`, `Propose new names; the organization auctions them and you get ${pct(RULES.investOwnerShare)}% of the sale.`),
      price: RULES.investFee ? tr(`رسوم دراسة ${sar(RULES.investFee)}`, `Study fee ${sar(RULES.investFee)}`) : FREE(),
      priceNote: RULES.investFee ? tr('غير مستردة.', 'Non-refundable.') : undefined,
      free: !RULES.investFee, open: s.investmentOpen, closedNote: s.investmentOpen ? undefined : closed(s.investmentClosedNote),
    },
    {
      key: 'resale', icon: 'tag', to: '/dashboard/sell',
      title: tr('إعادة بيع', 'Resell a name'),
      desc: tr('اعرض اسمًا تملكه في مزاد إعادة البيع، أو للبيع الفوري بسعر ثابت تحدده.', 'List a name you own in a resale auction, or for instant sale at a fixed price you set.'),
      price: tr(`عمولة ${pct(RULES.resaleCommission)}٪ من قيمة البيع`, `${pct(RULES.resaleCommission)}% commission on the sale`),
      priceNote: tr(`العرض مجاني، وعمولة البيع الفوري ${pct(RULES.instantCommission)}٪.`, `Listing is free; instant sale commission is ${pct(RULES.instantCommission)}%.`),
      free: false, open: s.resaleAuctionOpen || s.instantSaleOpen, closedNote: s.resaleAuctionOpen || s.instantSaleOpen ? undefined : closed(s.saleClosedNote),
    },
    {
      key: 'transfer', icon: 'users', to: '/dashboard/transfers',
      title: tr('نقل ملكية', 'Ownership transfer'),
      desc: tr('انقل اسمًا تملكه إلى مالك مسجّل آخر (بيع خارج المنصة، هبة، إرث)، يقبله المستلم وتعتمده اللجنة.', 'Move a name you own to another registered owner (outside sale, gift, inheritance); the recipient accepts and the committee approves.'),
      price: fee ? sar(fee) : FREE(),
      priceNote: fee ? tr('تُدفع بالبطاقة، شاملة الضريبة.', 'Paid by card, VAT included.') : undefined,
      free: !fee, open: true,
    },
    {
      key: 'compound', icon: 'plus', to: '/dashboard/names',
      title: tr('طلب اسم مركب', 'Compound name'),
      desc: tr('أضف اسمًا إلى اسم تملكه، مثل «الفاخر الأول»، ويُعتمد بعد مراجعة اللجنة.', 'Add a name to one you own, such as “Al-Fakher Al-Awwal”, approved after committee review.'),
      price: FREE(),
      priceNote: tr('يُطلب من بطاقة الاسم في «أسمائي».', 'Requested from the name card in “My names”.'),
      free: true, open: s.compoundOpen, closedNote: s.compoundOpen ? undefined : closed(s.compoundClosedNote),
    },
  ]
}

/** Grid of e-service cards. Public: links go through sign-in unless an owner is signed in. */
export function ServicesGrid({ audience, className = '' }: { audience: 'public' | 'owner'; className?: string }) {
  const { user } = useApp()
  const list = useServices()
  const isOwner = audience === 'owner' || user?.role === 'owner'
  const cols = audience === 'public' ? 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5' : 'sm:grid-cols-2 xl:grid-cols-3'
  return (
    <ul className={`grid gap-4 ${cols} ${className}`}>
      {list.map((s) => <ServiceCard key={s.key} s={s} isOwner={isOwner} signedIn={!!user} />)}
    </ul>
  )
}

function ServiceCard({ s, isOwner, signedIn }: { s: EService; isOwner: boolean; signedIn: boolean }) {
  const label = tr('تقدّم للخدمة', 'Apply')
  return (
    <li className={`panel group relative flex flex-col overflow-hidden p-5 transition-shadow ${s.open ? 'hover:shadow-lift' : 'opacity-90'}`}>
      <span className={`absolute inset-x-0 top-0 h-1 ${s.open ? 'bg-gold' : 'bg-stone-deep'}`} aria-hidden />
      <div className="flex items-start justify-between gap-3">
        <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${s.open ? 'bg-pine text-gold-light' : 'bg-stone-deep text-muted'}`}>
          <Icon name={s.icon} className="h-6 w-6" />
        </span>
        {!s.open && <span className="pill bg-stone-deep text-muted"><Icon name="lock" className="h-3.5 w-3.5" />{tr('مغلقة حاليًا', 'Closed now')}</span>}
      </div>
      <h3 className="mt-4 text-[18px] font-extrabold">{s.title}</h3>
      <p className="mt-1.5 flex-1 text-[14.5px] leading-7 text-muted">{s.desc}</p>

      <div className="mt-4 rounded-lg bg-stone px-3.5 py-2.5">
        <span className="block text-[12px] font-medium text-muted">{tr('رسوم الخدمة', 'Service fee')}</span>
        <span className={`num block text-[15.5px] font-extrabold ${s.free ? 'text-ok' : 'text-gold-deep'}`}>{s.price}</span>
        {s.priceNote && <span className="mt-0.5 block text-[12.5px] leading-6 text-muted">{s.priceNote}</span>}
      </div>

      {!s.open && s.closedNote && (
        <p role="status" className="mt-3 flex items-start gap-2 rounded-lg border border-gold/50 bg-gold-soft px-3 py-2 text-[13px] leading-6 text-gold-deep">
          <Icon name="alert" className="mt-1 h-4 w-4 shrink-0" />{s.closedNote}
        </p>
      )}

      {s.open ? (
        isOwner
          ? <Link to={s.to} className="btn-primary mt-4 w-full">{label}<Icon name="arrow" className="h-4 w-4 rtl:rotate-180" /></Link>
          : <Link to="/login" state={{ from: s.to }} className="btn-primary mt-4 w-full">{signedIn ? label : tr('سجّل الدخول للتقديم', 'Sign in to apply')}<Icon name="arrow" className="h-4 w-4 rtl:rotate-180" /></Link>
      ) : (
        <button type="button" disabled className="btn-ghost mt-4 w-full">{label}</button>
      )}
    </li>
  )
}
