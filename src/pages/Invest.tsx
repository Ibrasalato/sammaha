import { RIYAL } from '../lib/format'
import { Link } from 'react-router-dom'
import { Icon } from '../components/dash'
import type { IconName } from '../components/dash'
import { RULES } from '../lib/config'
import { tr } from '../lib/i18n'
import { useApp } from '../lib/store'

const ownerPct = Math.round(RULES.investOwnerShare * 100)
const orgPct = 100 - ownerPct

/** Public page for the «استثمار الاسم» service: submit a new name, the committee studies it, it goes to a public auction and the proposer shares the proceeds. */
export default function Invest() {
  const { user } = useApp()
  const start = user?.role === 'owner' ? '/dashboard/invest' : user ? '/admin/requests' : '/login'

  const steps: [IconName, string, string][] = [
    ['plus', tr('قدّم أسماء جديدة', 'Submit new names'), tr(`من أيقونة «استثمار الاسم» في لوحتك، حتى ${RULES.investMaxNames} أسماء فريدة غير مكررة في الطلب.`, `From the «Name investment» icon in your dashboard: up to ${RULES.investMaxNames} unique names per request.`)],
    ['wallet', tr(`ادفع رسوم الدراسة ${RULES.investFee} ⃁`, `Pay the ⃁ ${RULES.investFee} study fee`), tr('رسوم دراسة الطلب غير مستردة في جميع الأحوال.', 'The study fee is non-refundable in all cases.')],
    ['shield', tr('دراسة اللجنة المختصة', 'Specialist committee review'), tr('يُقيَّم الاسم وفق المعايير المعتمدة. إن لم يُقبل يصلك إشعار برسالة نصية.', 'The name is assessed against the approved criteria. If it is not accepted you get a text message.')],
    ['gavel', tr('طرح الاسم في مزاد عام', 'Public auction'), tr('الاسم المقبول يُطرح للجميع في مزاد إلكتروني علني.', 'An accepted name is offered to everyone in an open online auction.')],
    ['coins', tr(`لك ${ownerPct}% من قيمة البيع`, `You get ${ownerPct}% of the sale`), tr(`توزَّع العوائد بعد انتهاء المزاد: ${orgPct}% للمنظمة و${ownerPct}% لصاحب الاسم، تُضاف إلى محفظتك فور سداد الفائز.`, `Proceeds are split after the auction: ${orgPct}% to the organization and ${ownerPct}% to the name owner, credited to your wallet once the winner pays.`)],
  ]

  return (
    <>
      <section className="relative overflow-hidden bg-pine text-paper">
        <img src="./hero/camels-sky.webp" alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-t from-pine via-pine/70 to-pine/30" />
        <div className="wrap relative py-16 sm:py-20">
          <p className="inline-flex items-center gap-2 rounded-full bg-paper/10 px-3 py-1 text-[14px] font-bold text-gold-light"><Icon name="coins" className="h-4 w-4" />{tr('خدمة جديدة', 'New service')}</p>
          <h1 className="mt-3 max-w-2xl text-[38px] font-extrabold leading-tight text-paper sm:text-[50px]">{tr('استثمار الاسم', 'Name investment')}</h1>
          <p className="mt-4 max-w-2xl text-[17px] leading-8 text-paper/80">
            {tr('حوّل فكرتك إلى عائد. اقترح اسمًا جديدًا مبتكرًا للإبل، وإذا اعتمدته اللجنة يُطرح في مزاد عام ويكون لك نصيب من قيمة بيعه.',
              'Turn your idea into income. Propose a new, original camel name; if the committee approves it, it goes to a public auction and you share in its sale price.')}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to={start} className="btn-gold px-6">{tr('قدّم اسمك الآن', 'Submit your name')}</Link>
            <a href="#how" className="btn border border-paper/30 text-paper hover:bg-paper/10">{tr('كيف تعمل الخدمة', 'How it works')}</a>
          </div>
          <dl className="mt-10 grid max-w-2xl grid-cols-3 gap-3">
            {[[`${RULES.investFee}`, tr(`${RIYAL} رسوم الدراسة`, `${RIYAL} study fee`)], [`${ownerPct}%`, tr('لصاحب الاسم', 'to the name owner')], [`${RULES.investMaxNames}`, tr('أسماء في الطلب', 'names per request')]].map(([v, l]) => (
              <div key={l} className="rounded-xl border border-paper/15 bg-paper/5 p-4"><dt className="num text-[30px] font-extrabold text-gold-light">{v}</dt><dd className="text-[14px] text-paper/75">{l}</dd></div>
            ))}
          </dl>
        </div>
        <div className="relative h-1 bg-gold" aria-hidden />
      </section>

      <section id="how" className="wrap scroll-mt-24 py-14">
        <h2 className="sec-title">{tr('رحلة الاسم', 'How it works')}</h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-5">
          {steps.map(([icon, t, d], i) => (
            <li key={t} className="panel relative p-5">
              <span className="num absolute end-4 top-4 text-[13px] font-bold text-muted">{i + 1}</span>
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-pine-soft text-pine"><Icon name={icon} /></span>
              <h3 className="mt-4 text-[17px]">{t}</h3>
              <p className="mt-1.5 text-[14.5px] leading-7 text-ink/75">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y border-line bg-paper">
        <div className="wrap grid gap-10 py-14 lg:grid-cols-2">
          <div>
            <h2 className="sec-title">{tr('توزيع العوائد', 'How proceeds are split')}</h2>
            <p className="mt-3 text-muted">{tr('تُحسب النسبة من قيمة البيع قبل ضريبة القيمة المضافة، وتوزَّع بعد انتهاء المزاد.', 'Shares are calculated on the sale price before VAT and paid after the auction ends.')}</p>
            <div className="mt-6 flex h-14 overflow-hidden rounded-xl text-[15px] font-extrabold" role="img" aria-label={tr(`${orgPct}% للمنظمة و${ownerPct}% لصاحب الاسم`, `${orgPct}% organization, ${ownerPct}% name owner`)}>
              <div className="flex items-center justify-center bg-pine text-paper" style={{ width: `${orgPct}%` }}>{tr(`المنظمة ${orgPct}%`, `Organization ${orgPct}%`)}</div>
              <div className="flex items-center justify-center bg-gold text-pine" style={{ width: `${ownerPct}%` }}>{tr(`صاحب الاسم ${ownerPct}%`, `Owner ${ownerPct}%`)}</div>
            </div>
            <div className="mt-5 rounded-xl border border-line bg-stone p-4 text-[15px] leading-7">
              <b>{tr('مثال:', 'Example:')}</b> {tr('بيع الاسم بـ 11,500 ⃁ شاملة الضريبة (10,000 قبلها)، فيضاف 3,000 ⃁ إلى محفظة صاحب الاسم بعد سداد الفائز.', 'A name sells for ⃁ 11,500 incl. VAT (10,000 before it); ⃁ 3,000 goes to the owner’s wallet once the winner pays.')}
            </div>
          </div>
          <div>
            <h2 className="sec-title">{tr('الشروط', 'Conditions')}</h2>
            <ul className="mt-6 space-y-3">
              {[
                tr(`حتى ${RULES.investMaxNames} أسماء جديدة في الطلب، غير مسجلة وغير مكررة، ويُدرس كل اسم على حدة.`, `Up to ${RULES.investMaxNames} new names per request, not registered and not duplicated; each is reviewed on its own.`),
                tr(`رسوم دراسة ${RULES.investFee} ⃁ للطلب، غير مستردة سواء قُبلت الأسماء أو لم تُقبل.`, `A ⃁ ${RULES.investFee} study fee, non-refundable whether the name is accepted or not.`),
                tr('تدرس الطلبَ لجنة مختصة وفق معايير معتمدة، ويُبلَّغ مقدم الطلب برسالة نصية عند عدم القبول.', 'A specialist committee studies each request against approved criteria; the applicant gets a text message if it is not accepted.'),
                tr('لا يزايد صاحب الاسم على اسمه حفاظًا على عدالة المزاد.', 'The name owner cannot bid on their own name, to keep the auction fair.'),
                tr(`إن لم تُسجَّل أي مزايدة يؤول الاسم إلى صاحبه دون نسبة الـ${ownerPct}%.`, `If nobody bids, the name passes to its owner without the ${ownerPct}% share.`),
              ].map((x) => <li key={x} className="flex gap-3"><span className="mt-2.5 h-2 w-2 shrink-0 rounded-full bg-gold" /><span className="leading-8">{x}</span></li>)}
            </ul>
          </div>
        </div>
      </section>

      <section className="wrap py-14">
        <h2 className="sec-title">{tr('لماذا استثمار الاسم', 'Why name investment')}</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {([
            ['plus', tr('الابتكار', 'Innovation'), tr('تشجيع ابتكار أسماء جديدة وتنويع الهوية.', 'Encourage new names and a richer identity.')],
            ['tag', tr('تقليل التكرار', 'Less repetition'), tr('الحد من تكرار الأسماء وتشابهها في السجل.', 'Fewer repeated and look-alike names in the registry.')],
            ['coins', tr('التمكين الاقتصادي', 'Economic empowerment'), tr(`عائد مالي لصاحب الفكرة يصل إلى ${ownerPct}% من قيمة البيع.`, `Income for the idea’s author of up to ${ownerPct}% of the sale.`)],
            ['shield', tr('الحوكمة والشفافية', 'Governance'), tr('دراسة لجنة مختصة ومزاد علني وتوثيق إلكتروني لكل العمليات.', 'Committee review, open auctions and every step recorded electronically.')],
          ] as [IconName, string, string][]).map(([icon, t, d]) => (
            <div key={t} className="panel p-5">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-gold-soft text-gold-deep"><Icon name={icon} /></span>
              <h3 className="mt-3 text-[17px]">{t}</h3>
              <p className="mt-1 text-[14.5px] leading-7 text-ink/75">{d}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap items-center gap-4 rounded-2xl bg-pine p-6 text-paper sm:p-8">
          <div className="flex-1">
            <h2 className="text-[24px] text-paper">{tr('عندك اسم يستحق؟', 'Got a name worth sharing?')}</h2>
            <p className="mt-1 text-paper/75">{tr('قدّمه الآن، وتابع دراسته ومزاده وعائدك من لوحتك.', 'Submit it now and follow its review, auction and earnings from your dashboard.')}</p>
          </div>
          <Link to={start} className="btn-gold px-6">{tr('ابدأ استثمار الاسم', 'Start now')}</Link>
        </div>
      </section>
    </>
  )
}
