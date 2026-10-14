import { Link } from 'react-router-dom'
import { RULES } from '../lib/config'
import { tr } from '../lib/i18n'

export default function About() {
  return (
    <>
      <section className="relative overflow-hidden bg-pine text-paper">
        <img src="./hero/festival-white.webp" alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" style={{ objectPosition: 'center 35%' }} />
        <div className="absolute inset-0 bg-gradient-to-t from-pine via-pine/60 to-pine/20" />
        <div className="wrap relative py-16 sm:py-20">
          <p className="text-[15px] font-bold text-gold-light">{tr('عن المنصة', 'About')}</p>
          <h1 className="mt-2 max-w-2xl text-[38px] font-extrabold leading-tight text-paper sm:text-[48px]">{tr('سمّها لأسماء الإبل الدولية', 'Sammha, the international camel names registry')}</h1>
          <p className="mt-4 max-w-2xl text-[17px] leading-8 text-paper/80">
            {tr('منصة إلكترونية عالمية تابعة للمنظمة الدولية للإبل، تُعنى بتنظيم الأسماء والشعارات المتعلقة بمنقيات وفرديات الإبل، وإقامة مزاداتها وتسجيلها واعتمادها لصالح أصحابها على المستوى المحلي والعالمي.',
              'A global platform of the International Camel Organization that organises the names and brand marks of camels, runs their auctions, and registers and certifies them to their owners locally and internationally.')}
          </p>
        </div>
        <div className="relative h-1 bg-gold" aria-hidden />
      </section>

      <div className="wrap grid gap-6 py-14 lg:grid-cols-3">
        {[
          [tr('رسالتنا', 'Our mission'), tr('حفظ هوية الإبل وأسمائها، وتنظيم اقتنائها بشفافية وعدالة عبر مزاد علني موثوق.', 'Preserve the identity and names of camels, and organise their acquisition fairly and transparently through a trusted public auction.')],
          [tr('ما نقدّمه', 'What we do'), tr('سجل دولي موحّد للأسماء، وتحقق فوري من التطابق، ومراجعة لجنة متخصصة، ومزادات إلكترونية، وفواتير وشهادات معتمدة.', 'A single international registry, instant matching checks, specialist committee review, online auctions, and certified invoices and certificates.')],
          [tr('لمن المنصة', 'Who it serves'), tr('ملاك الإبل والمهتمون بمسابقات المزاين وسباقات الهجن داخل المملكة وخارجها.', 'Camel owners and participants in beauty contests and racing, in the Kingdom and abroad.')],
        ].map(([t, d]) => (
          <div key={t} className="panel p-6"><h2 className="text-xl">{t}</h2><p className="mt-2 leading-8 text-ink/80">{d}</p></div>
        ))}
      </div>

      <section className="border-y border-line bg-paper">
        <div className="wrap grid gap-10 py-14 lg:grid-cols-2">
          <div>
            <h2 className="sec-title">{tr('فئات الشعارات', 'Name categories')}</h2>
            <h3 className="mt-6 text-[17px] text-muted">{tr('فردي (مفاريد)', 'Single (mafareed)')}</h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border-2 border-bakkar bg-bakkar-soft p-5"><h3 className="text-xl text-bakkar-deep">{tr('بكار', 'Bakkar')}</h3><p className="mt-1 text-[15px] text-ink/80">{tr('أسماء الإناث من الإبل، وتظهر في المنصة باللون الأخضر.', 'Names for female camels, shown in green.')}</p></div>
              <div className="rounded-xl border-2 border-qaadan bg-qaadan-soft p-5"><h3 className="text-xl text-qaadan-deep">{tr('قعدان', 'Qaadan')}</h3><p className="mt-1 text-[15px] text-ink/80">{tr('أسماء الذكور من الإبل، وتظهر في المنصة باللون البنفسجي.', 'Names for male camels, shown in purple.')}</p></div>
            </div>
            <div className="mt-4 rounded-xl border-2 border-manqiya bg-manqiya-soft p-5"><h3 className="text-xl text-manqiya-deep">{tr('منقية', 'Manqiya')}</h3><p className="mt-1 text-[15px] text-ink/80">{tr('اسم لمجموعة من الإبل (المنقية)، ويظهر في المنصة باللون الذهبي.', 'A name for a herd of camels, shown in gold.')}</p></div>
          </div>
          <div>
            <h2 className="sec-title">{tr('ضوابط ربط الأسماء', 'Name-linking rules')}</h2>
            <p className="mt-4 text-muted">{tr('للمشاركة في مهرجانات وفعاليات الإبل يجب التقيد بالآتي:', 'To take part in camel festivals and events:')}</p>
            <ol className="mt-3 list-decimal space-y-2 ps-6 leading-8">
              <li>{tr('أن يكون الاسم مرتبطًا بشريحة إلكترونية.', 'The name must be linked to an electronic microchip.')}</li>
              <li>{tr('لا يحق بيع الاسم أو استخدامه على فردي أو فردية أخرى بعد ربطه بشريحة.', 'Once linked, the name may not be sold or used on another camel.')}</li>
              <li>{tr('يجب أن يرتبط اسم المتن (الفردي أو الفردية) باسم المشارك نفسه.', 'The camel’s name must be linked to the participant’s own name.')}</li>
            </ol>
          </div>
        </div>
      </section>

      <div className="wrap py-14">
        <h2 className="sec-title">{tr('شروط المزاد باختصار', 'Auction rules in brief')}</h2>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {[
            tr(`ضمان مزاد ${RULES.depositAmount} ريال مع كل طلب، ويُعاد إن رُفض الطلب أو أُلغي.`, `A SAR ${RULES.depositAmount} guarantee with each request, refunded if it is declined or cancelled.`),
            tr('يُرفض أي اسم مطابق تمامًا لاسم مسجل، وتُراجع الأسماء الشبيهة.', 'Exact matches are rejected; similar names are reviewed.'),
            tr(`سعر افتتاحي ${RULES.openingPrice} ريال وأقل زيادة ${RULES.minIncrement} ريال، بتوقيت الرياض.`, `Opening price SAR ${RULES.openingPrice}, minimum raise SAR ${RULES.minIncrement}, Riyadh time.`),
            tr('إن لم يزايد أحد يرسو الاسم على مقدم الطلب بالسعر الافتتاحي.', 'If nobody bids, the requester gets the name at the opening price.'),
            tr('فاتورة إلكترونية متوافقة مع هيئة الزكاة والضريبة والجمارك.', 'A ZATCA-compliant e-invoice is issued to the winner.'),
            tr('شهادة تسجيل برمز QR يتحقق منها أي شخص.', 'A registration certificate with a QR code anyone can verify.'),
          ].map((x) => <li key={x} className="panel flex gap-3 p-4"><span className="mt-2.5 h-2 w-2 shrink-0 rounded-full bg-gold" />{x}</li>)}
        </ul>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/terms" className="btn-primary">{tr('الشروط والأحكام كاملة', 'Full terms')}</Link>
          <Link to="/faq" className="btn-ghost">{tr('الأسئلة الشائعة', 'FAQ')}</Link>
        </div>
      </div>
    </>
  )
}
