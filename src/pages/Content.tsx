import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { RULES, SELLER } from '../lib/config'
import { getLang, tr } from '../lib/i18n'
import { openingText } from '../lib/format'

export function PageBand({ title, sub }: { title: string; sub?: string }) {
  return (
    <section className="hero-field text-paper">
      <div className="wrap py-12">
        <h1 className="text-[34px] font-extrabold text-paper sm:text-[42px]">{title}</h1>
        {sub && <p className="mt-2 max-w-2xl text-[17px] text-paper/75">{sub}</p>}
      </div>
      <div className="h-1 bg-gold" aria-hidden />
    </section>
  )
}

function Doc({ children }: { children: ReactNode }) {
  return (
    <div className="wrap py-12">
      {getLang() === 'en' && <p className="mx-auto mb-4 max-w-3xl rounded-md border border-gold/40 bg-gold-soft px-4 py-3 text-[15px]">This is an English translation for convenience. The Arabic version is the authoritative one.</p>}
      <article dir={getLang() === 'ar' ? 'rtl' : 'ltr'} lang={getLang()} className="panel mx-auto max-w-3xl space-y-6 p-6 text-[16px] leading-8 sm:p-10 [&_h2]:mt-2 [&_h2]:text-[21px] [&_li]:mt-1.5 [&_ol]:list-decimal [&_ol]:ps-6 [&_ul]:list-disc [&_ul]:ps-6">
        {children}
      </article>
    </div>
  )
}

const UPDATED = () => tr('آخر تحديث: أكتوبر 2026', 'Last updated: October 2026')

/** built on each visit, so the admin's current fees and prices show */
const FAQ = (): [string, ReactNode][] => [
  ['ما منصة سمّها؟', 'منصة تابعة للمنظمة الدولية للإبل لتنظيم أسماء الشعارات الخاصة بمنقيات وفرديات الإبل، وطرحها في مزاد علني، وتسجيلها باسم أصحابها.'],
  ['ما فئات الشعارات؟', 'فئتان: «فردي» (مفاريد) لاسم ناقة أو جمل بعينه، ويشمل البكار (أسماء الإناث) والقعدان (أسماء الذكور)؛ و«منقية» لاسم مجموعة من الإبل. لكل نوع لون في المنصة: القعدان بنفسجي، والبكار أخضر، والمنقية ذهبي.'],
  ['كيف أطلب اسمًا لإبلي؟', `أنشئ حسابًا، ثم من لوحة التحكم اختر «طلب شعار جديد»، وحدّد النوع واكتب ${RULES.namesPerRequest} أسماء مقترحة، ثم سدّد ضمان المزاد.`],
  ['كم اسمًا يُقبل من الطلب الواحد؟', `اسم واحد فقط. تكتب ${RULES.namesPerRequest} أسماء مقترحة لتزيد فرصة القبول، وتقبل لجنة الاعتماد شعارًا واحدًا منها يُطرح في المزاد، وتُرفض البقية تلقائيًا.`],
  ['لماذا رُفض الاسم الذي كتبته فورًا؟', 'لأنه مطابق تمامًا لاسم مسجل أو لاسم في طلب أو مزاد قائم. غيّر الاسم أو جرّب صيغة مختلفة. الأسماء الشبيهة تُقبل مبدئيًا وتراجعها لجنة الاعتماد.'],
  ['كم ضمان المزاد ومتى يعود؟', `الضمان ${RULES.depositAmount} ⃁، يدفعه مقدم الطلب مع طلبه، ويدفعه كل مزايد آخر لدخول المزاد. يعود إلى محفظتك إذا رُفض الطلب أو أُلغي، أو إذا رسا الاسم على غيرك. وإذا رسا عليك تسدّد قيمة الشعار كاملة خلال ${RULES.paymentDeadlineHours} ساعة ثم يعود ضمانك، وإن لم تسدّد في المهلة يُلغى فوزك ويُخصم الضمان ويصبح الاسم ملكًا للمنظمة الدولية للإبل.`],
  ['كيف تعمل المزايدة؟', `يبدأ كل اسم بسعر افتتاحي ${openingText()}، وأقل زيادة ${RULES.minIncrement} ⃁. المزايدة في آخر ${RULES.extendMinutes} دقيقة تمدّد المزاد ${RULES.extendMinutes} دقيقة حتى لا يُحسم بمزايدة خاطفة.`],
  ['ماذا يحدث إن لم يزايد أحد على الاسم؟', `يرسو الاسم على مقدم الطلب بالسعر الافتتاحي ${openingText()}، ويسدّده خلال ${RULES.paymentDeadlineHours} ساعة ثم يعود ضمانه.`],
  ['متى أستلم الفاتورة والشهادة؟', 'تصدر الفاتورة الإلكترونية فور ترسية المزاد، وتجدها في «الفواتير». وبعد السداد تجد شهادة تسجيل الاسم في «أسمائي»، وعليها رمز QR يتحقق منه أي شخص.'],
  ['ما خدمة «استثمار الاسم»؟', <>تقترح حتى {RULES.investMaxNames} أسماء جديدة مبتكرة في الطلب برسوم دراسة {RULES.investFee} ⃁ غير مستردة. ما تعتمده اللجنة يُطرح في مزاد عام، ولك {Math.round(RULES.investOwnerShare * 100)}% من قيمة بيعه قبل الضريبة، وإن لم يزايد أحد يؤول إليك. <Link to="/invest" className="font-bold text-gold-deep underline">التفاصيل</Link></>],
  ['هل يمكنني بيع الاسم أو نقله؟', 'بعد ربط الاسم بشريحة إلكترونية لا يحق بيعه أو استخدامه على فردي أو فردية أخرى، ويجب أن يرتبط اسم المتن باسم المشارك نفسه.'],
  ['كيف أتواصل مع المنصة؟', <>عبر صفحة <Link to="/contact" className="font-bold text-gold-deep underline">تواصل معنا</Link>، أو البريد {SELLER.email}، أو واتساب {SELLER.whatsapp.replace(/^966/, '0')}.</>],
]

const FAQ_EN = (): [string, string][] => [
  ['What is Sammha?', 'A platform of the International Camel Organization that organises camel names and brand marks, auctions them publicly and registers them to their owners.'],
  ['What are the name categories?', 'Two families: “Single” (mafareed) for one camel, covering Bakkar (female names) and Qaadan (male names); and “Manqiya” for a herd. Qaadan appear in purple, Bakkar in green and Manqiya in gold.'],
  ['How do I request a name?', `Create an account, choose “New request” in your dashboard, pick the type, enter ${RULES.namesPerRequest} proposed names and pay the auction guarantee.`],
  ['How many names are accepted per request?', `Only one. You enter ${RULES.namesPerRequest} proposed names to raise your chances; the Accreditation Committee accepts one of them for auction and the rest are declined automatically.`],
  ['Why was my name rejected immediately?', 'It is identical to a registered name or to a name in an active request or auction. Similar names are accepted for review by the committee.'],
  ['How much is the guarantee and when is it refunded?', `⃁ ${RULES.depositAmount}. The requester pays it with the request, and every other bidder pays it to enter the auction. It returns to your wallet if the request is declined or cancelled, or if someone else wins the name. If you win, pay the full price within ${RULES.paymentDeadlineHours} hours and it is returned; if you do not pay in time, the win is cancelled, the guarantee is forfeited and the name passes to the International Camel Organization.`],
  ['How does bidding work?', `Each name opens at ${openingText()} with a minimum raise of ⃁ ${RULES.minIncrement}. A bid in the last ${RULES.extendMinutes} minutes extends the auction by ${RULES.extendMinutes} minutes.`],
  ['What if nobody bids?', `The name goes to the requester at the opening price of ${openingText()}, payable within ${RULES.paymentDeadlineHours} hours; then their guarantee is returned.`],
  ['When do I get the invoice and certificate?', 'The e-invoice is issued as soon as the auction is awarded. After payment, the registration certificate with a verifiable QR code is in “My names”.'],
  ['What is «Name investment»?', `Propose up to ${RULES.investMaxNames} new, original names per request for a non-refundable ⃁ ${RULES.investFee} study fee. Approved names go to a public auction and you get ${Math.round(RULES.investOwnerShare * 100)}% of the sale before VAT; if nobody bids, the name is yours.`],
  ['Can I sell or transfer a name?', 'Once linked to a microchip, a name may not be sold or used on another camel, and must be linked to the participant’s own name.'],
  ['How do I contact you?', `Through the contact page, by email at ${SELLER.email}, or WhatsApp ${SELLER.whatsapp.replace(/^966/, '0')}.`],
]

export function Faq() {
  const items: [string, ReactNode][] = getLang() === 'ar' ? FAQ() : FAQ_EN()
  return (
    <>
      <PageBand title={tr('الأسئلة الشائعة', 'Frequently asked questions')} sub={tr('إجابات مختصرة عن طلب الأسماء والمزادات والضمان والفواتير.', 'Short answers about name requests, auctions, the guarantee and invoices.')} />
      <div className="wrap py-12">
        <div className="mx-auto max-w-3xl space-y-3">
          {items.map(([q, a]) => (
            <details key={q} className="panel group p-0 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer items-center justify-between gap-4 px-6 py-4 text-[17px] font-extrabold">
                {q}
                <span className="text-xl text-gold transition-transform group-open:rotate-45" aria-hidden>+</span>
              </summary>
              <div className="border-t border-line px-6 py-4 text-[16px] leading-8 text-ink/85">{a}</div>
            </details>
          ))}
        </div>
      </div>
    </>
  )
}

export function Terms() {
  return (
    <>
      <PageBand title={tr('الشروط والأحكام', 'Terms and conditions')} sub={UPDATED()} />
      <Doc>
        <p>{tr('باستخدامك منصة سمّها فإنك توافق على هذه الشروط. تُدار المنصة من المنظمة الدولية للإبل، ويُشار إليها فيما يلي بـ«المنصة».', 'By using Sammha you agree to these terms. The platform is operated by the International Camel Organization (ICO), referred to below as "the platform".')}</p>
        <h2>{tr('الحساب', 'Account')}</h2>
        <ul>
          <li>{tr('يجب أن تكون بيانات التسجيل صحيحة ومطابقة لهوية المالك.', "Registration details must be accurate and match the owner's identity.")}</li>
          <li>{tr('أنت مسؤول عن سرية كلمة المرور وعن كل ما يتم من خلال حسابك.', 'You are responsible for keeping your password confidential and for all activity on your account.')}</li>
        </ul>
        <h2>{tr('طلب الأسماء', 'Requesting names')}</h2>
        <ul>
          <li>{tr(`يُقدَّم كل طلب بعدد ${RULES.namesPerRequest} أسماء من نوع واحد (قعدان أو بكار).`, `Each request contains ${RULES.namesPerRequest} names of one type (Qaadan or Bakkar).`)}</li>
          <li>{tr('لا يُقبل اسم مطابق تمامًا لاسم مسجل أو قيد الطلب أو المزاد.', 'A name identical to a registered name, or to one in an active request or auction, is not accepted.')}</li>
          <li>{tr('للجنة الاعتماد قبول أي اسم أو رفضه، ومنها الأسماء الشبيهة أو المخالفة للذوق العام، وقرارها نهائي.', 'The Accreditation Committee may accept or reject any name, including similar names or names contrary to public taste, and its decision is final.')}</li>
        </ul>
        <h2>{tr('ضمان المزاد', 'Auction guarantee')}</h2>
        <ul>
          <li>{tr(`يُسدَّد ضمان قدره ${RULES.depositAmount} ⃁ مع كل طلب قبل وصوله إلى اللجنة.`, `A guarantee of ⃁ ${RULES.depositAmount} is paid with each request before it reaches the committee.`)}</li>
          <li>{tr('يُعاد الضمان إلى محفظة المالك عند رفض الطلب أو إلغائه، أو عند ترسية جميع أسمائه على غيره.', "The guarantee returns to the owner's wallet if the request is rejected or cancelled, or if all its names are won by others.")}</li>
          <li>{tr('إذا رسا على مقدم الطلب اسم من طلبه يُخصم الضمان من قيمة فاتورته.', 'If the applicant wins a name from their own request, the guarantee is deducted from its invoice.')}</li>
        </ul>
        <h2>{tr('المزايدة والترسية', 'Bidding and award')}</h2>
        <ul>
          <li>{tr(`السعر الافتتاحي ${openingText()}، وأقل زيادة ${RULES.minIncrement} ⃁، والمواعيد بتوقيت الرياض.`, `The opening price is ${openingText()}, the minimum raise is ⃁ ${RULES.minIncrement}, and all times are Riyadh time.`)}</li>
          <li>{tr('المزايدة التزام بالشراء ولا يجوز سحبها.', 'A bid is a commitment to buy and cannot be withdrawn.')}</li>
          <li>{tr(`المزايدة في آخر ${RULES.extendMinutes} دقيقة تمدّد المزاد ${RULES.extendMinutes} دقيقة.`, `A bid in the last ${RULES.extendMinutes} minutes extends the auction by ${RULES.extendMinutes} minutes.`)}</li>
          <li>{tr('يرسو الاسم على أعلى مزايد عند انتهاء الوقت، وإن لم تُسجل مزايدات يرسو على مقدم الطلب بالسعر الافتتاحي.', 'The name goes to the highest bidder when time runs out; with no bids it goes to the requester at the opening price.')}</li>
          <li>{tr('تصدر للفائز فاتورة ضريبية إلكترونية، والأسعار شاملة ضريبة القيمة المضافة 15%.', 'The winner receives an electronic tax invoice. Prices include 15% VAT.')}</li>
        </ul>
        <h2>{tr('ربط الأسماء', 'Linking names')}</h2>
        <ol>
          <li>{tr('يجب أن يكون الاسم مرتبطًا بشريحة إلكترونية للمشاركة في المهرجانات والفعاليات.', 'A name must be linked to a microchip to take part in festivals and events.')}</li>
          <li>{tr('لا يحق بيع الاسم أو استخدامه على فردي أو فردية أخرى بعد ربطه بشريحة.', 'Once linked to a microchip, a name may not be sold or used on another camel.')}</li>
          <li>{tr('يجب أن يرتبط اسم المتن باسم المشارك نفسه.', "The name must be linked to the participant's own name.")}</li>
        </ol>
        <h2>{tr('إساءة الاستخدام', 'Misuse')}</h2>
        <p>{tr('للمنصة إيقاف أي حساب يتلاعب بالمزايدات أو يقدّم بيانات غير صحيحة، وإلغاء ما ترتب على ذلك من ترسية.', 'The platform may suspend any account that manipulates bids or provides false information, and cancel any resulting award.')}</p>
      </Doc>
    </>
  )
}

export function Privacy() {
  return (
    <>
      <PageBand title={tr('سياسة الخصوصية', 'Privacy policy')} sub={UPDATED()} />
      <Doc>
        <p>{tr('نلتزم بحماية بياناتك الشخصية وفق نظام حماية البيانات الشخصية في المملكة العربية السعودية.', "We protect your personal data in line with Saudi Arabia's Personal Data Protection Law.")}</p>
        <h2>{tr('البيانات التي نجمعها', 'Data we collect')}</h2>
        <ul>
          <li>{tr('بيانات الحساب: الاسم، رقم الجوال، البريد الإلكتروني، ورقم الهوية إن أدخلته.', 'Account data: name, mobile number, email, and ID number if you provide it.')}</li>
          <li>{tr('بيانات الاستخدام: الطلبات والمزايدات والمدفوعات والفواتير.', 'Usage data: requests, bids, payments and invoices.')}</li>
        </ul>
        <h2>{tr('كيف نستخدمها', 'How we use it')}</h2>
        <ul>
          <li>{tr('إدارة حسابك وطلباتك ومزايداتك وإصدار الفواتير والشهادات.', 'To manage your account, requests and bids, and to issue invoices and certificates.')}</li>
          <li>{tr('إرسال التنبيهات المتعلقة بمزايداتك وطلباتك عبر المنصة والبريد والرسائل.', 'To send notifications about your bids and requests on the platform, by email and by message.')}</li>
          <li>{tr('الوفاء بالمتطلبات النظامية، ومنها الفوترة الإلكترونية.', 'To meet regulatory requirements, including e-invoicing.')}</li>
        </ul>
        <h2>{tr('ما يظهر للعامة', 'What is public')}</h2>
        <p>{tr('يظهر في سجل الأسماء اسم الشعار واسم مالكه وتاريخ تسجيله. وتظهر المزايدات في صفحات المزاد باسم مختصر لا يكشف هوية المزايد كاملة.', "The names registry shows the mark name, its owner's name and its registration date. Bids appear on auction pages under a shortened name that does not fully reveal the bidder's identity.")}</p>
        <h2>{tr('المشاركة مع الغير', 'Sharing with third parties')}</h2>
        <p>{tr('لا نبيع بياناتك. نشاركها فقط مع مزودي الخدمة اللازمين لتشغيل المنصة، مثل بوابة الدفع، وفي حدود ما يتطلبه النظام.', 'We do not sell your data. We share it only with service providers needed to run the platform, such as the payment gateway, and as required by law.')}</p>
        <h2>{tr('حقوقك', 'Your rights')}</h2>
        <p>{tr('يحق لك طلب الاطلاع على بياناتك أو تصحيحها أو حذفها بما لا يتعارض مع المتطلبات النظامية، عبر', 'You may request access to, correction of or deletion of your data, subject to regulatory requirements, by writing to')} {SELLER.email}.</p>
      </Doc>
    </>
  )
}

export function Refund() {
  return (
    <>
      <PageBand title={tr('سياسة الاسترداد', 'Refund policy')} sub={UPDATED()} />
      <Doc>
        <h2>{tr('ضمان المزاد', 'Auction guarantee')}</h2>
        <ul>
          <li>{tr(`يُعاد ضمان المزاد (${RULES.depositAmount} ⃁) تلقائيًا إلى محفظتك في الحالات الآتية: رفض الطلب، إلغاء الطلب قبل مراجعته، إلغاء اللجنة للطلب، أو ترسية جميع أسماء الطلب على غيرك.`, `The auction guarantee (⃁ ${RULES.depositAmount}) is returned to your wallet automatically if the request is rejected, you cancel it before review, the committee cancels it, or all of its names are won by others.`)}</li>
          <li>{tr(`إذا رسا عليك الاسم يُعاد الضمان بعد سداد قيمته كاملة خلال ${RULES.paymentDeadlineHours} ساعة، ولا يُعاد إن لم تسدّد في المهلة، ويصبح الاسم حينها ملكًا للمنظمة الدولية للإبل.`, `If you win, the guarantee is returned after you pay the full price within ${RULES.paymentDeadlineHours} hours; it is not returned if you do not pay in time, and the name then passes to the International Camel Organization.`)}</li>
        </ul>
        <h2>{tr('رصيد المحفظة', 'Wallet balance')}</h2>
        <p>{tr('يُستخدم رصيد المحفظة لسداد الضمانات فقط (ضمان طلب الشعار وضمان دخول المزاد)، أما قيمة الشعار والمشتريات والرسوم فتُسدَّد من قنوات الدفع (البطاقة وApple Pay). ويمكنك طلب استرداد رصيدك إلى حسابك البنكي المعتمد من صفحة المحفظة، ويُحوَّل بعد موافقة الإدارة المالية.', 'The wallet balance pays guarantees only (the mark request guarantee and auction entry guarantees); mark values, purchases and fees are paid through the payment channels (card and Apple Pay). You can request a refund of your balance to your verified bank account from the wallet page; it is transferred once the finance team approves.')}</p>
        <h2>{tr('قيمة الاسم بعد الترسية', 'Name price after award')}</h2>
        <p>{tr('المزايدة الفائزة التزام بالشراء، ولا تُسترد قيمة الاسم بعد سدادها إلا إذا ألغت المنصة الترسية لخطأ من جهتها.', 'A winning bid is a commitment to buy. The price of a name is not refunded after payment unless the platform cancels the award due to its own error.')}</p>
      </Doc>
    </>
  )
}
