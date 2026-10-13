import { RULES } from '../lib/config'

export default function About() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl">سمّها لأسماء الإبل الدولية</h1>
      <p className="mt-4 text-lg leading-9 text-muted">
        منصة إلكترونية عالمية تابعة للمنظمة الدولية للإبل، تُعنى بتنظيم الأسماء والشعارات المتعلقة بمنقيات وفرديات الإبل،
        وإقامة مزاداتها وتسجيلها واعتمادها لصالح أصحابها على المستوى المحلي والعالمي.
      </p>

      <h2 className="mt-10 text-2xl">ضوابط ربط الأسماء</h2>
      <p className="mt-2 text-muted">للمشاركة في مهرجانات وفعاليات الإبل يجب التقيد بالآتي:</p>
      <ol className="mt-3 list-decimal space-y-2 ps-6 leading-8">
        <li>أن يكون الاسم مرتبطًا بشريحة إلكترونية.</li>
        <li>لا يحق بيع الاسم أو استخدامه على فردي أو فردية أخرى بعد ربطه بشريحة.</li>
        <li>يجب أن يرتبط اسم المتن (الفردي أو الفردية) باسم المشارك نفسه.</li>
      </ol>

      <h2 className="mt-10 text-2xl">أنواع الأسماء</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border-2 border-qaadan bg-qaadan-soft p-5"><h3 className="text-xl text-qaadan-deep">قعدان</h3><p className="mt-1 text-[15px] text-ink/80">أسماء الذكور من الإبل، وتظهر في المنصة باللون الأزرق.</p></div>
        <div className="rounded-xl border-2 border-bakkar bg-bakkar-soft p-5"><h3 className="text-xl text-bakkar-deep">بكار</h3><p className="mt-1 text-[15px] text-ink/80">أسماء الإناث من الإبل، وتظهر في المنصة باللون العنابي.</p></div>
      </div>

      <h2 className="mt-10 text-2xl">شروط المزاد</h2>
      <ul className="mt-3 list-disc space-y-2 ps-6 leading-8">
        <li>يقدّم المالك طلب شعار بثلاثة أسماء، ويُرفض أي اسم مطابق تمامًا لاسم مسجل أو قيد الطلب.</li>
        <li>يُسدَّد ضمان مزاد قدره {RULES.depositAmount} ريال مع كل طلب، ويُعاد إلى محفظة المالك إن رُفض الطلب أو أُلغي.</li>
        <li>تراجع لجنة الاعتماد الأسماء الشبيهة بالأسماء المسجلة، وتقبل كل اسم أو ترفضه.</li>
        <li>يُفتح المزاد للأسماء المقبولة بسعر افتتاحي {RULES.openingPrice} ريال، وأقل زيادة {RULES.minIncrement} ريال، في موعد بداية ونهاية محددين بتوقيت الرياض.</li>
        <li>إن لم يزايد أحد على الاسم، يرسو على مقدم الطلب بمبلغ الضمان نفسه.</li>
        <li>تُصدر فاتورة إلكترونية متوافقة مع متطلبات هيئة الزكاة والضريبة والجمارك للفائز بالاسم.</li>
      </ul>
    </div>
  )
}
