import { RULES } from './config'
import { sar } from './format'
import { tr } from './i18n'
import type { PublicSettings, ServiceKey } from './types'

const pct = (r: number) => `${Math.round(r * 1000) / 10}%`
const hoursText = (h: number) => (h % 24 === 0 ? tr(`${h} ساعة (${h / 24} ${h / 24 === 1 ? 'يوم' : h / 24 === 2 ? 'يومان' : 'أيام'})`, `${h} hours (${h / 24} day${h / 24 === 1 ? '' : 's'})`) : tr(`${h} ساعة`, `${h} hours`))

const WALLET = () => tr(
  'رصيد المحفظة مخصص لسداد الضمانات (ضمان الطلب وضمان دخول المزايدات) فقط، وأي سداد آخر (قيمة الشعار، الرسوم، الشراء) يكون عبر قنوات الدفع: مدى أو البطاقة الائتمانية أو Apple Pay.',
  'The wallet balance pays guarantees only (the request guarantee and auction entry guarantees); every other payment (mark value, fees, purchases) goes through the payment channels: mada, credit card or Apple Pay.')
const REFUND = () => tr('يمكنك طلب استرداد رصيد محفظتك إلى حسابك البنكي المعتمد من صفحة المحفظة، ويُحوَّل بعد موافقة الإدارة المالية.', 'You can request a refund of your wallet balance to your verified bank account from the wallet page; it is transferred once the finance team approves.')

/** the built-in terms of each e-service, from the live prices and rules (the admin can replace them) */
export function defaultTerms(key: ServiceKey, s: PublicSettings): string[] {
  const deposit = s.depositAmount ?? RULES.depositAmount
  const hours = s.paymentDeadlineHours ?? RULES.paymentDeadlineHours
  switch (key) {
    case 'requests': return [
      tr(`تقدّم في الطلب حتى ${RULES.namesPerRequest} أسماء مقترحة، وتعتمد لجنة الاعتماد اسمًا واحدًا منها يُطرح في مزاد علني.`, `Propose up to ${RULES.namesPerRequest} names per request; the Accreditation Committee approves one of them for a public auction.`),
      deposit
        ? tr(`يُدفع مع الطلب مبلغ ضمان قدره ${sar(deposit)} من رصيد المحفظة، لذا اشحن محفظتك بالبطاقة قبل التقديم.`, `A guarantee of ${sar(deposit)} is paid with the request from your wallet balance, so top up your wallet by card before applying.`)
        : tr('لا يُطلب حاليًا مبلغ ضمان مع الطلب.', 'No guarantee is currently required with the request.'),
      tr('يُعاد الضمان كاملًا إلى محفظتك إذا رُفض الطلب أو أُلغي أو سحبته، أو إذا لم يرسُ عليك المزاد.', 'The guarantee returns in full to your wallet if the request is rejected, cancelled or withdrawn, or if you do not win the auction.'),
      tr(`إذا رسا عليك المزاد تُسدّد قيمة الشعار كاملة عبر قنوات الدفع خلال ${hoursText(hours)} من انتهاء المزاد، ويُعاد الضمان إلى محفظتك بعد السداد.`, `If you win, pay the full mark value through the payment channels within ${hoursText(hours)} of the auction ending; the guarantee returns to your wallet after payment.`),
      tr('إن لم تُسدَّد قيمة الشعار في المهلة يُلغى الفوز ويُسحب الشعار ويُخصم مبلغ الضمان كاملًا، ويصبح الاسم ملكًا للمنظمة الدولية للإبل.', 'If the mark value is not paid in time, the win is cancelled, the mark is withdrawn, the guarantee is forfeited in full, and the name passes to the International Camel Organization.'),
      WALLET(), REFUND(),
    ]
    case 'investment': {
      const fee = s.investFee ?? RULES.investFee
      return [
        tr(`اقترح حتى ${RULES.investMaxNames} أسماء جديدة غير مكررة في الطلب الواحد.`, `Propose up to ${RULES.investMaxNames} new, unique names per request.`),
        fee
          ? tr(`رسوم دراسة الطلب ${sar(fee)}، غير مستردة سواء قُبلت الأسماء أو لم تُقبل، وتُدفع عبر قنوات الدفع فقط.`, `The study fee is ${sar(fee)}, non-refundable whether or not the names are accepted, and paid through the payment channels only.`)
          : tr('دراسة الطلب مجانية حاليًا.', 'The study is currently free.'),
        tr(`ما تعتمده اللجنة يُطرح في مزاد عام، ولك ${pct(RULES.investOwnerShare)} من قيمة بيعه قبل الضريبة تُضاف إلى محفظتك.`, `Approved names go to a public auction and you get ${pct(RULES.investOwnerShare)} of the sale before VAT, added to your wallet.`),
        tr('إن لم يزايد أحد على الاسم يؤول إليك دون نسبة.', 'If nobody bids on a name, it passes to you without the share.'),
        WALLET(),
      ]
    }
    case 'resale':
    case 'instant': {
      const rp = s.resaleCommission ?? RULES.resaleCommission
      const ip = s.instantCommission ?? RULES.instantCommission
      return [
        tr(`مزاد إعادة البيع: يُعلن عنه قبل ${RULES.resaleNoticeHours} ساعة ويستمر ${RULES.resaleAuctionDays} أيام، بحد أدنى تحدده أنت.`, `Resale auction: announced ${RULES.resaleNoticeHours} hours ahead and runs ${RULES.resaleAuctionDays} days, with a reserve you set.`),
        tr(`البيع الفوري: يُعرض الاسم بسعر ثابت لمدة ${RULES.instantSaleHours} ساعة، ويشتريه أول من يسدّد.`, `Instant sale: the name is listed at a fixed price for ${RULES.instantSaleHours} hours and goes to the first buyer who pays.`),
        tr(`عمولة المنصة ${rp ? pct(rp) : 'مجانًا'} من قيمة البيع بالمزاد و${ip ? pct(ip) : 'مجانًا'} في البيع الفوري، ويُضاف صافي البيع إلى محفظتك.`, `The platform commission is ${rp ? pct(rp) : 'free'} of an auction sale and ${ip ? pct(ip) : 'free'} of an instant sale; the net amount is added to your wallet.`),
        tr('يدفع كل مزايد ضمان دخول من محفظته، ويُعاد لمن لم يرسُ عليه.', 'Every bidder pays an entry guarantee from their wallet, returned to whoever does not win.'),
        tr('لا يُعرض اسم عليه فاتورة غير مسددة أو مزاد قائم أو طلب نقل ملكية.', 'A name with an unpaid invoice, a running auction or an open transfer request cannot be listed.'),
        WALLET(),
      ]
    }
    case 'transfer': {
      const fee = s.transferFee ?? 0
      return [
        tr('يُنقل الاسم إلى مالك مسجل في سمّها برقم جواله، ويجب أن يوافق المستلم على النقل ثم تعتمده لجنة الاعتماد.', 'The name moves to an owner registered on Sammha by their mobile number; the recipient must accept, then the Accreditation Committee approves.'),
        fee
          ? tr(`رسوم النقل ${sar(fee)} شاملة الضريبة، تُدفع عبر قنوات الدفع فقط، وتُعاد إلى محفظتك إن رفض المستلم أو اللجنة أو ألغيت الطلب.`, `The transfer fee is ${sar(fee)} incl. VAT, paid through the payment channels only, and returned to your wallet if the recipient or the committee declines or you cancel.`)
          : tr('النقل مجاني حاليًا.', 'Transfers are currently free.'),
        tr('لا يُنقل اسم معروض للبيع أو عليه مزاد قائم أو فاتورة غير مسددة.', 'A name that is on sale, being auctioned or has an unpaid invoice cannot be transferred.'),
        tr('بعد النقل تصبح شهاداتك السابقة التي تشمل الاسم غير سارية، ويُحذف لوجو الشعار ليرفع المالك الجديد لوجوه.', 'After the transfer, your earlier certificates that include the name are no longer valid, and the mark logo is removed so the new owner can upload theirs.'),
      ]
    }
    case 'compound': {
      const fee = s.compoundFee ?? 0
      return [
        tr('يتكون الاسم المركب من اسم تملكه مع كلمة أخرى، مثل «الفاخر الأول»، ويُطلب من بطاقة الاسم في «أسمائي».', 'A compound name is a name you own plus another word, such as “Al-Fakher Al-Awwal”; request it from the name card in “My names”.'),
        tr('يُعتمد بعد مراجعة لجنة الاعتماد دون مزاد، ويُشترط أن يكون الاسم الأساسي مسددًا ومسجلًا باسمك.', 'It is approved by the Accreditation Committee without an auction; the base name must be paid for and registered to you.'),
        fee
          ? tr(`رسوم التسجيل ${sar(fee)} غير مستردة، وتُدفع عبر قنوات الدفع فقط.`, `The registration fee is ${sar(fee)}, non-refundable, paid through the payment channels only.`)
          : tr('التسجيل مجاني حاليًا.', 'Registration is currently free.'),
      ]
    }
  }
}

/** the admin's terms (one per line) or the built-in ones */
export function termsOf(key: ServiceKey, s: PublicSettings, lang: string): string[] {
  const t = s.serviceTexts?.[key]
  const own = (lang === 'en' ? t?.termsEn || t?.termsAr : t?.termsAr || t?.termsEn)?.trim()
  if (own) return own.split('\n').map((l) => l.replace(/^\s*[•\-*–]\s*/, '').trim()).filter(Boolean)
  return defaultTerms(key, s)
}
