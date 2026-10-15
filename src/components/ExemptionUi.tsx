import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { tr } from '../lib/i18n'
import { sar } from '../lib/format'
import type { Exemption, ExemptionStatus } from '../lib/types'
import { Frame, L, Seal, dAr, dEn, issuedVerifyUrl } from './IssuedCertificate'
import { IcoLogo, Logo } from './Layout'

/** «طلبات الاستثناء»: status label and colours, shared by the owner and staff pages */
export const EXEMPTION_STATUS: Record<ExemptionStatus, [string, string]> = {
  get pending(): [string, string] { return [tr('قيد الدراسة', 'Under review'), 'bg-info-soft text-info-deep'] },
  get priced(): [string, string] { return [tr('بانتظار سداد الغرامة', 'Awaiting fine payment'), 'bg-gold-soft text-gold-deep'] },
  get paid(): [string, string] { return [tr('صدرت الوثيقة', 'Document issued'), 'bg-[#E2F0E8] text-ok'] },
  get rejected(): [string, string] { return [tr('مرفوض', 'Rejected'), 'bg-bad/10 text-bad'] },
  get cancelled(): [string, string] { return [tr('مسحوب', 'Withdrawn'), 'bg-stone-deep text-muted'] },
}

export function ExemptionStatusPill({ e }: { e: Pick<Exemption, 'status' | 'revokedAt'> }) {
  if (e.status === 'paid' && e.revokedAt) return <span className="pill whitespace-nowrap bg-bad text-paper">{tr('الوثيقة ملغاة', 'Document revoked')}</span>
  const [label, cls] = EXEMPTION_STATUS[e.status]
  return <span className={`pill whitespace-nowrap ${cls}`}>{label}</span>
}

export const camelTypeLabel = (t: string) => (t === 'bakkar' ? tr('بكرة', 'Bakra (female)') : tr('قعود', "Qa'ud (male)"))
const TYPE: Record<string, [string, string]> = { qaadan: ['قعود', "Qa'ud · young male"], bakkar: ['بكرة', 'Bakra · young female'] }

/** the exemption document, ready to print on A4 landscape: chip, festival, owner, the fine paid, a QR and the authentication code */
export function ExemptionDocument({ e }: { e: Exemption }) {
  const [qr, setQr] = useState('')
  const sig = e.signature ?? ''
  useEffect(() => {
    if (sig) QRCode.toDataURL(issuedVerifyUrl({ number: e.number, signature: sig }), { margin: 1, width: 260, errorCorrectionLevel: 'M', color: { dark: '#092F27', light: '#FFFFFF' } }).then(setQr)
  }, [e.number, sig])
  const issued = e.issuedAt ?? e.paidAt ?? e.createdAt
  const [tAr, tEn] = TYPE[e.camelType] ?? [e.camelType, e.camelType]
  return (
    <Frame revoked={!!e.revokedAt}>
      <div className="flex items-start justify-between gap-4">
        <Logo className="h-14 sm:h-16" />
        <div className="text-center leading-tight">
          <IcoLogo className="mx-auto h-9 sm:h-11" />
          <p className="mt-1 text-[12px] font-bold text-pine">سجل استثناءات المشاركة في المهرجانات</p>
          <p className="text-[9.5px] font-semibold uppercase tracking-[.14em] text-pine/80" dir="ltr">Festival Participation Exemptions Register</p>
        </div>
        <dl className="text-end text-[11px] leading-5">
          <div><span className="text-muted">رقم الوثيقة · </span><b className="num" dir="ltr">{e.number}</b></div>
          <div className="text-[10px] text-muted" dir="ltr">Document No.</div>
          <div className="mt-1"><span className="text-muted">تاريخ الإصدار · </span><b className="num">{dAr(issued)}</b></div>
          <div className="text-[10px] text-muted" dir="ltr">Issued {dEn(issued)}</div>
        </dl>
      </div>

      <div className="mt-2 text-center">
        <h1 className="text-[29px] font-extrabold leading-tight text-pine">وثيقة استثناء مشاركة بدون اسم</h1>
        <p className="text-[12.5px] font-bold uppercase tracking-[.26em] text-gold-deep" dir="ltr">Exemption to Take Part Without a Registered Name</p>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-6 text-[11.5px] leading-[1.6] text-ink/85">
        <p dir="rtl">تشهد المنظمة الدولية للإبل، عبر منصة سمّها، بأن الجمل صاحب الشريحة الموضحة أدناه مستثنى من شرط التسمية للمشاركة في المهرجان المذكور، بعد سداد مالكه غرامة عدم التسمية. تسري هذه الوثيقة لهذا المهرجان وهذه الشريحة فقط.</p>
        <p dir="ltr" className="text-left">The International Camel Organization, through Sammha, certifies that the camel with the chip below is exempted from the naming requirement to take part in the stated festival, its owner having paid the fine for not naming it. Valid for this festival and this chip only.</p>
      </div>

      <div className="mx-auto mt-2.5 w-full max-w-xl">
        <div className={`lot-field lot-brand-${e.camelType} rounded-xl border-2 border-gold/70 px-8 py-3 text-center text-paper shadow-lift`}>
          <div className="text-[12px] font-bold text-gold-light">رقم الشريحة · <span dir="ltr">Chip number</span></div>
          <div className="num mt-0.5 text-[36px] font-extrabold leading-none tracking-[.08em]" dir="ltr">{e.camelChip}</div>
          <div className="mt-1 text-[12.5px] font-semibold text-paper/85">{tAr} · <span dir="ltr">{tEn}</span></div>
        </div>
      </div>

      <dl className="mt-2.5 grid grid-cols-4 gap-4 border-y border-gold/40 py-2 text-center">
        <div className="col-span-2"><L ar="المهرجان" en="Festival" /><dd className="text-[14px] font-extrabold leading-snug">{e.festivalName}</dd>{e.race && <dd className="text-[11.5px] text-muted">الشوط: {e.race}</dd>}</div>
        <div><L ar="المالك" en="Owner" /><dd className="text-[13.5px] font-extrabold leading-snug">{e.ownerName}</dd>{e.ownerNameEn && <dd className="text-[10.5px] text-muted" dir="ltr">{e.ownerNameEn}</dd>}{e.nationalId && <dd className="num text-[10.5px] text-muted" dir="ltr">ID {e.nationalId}</dd>}</div>
        <div><L ar="غرامة عدم التسمية المسددة" en="Fine paid" /><dd className="num text-[14px] font-extrabold">{sar(e.amount ?? 0)}</dd>{e.paidAt && <dd className="text-[10.5px] text-muted" dir="ltr">{dEn(e.paidAt)}</dd>}</div>
      </dl>

      <div className="mt-auto grid grid-cols-[auto_1fr_auto] items-end gap-5 pt-2">
        <div className="flex items-end gap-3">
          {qr ? <img src={qr} alt="رمز التحقق · Verification QR" className="h-[84px] w-[84px] rounded border border-line bg-white p-1" /> : <div className="h-[84px] w-[84px]" />}
          <div className="max-w-[12rem] pb-1 text-[10.5px] leading-[1.45] text-muted">
            <p className="font-bold text-pine">امسح الرمز للتحقق من الوثيقة</p>
            <p dir="ltr">Scan to verify this document</p>
            <p className="mt-1 break-all text-[9.5px]" dir="ltr">{location.host}{location.pathname.replace(/\/$/, '')} › verify › {e.number}</p>
          </div>
        </div>
        <div className="pb-1 text-center text-[10.5px] leading-[1.55] text-muted">
          <p className="font-bold text-ink">صدرت هذه الوثيقة إلكترونيًا من منصة سمّها بعد تأكيد السداد، ولا تحتاج إلى توقيع أو ختم يدوي. تُبرز للجنة المهرجان عند الطلب.</p>
          <p dir="ltr">Issued electronically by Sammha once payment was confirmed; valid without a handwritten signature or stamp. Present it to the festival committee on request.</p>
          <p className="mt-1.5"><span className="font-bold text-pine">رمز التوثيق · Authentication code</span>{' '}<b className="num rounded bg-pine/5 px-1.5 py-0.5 tracking-[.12em] text-ink" dir="ltr">{sig}</b></p>
        </div>
        <Seal year={new Date(issued).getFullYear()} className="h-[92px] w-[92px] -rotate-6 opacity-90" />
      </div>
    </Frame>
  )
}
