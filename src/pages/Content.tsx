import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { RULES, SELLER } from '../lib/config'
import { getLang, tr } from '../lib/i18n'

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
      {getLang() === 'en' && <p className="mx-auto mb-4 max-w-3xl rounded-md border border-gold/40 bg-gold-soft px-4 py-3 text-[15px]">This document is published in Arabic, which is the authoritative version. An English translation will follow.</p>}
      <article dir="rtl" lang="ar" className="panel mx-auto max-w-3xl space-y-6 p-6 text-[16px] leading-8 sm:p-10 [&_h2]:mt-2 [&_h2]:text-[21px] [&_li]:mt-1.5 [&_ol]:list-decimal [&_ol]:ps-6 [&_ul]:list-disc [&_ul]:ps-6">
        {children}
      </article>
    </div>
  )
}

const UPDATED = () => tr('آخر تحديث: أكتوبر 2026', 'Last updated: October 2026')

const FAQ: [string, ReactNode][] = [
  ['ما منصة سمّها؟', 'منصة تابعة للمنظمة الدولية للإبل لتنظيم أسماء الشعارات الخاصة بمنقيات وفرديات الإبل، وطرحها في مزاد علني، وتسجيلها باسم أصحابها.'],
  ['ما الفرق بين القعدان والبكار؟', 'القعدان أسماء الذكور من الإبل، والبكار أسماء الإناث. لكل نوع لون مميز في المنصة: الأزرق للقعدان والعنابي للبكار.'],
  ['كيف أطلب اسمًا لإبلي؟', `أنشئ حسابًا، ثم من لوحة التحكم اختر «طلب شعار جديد»، وحدّد النوع واكتب ${RULES.namesPerRequest} أسماء مقترحة، ثم سدّد ضمان المزاد.`],
  ['لماذا رُفض الاسم الذي كتبته فورًا؟', 'لأنه مطابق تمامًا لاسم مسجل أو لاسم في طلب أو مزاد قائم. غيّر الاسم أو جرّب صيغة مختلفة. الأسماء الشبيهة تُقبل مبدئيًا وتراجعها لجنة الاعتماد.'],
  ['كم ضمان المزاد ومتى يعود؟', `ضمان المزاد ${RULES.depositAmount} ريال لكل طلب. يعود إلى محفظتك إذا رُفض الطلب أو أُلغي، أو إذا رست كل أسماء الطلب على مزايدين آخرين. وإذا رسا عليك اسم من طلبك يُخصم الضمان من فاتورته.`],
  ['كيف تعمل المزايدة؟', `يبدأ كل اسم بسعر افتتاحي ${RULES.openingPrice} ريال، وأقل زيادة ${RULES.minIncrement} ريال. المزايدة في آخر ${RULES.extendMinutes} دقيقة تمدّد المزاد ${RULES.extendMinutes} دقيقة حتى لا يُحسم بمزايدة خاطفة.`],
  ['ماذا يحدث إن لم يزايد أحد على الاسم؟', 'يرسو الاسم على مقدم الطلب بمبلغ الضمان نفسه، ويُسجّل باسمه.'],
  ['متى أستلم الفاتورة والشهادة؟', 'تصدر الفاتورة الإلكترونية فور ترسية المزاد، وتجدها في «الفواتير». وبعد السداد تجد شهادة تسجيل الاسم في «أسمائي»، وعليها رمز QR يتحقق منه أي شخص.'],
  ['هل يمكنني بيع الاسم أو نقله؟', 'بعد ربط الاسم بشريحة إلكترونية لا يحق بيعه أو استخدامه على فردي أو فردية أخرى، ويجب أن يرتبط اسم المتن باسم المشارك نفسه.'],
  ['كيف أتواصل مع المنصة؟', <>عبر صفحة <Link to="/contact" className="font-bold text-gold-deep underline">تواصل معنا</Link>، أو البريد {SELLER.email}، أو واتساب {SELLER.whatsapp.replace(/^966/, '0')}.</>],
]

const FAQ_EN: [string, string][] = [
  ['What is Sammha?', 'A platform of the International Camel Organization that organises camel names and brand marks, auctions them publicly and registers them to their owners.'],
  ['What is the difference between Qaadan and Bakkar?', 'Qaadan are names for male camels and Bakkar for female camels. Qaadan appear in blue and Bakkar in maroon.'],
  ['How do I request a name?', `Create an account, choose “New request” in your dashboard, pick the type, enter ${RULES.namesPerRequest} proposed names and pay the auction guarantee.`],
  ['Why was my name rejected immediately?', 'It is identical to a registered name or to a name in an active request or auction. Similar names are accepted for review by the committee.'],
  ['How much is the guarantee and when is it refunded?', `SAR ${RULES.depositAmount} per request. It returns to your wallet if the request is declined or cancelled, or if all its names are won by others. If you win a name from your own request it is deducted from that invoice.`],
  ['How does bidding work?', `Each name opens at SAR ${RULES.openingPrice} with a minimum raise of SAR ${RULES.minIncrement}. A bid in the last ${RULES.extendMinutes} minutes extends the auction by ${RULES.extendMinutes} minutes.`],
  ['What if nobody bids?', 'The name goes to the applicant for the guarantee amount.'],
  ['When do I get the invoice and certificate?', 'The e-invoice is issued as soon as the auction is awarded. After payment, the registration certificate with a verifiable QR code is in “My names”.'],
  ['Can I sell or transfer a name?', 'Once linked to a microchip, a name may not be sold or used on another camel, and must be linked to the participant’s own name.'],
  ['How do I contact you?', `Through the contact page, by email at ${SELLER.email}, or WhatsApp ${SELLER.whatsapp.replace(/^966/, '0')}.`],
]

export function Faq() {
  const items: [string, ReactNode][] = getLang() === 'ar' ? FAQ : FAQ_EN
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
        <p>باستخدامك منصة سمّها فإنك توافق على هذه الشروط. تُدار المنصة من المنظمة الدولية للإبل، ويُشار إليها فيما يلي بـ«المنصة».</p>
        <h2>الحساب</h2>
        <ul>
          <li>يجب أن تكون بيانات التسجيل صحيحة ومطابقة لهوية المالك.</li>
          <li>أنت مسؤول عن سرية كلمة المرور وعن كل ما يتم من خلال حسابك.</li>
        </ul>
        <h2>طلب الأسماء</h2>
        <ul>
          <li>يُقدَّم كل طلب بعدد {RULES.namesPerRequest} أسماء من نوع واحد (قعدان أو بكار).</li>
          <li>لا يُقبل اسم مطابق تمامًا لاسم مسجل أو قيد الطلب أو المزاد.</li>
          <li>للجنة الاعتماد قبول أي اسم أو رفضه، ومنها الأسماء الشبيهة أو المخالفة للذوق العام، وقرارها نهائي.</li>
        </ul>
        <h2>ضمان المزاد</h2>
        <ul>
          <li>يُسدَّد ضمان قدره {RULES.depositAmount} ريال مع كل طلب قبل وصوله إلى اللجنة.</li>
          <li>يُعاد الضمان إلى محفظة المالك عند رفض الطلب أو إلغائه، أو عند ترسية جميع أسمائه على غيره.</li>
          <li>إذا رسا على مقدم الطلب اسم من طلبه يُخصم الضمان من قيمة فاتورته.</li>
        </ul>
        <h2>المزايدة والترسية</h2>
        <ul>
          <li>السعر الافتتاحي {RULES.openingPrice} ريال، وأقل زيادة {RULES.minIncrement} ريال، والمواعيد بتوقيت الرياض.</li>
          <li>المزايدة التزام بالشراء ولا يجوز سحبها.</li>
          <li>المزايدة في آخر {RULES.extendMinutes} دقيقة تمدّد المزاد {RULES.extendMinutes} دقيقة.</li>
          <li>يرسو الاسم على أعلى مزايد عند انتهاء الوقت، وإن لم تُسجل مزايدات يرسو على مقدم الطلب بمبلغ الضمان.</li>
          <li>تصدر للفائز فاتورة ضريبية إلكترونية، والأسعار شاملة ضريبة القيمة المضافة 15%.</li>
        </ul>
        <h2>ربط الأسماء</h2>
        <ol>
          <li>يجب أن يكون الاسم مرتبطًا بشريحة إلكترونية للمشاركة في المهرجانات والفعاليات.</li>
          <li>لا يحق بيع الاسم أو استخدامه على فردي أو فردية أخرى بعد ربطه بشريحة.</li>
          <li>يجب أن يرتبط اسم المتن باسم المشارك نفسه.</li>
        </ol>
        <h2>إساءة الاستخدام</h2>
        <p>للمنصة إيقاف أي حساب يتلاعب بالمزايدات أو يقدّم بيانات غير صحيحة، وإلغاء ما ترتب على ذلك من ترسية.</p>
      </Doc>
    </>
  )
}

export function Privacy() {
  return (
    <>
      <PageBand title={tr('سياسة الخصوصية', 'Privacy policy')} sub={UPDATED()} />
      <Doc>
        <p>نلتزم بحماية بياناتك الشخصية وفق نظام حماية البيانات الشخصية في المملكة العربية السعودية.</p>
        <h2>البيانات التي نجمعها</h2>
        <ul>
          <li>بيانات الحساب: الاسم، رقم الجوال، البريد الإلكتروني، ورقم الهوية إن أدخلته.</li>
          <li>بيانات الاستخدام: الطلبات والمزايدات والمدفوعات والفواتير.</li>
        </ul>
        <h2>كيف نستخدمها</h2>
        <ul>
          <li>إدارة حسابك وطلباتك ومزايداتك وإصدار الفواتير والشهادات.</li>
          <li>إرسال التنبيهات المتعلقة بمزايداتك وطلباتك عبر المنصة والبريد والرسائل.</li>
          <li>الوفاء بالمتطلبات النظامية، ومنها الفوترة الإلكترونية.</li>
        </ul>
        <h2>ما يظهر للعامة</h2>
        <p>يظهر في سجل الأسماء اسم الشعار واسم مالكه وتاريخ تسجيله. وتظهر المزايدات في صفحات المزاد باسم مختصر لا يكشف هوية المزايد كاملة.</p>
        <h2>المشاركة مع الغير</h2>
        <p>لا نبيع بياناتك. نشاركها فقط مع مزودي الخدمة اللازمين لتشغيل المنصة، مثل بوابة الدفع، وفي حدود ما يتطلبه النظام.</p>
        <h2>حقوقك</h2>
        <p>يحق لك طلب الاطلاع على بياناتك أو تصحيحها أو حذفها بما لا يتعارض مع المتطلبات النظامية، عبر {SELLER.email}.</p>
      </Doc>
    </>
  )
}

export function Refund() {
  return (
    <>
      <PageBand title={tr('سياسة الاسترداد', 'Refund policy')} sub={UPDATED()} />
      <Doc>
        <h2>ضمان المزاد</h2>
        <ul>
          <li>يُعاد ضمان المزاد ({RULES.depositAmount} ريال) تلقائيًا إلى محفظتك في الحالات الآتية: رفض الطلب، إلغاء الطلب قبل مراجعته، إلغاء اللجنة للطلب، أو ترسية جميع أسماء الطلب على غيرك.</li>
          <li>لا يُعاد الضمان إذا رسا عليك اسم من طلبك، إذ يُخصم من فاتورته.</li>
        </ul>
        <h2>رصيد المحفظة</h2>
        <p>يمكنك استخدام رصيد المحفظة في طلبات ومدفوعات لاحقة، أو طلب تحويله إلى حسابك البنكي عبر التواصل معنا، ويُعالج الطلب خلال 7 أيام عمل.</p>
        <h2>قيمة الاسم بعد الترسية</h2>
        <p>المزايدة الفائزة التزام بالشراء، ولا تُسترد قيمة الاسم بعد سدادها إلا إذا ألغت المنصة الترسية لخطأ من جهتها.</p>
      </Doc>
    </>
  )
}

