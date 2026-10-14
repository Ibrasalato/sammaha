import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon } from './dash'
import type { IconName } from './dash'
import { RULES } from '../lib/config'
import { sar } from '../lib/format'
import { getLang, tr } from '../lib/i18n'
import { useApp } from '../lib/store'
import { termsOf } from '../lib/serviceTerms'
import type { ServiceKey as SettingKey } from '../lib/types'
import { Modal } from './ui'

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
  /** «قريبًا»: announced, not accepting yet (set by the admin) */
  soon?: boolean
  /** why the service is closed, shown only while it is closed */
  closedNote?: string
  /** where an owner applies for it */
  to: string
  /** where an owner follows what they already submitted */
  mine?: string
  /** the service's terms and policy, one item per line */
  terms: string[]
}

const pct = (r: number) => Math.round(r * 100)
const FREE = () => tr('مجانًا', 'Free')

/** The five e-services with live prices and open/closed state from the public settings. */
export function useServices(): EService[] {
  const { settings: s } = useApp()
  const closed = (note?: string) => note || tr('الخدمة متوقفة مؤقتًا، تابعنا لمعرفة موعد الفتح.', 'The service is temporarily paused. Follow us to know when it reopens.')
  const deposit = s.depositAmount ?? RULES.depositAmount
  const fee = s.transferFee ?? 0
  const investFee = s.investFee ?? RULES.investFee
  const compoundFee = s.compoundFee ?? 0
  const resalePct = s.resaleCommission ?? RULES.resaleCommission
  const instantPct = s.instantCommission ?? RULES.instantCommission
  const lang = getLang()
  const own: Record<string, string> = { mark: 'requests', invest: 'investment', resale: 'resale', transfer: 'transfer', compound: 'compound' }
  const textOf = (key: string, fallback: string) => {
    const t = s.serviceTexts?.[own[key] as keyof NonNullable<typeof s.serviceTexts>]
    return (lang === 'en' ? t?.en || t?.ar : t?.ar || t?.en) || fallback
  }
  const soon = new Set(s.comingSoon ?? [])
  const soonOf: Record<string, boolean> = {
    mark: soon.has('requests'), invest: soon.has('investment'), resale: soon.has('resale') && soon.has('instant'), transfer: soon.has('transfer'), compound: soon.has('compound'),
  }
  return ([
    {
      key: 'mark', icon: 'file', to: '/dashboard/requests/new', mine: '/dashboard/requests',
      title: tr('طلب شعار', 'Request a mark'),
      desc: tr(`سجّل حتى ${RULES.namesPerRequest} أسماء مقترحة، تراجعها اللجنة ثم يُطرح المعتمد منها في مزاد علني.`, `Submit up to ${RULES.namesPerRequest} proposed names; the committee reviews them and the approved one goes to a public auction.`),
      price: deposit ? tr(`مبلغ الضمان ${sar(deposit)}`, `Guarantee ${sar(deposit)}`) : FREE(),
      priceNote: deposit ? tr('يُعاد إلى محفظتك عند عدم الترسية أو الرفض، ويدفع الفائز قيمة الشعار منفصلة.', 'Returned to your wallet if not awarded or declined; the winner pays the mark value separately.') : undefined,
      free: !deposit, open: s.requestsOpen, closedNote: s.requestsOpen ? undefined : closed(s.requestsClosedNote),
    },
    {
      key: 'invest', icon: 'coins', to: '/dashboard/invest',
      title: tr('طلب شعار للاستثمار', 'Name investment'),
      desc: tr(`اقترح أسماء جديدة، تطرحها المنظمة في مزاد عام ولك ${pct(RULES.investOwnerShare)}٪ من قيمة بيعها.`, `Propose new names; the organization auctions them and you get ${pct(RULES.investOwnerShare)}% of the sale.`),
      price: investFee ? tr(`رسوم دراسة ${sar(investFee)}`, `Study fee ${sar(investFee)}`) : FREE(),
      priceNote: investFee ? tr('غير مستردة، تُدفع بالبطاقة.', 'Non-refundable, paid by card.') : undefined,
      free: !investFee, open: s.investmentOpen, closedNote: s.investmentOpen ? undefined : closed(s.investmentClosedNote),
    },
    {
      key: 'resale', icon: 'tag', to: '/dashboard/sell',
      title: tr('إعادة بيع', 'Resell a name'),
      desc: tr('اعرض اسمًا تملكه في مزاد إعادة البيع، أو للبيع الفوري بسعر ثابت تحدده.', 'List a name you own in a resale auction, or for instant sale at a fixed price you set.'),
      price: resalePct ? tr(`عمولة ${pct(resalePct)}٪ من قيمة البيع`, `${pct(resalePct)}% commission on the sale`) : FREE(),
      priceNote: tr(`العرض مجاني، وعمولة البيع الفوري ${instantPct ? `${pct(instantPct)}٪` : 'مجانًا'}.`, `Listing is free; instant sale commission is ${instantPct ? `${pct(instantPct)}%` : 'free'}.`),
      free: !resalePct && !instantPct, open: s.resaleAuctionOpen || s.instantSaleOpen, closedNote: s.resaleAuctionOpen || s.instantSaleOpen ? undefined : closed(s.saleClosedNote),
    },
    {
      key: 'transfer', icon: 'users', to: '/dashboard/transfers',
      title: tr('نقل ملكية', 'Ownership transfer'),
      desc: tr('انقل اسمًا تملكه إلى مالك مسجّل آخر (بيع خارج المنصة، هبة، إرث)، يقبله المستلم وتعتمده اللجنة.', 'Move a name you own to another registered owner (outside sale, gift, inheritance); the recipient accepts and the committee approves.'),
      price: fee ? sar(fee) : FREE(),
      priceNote: fee ? tr('تُدفع بالبطاقة، شاملة الضريبة.', 'Paid by card, VAT included.') : undefined,
      free: !fee, open: s.transferOpen !== false, closedNote: s.transferOpen !== false ? undefined : closed(s.transferClosedNote),
    },
    {
      key: 'compound', icon: 'plus', to: '/dashboard/names', mine: '/dashboard/requests',
      title: tr('طلب اسم مركب', 'Compound name'),
      desc: tr('أضف اسمًا إلى اسم تملكه، مثل «الفاخر الأول»، ويُعتمد بعد مراجعة اللجنة.', 'Add a name to one you own, such as “Al-Fakher Al-Awwal”, approved after committee review.'),
      price: compoundFee ? tr(`رسوم تسجيل ${sar(compoundFee)}`, `Registration fee ${sar(compoundFee)}`) : FREE(),
      priceNote: compoundFee ? tr('تُدفع بالبطاقة، ويُطلب من بطاقة الاسم في «أسمائي».', 'Paid by card; requested from the name card in “My names”.') : tr('يُطلب من بطاقة الاسم في «أسمائي».', 'Requested from the name card in “My names”.'),
      free: !compoundFee, open: s.compoundOpen, closedNote: s.compoundOpen ? undefined : closed(s.compoundClosedNote),
    },
  ] as Omit<EService, 'terms'>[]).map((x) => ({ ...x, desc: textOf(x.key, x.desc), terms: termsOf(own[x.key] as SettingKey, s, lang) })).map((x) => (soonOf[x.key] ? { ...x, open: false, soon: true, closedNote: undefined } : x))
    // available services first (they start from the right in Arabic), then closed, then «قريبًا»; the original order inside each group
    .map((x, i) => ({ x, i, rank: x.open ? 0 : x.soon ? 2 : 1 })).sort((a, b) => a.rank - b.rank || a.i - b.i).map(({ x }) => x)
}

/** Grid of e-service cards. Public: links go through sign-in unless an owner is signed in. */
export function ServicesGrid({ audience, className = '' }: { audience: 'public' | 'owner'; className?: string }) {
  const { user } = useApp()
  const list = useServices()
  const isOwner = audience === 'owner' || user?.role === 'owner'
  // the same grid on the home page and in the owner's dashboard
  const cols = 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'
  return (
    <ul className={`grid gap-4 ${cols} ${className}`}>
      {list.map((s) => <ServiceCard key={s.key} s={s} isOwner={isOwner} signedIn={!!user} />)}
    </ul>
  )
}

function ServiceCard({ s, isOwner, signedIn }: { s: EService; isOwner: boolean; signedIn: boolean }) {
  const label = tr('تقدّم للخدمة', 'Apply')
  const nav = useNavigate()
  const [terms, setTerms] = useState<null | 'read' | 'apply'>(null)
  const [agree, setAgree] = useState(false)
  const go = () => (isOwner ? nav(s.to) : nav('/login', { state: { from: s.to } }))
  return (
    <li className={`panel group relative flex flex-col overflow-hidden p-5 transition-shadow ${s.open ? 'hover:shadow-lift' : 'opacity-90'}`}>
      <span className={`absolute inset-x-0 top-0 h-1 ${s.open ? 'bg-gold' : 'bg-stone-deep'}`} aria-hidden />
      <div className="flex items-start justify-between gap-3">
        <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${s.open ? 'bg-pine text-gold-light' : 'bg-stone-deep text-muted'}`}>
          <Icon name={s.icon} className="h-6 w-6" />
        </span>
        {s.soon
          ? <span className="pill bg-gold-soft text-gold-deep"><Icon name="clock" className="h-3.5 w-3.5" />{tr('قريبًا', 'Coming soon')}</span>
          : !s.open && <span className="pill bg-stone-deep text-muted"><Icon name="lock" className="h-3.5 w-3.5" />{tr('مغلقة حاليًا', 'Closed now')}</span>}
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

      <button type="button" className="mt-3 flex items-center justify-center gap-1.5 text-[13.5px] font-bold text-gold-deep hover:underline" onClick={() => { setAgree(false); setTerms('read') }}>
        <Icon name="file" className="h-4 w-4" />{tr('الشروط والسياسة', 'Terms and policy')}
      </button>
      {s.open ? (
        <button type="button" className="btn-primary mt-3 w-full" onClick={() => { setAgree(false); setTerms('apply') }}>
          {isOwner || signedIn ? label : tr('سجّل الدخول للتقديم', 'Sign in to apply')}<Icon name="arrow" className="h-4 w-4 rtl:rotate-180" />
        </button>
      ) : (
        <button type="button" disabled className="btn-ghost mt-4 w-full">{s.soon ? tr('قريبًا', 'Coming soon') : label}</button>
      )}
      {/* signed-in owners: «متابعة طلباتي» where it applies, an empty line elsewhere so every card's buttons line up */}
      {isOwner && signedIn && (s.mine && !s.soon
        ? <Link to={s.mine} className="mt-2 h-6 text-center text-[13.5px] font-bold text-pine hover:underline">{tr('متابعة طلباتي', 'Track my requests')}</Link>
        : <span className="mt-2 h-6" aria-hidden />)}
      {terms && (
        <Modal open onClose={() => setTerms(null)} title={tr(`شروط وسياسة خدمة «${s.title}»`, `“${s.title}” terms and policy`)}>
          <div className="space-y-4">
            <div className="rounded-lg bg-stone px-4 py-3">
              <span className="block text-[12px] font-medium text-muted">{tr('رسوم الخدمة', 'Service fee')}</span>
              <span className={`num block font-extrabold ${s.free ? 'text-ok' : 'text-gold-deep'}`}>{s.price}</span>
            </div>
            <ol className="list-decimal space-y-2 ps-5 text-[15px] leading-7">
              {s.terms.map((t, i) => <li key={i}>{t}</li>)}
            </ol>
            {terms === 'apply' && (
              <>
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line p-3 text-[14.5px]">
                  <input type="checkbox" className="mt-1.5" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                  <span>{tr('قرأت شروط الخدمة وسياستها وأوافق عليها.', 'I have read and accept the service terms and policy.')}</span>
                </label>
                <button type="button" className="btn-primary w-full" disabled={!agree} onClick={() => { setTerms(null); go() }}>
                  {isOwner ? tr('أوافق، تابع التقديم', 'Accept and continue') : tr('أوافق، سجّل الدخول للتقديم', 'Accept and sign in to apply')}
                </button>
              </>
            )}
          </div>
        </Modal>
      )}
    </li>
  )
}
