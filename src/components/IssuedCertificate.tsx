import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { COUNTRIES } from '../lib/countries'
import type { Certificate, CertificateItem } from '../lib/types'
import { IcoLogo, Logo } from './Layout'

/** the public link a certificate's QR opens: the number plus its signature code */
export function issuedVerifyUrl(c: Pick<Certificate, 'number' | 'signature'>) {
  const base = location.href.split('#')[0]
  return `${base}#/verify/${c.number}?s=${c.signature}`
}

// certificates are official documents: Gregorian dates in Riyadh time, in both languages
const dAr = (s: string) => new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { timeZone: 'Asia/Riyadh', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(s))
const dEn = (s: string) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Riyadh', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(s))
const SOURCE: Record<string, [string, string]> = {
  auction: ['مزاد علني', 'Public auction'], legacy: ['قيد سابق', 'Prior record'], compound: ['اسم مركب', 'Compound name'],
  investment: ['استثمار الاسم', 'Name investment'], resale: ['إعادة بيع', 'Resale'],
}
const TYPE: Record<string, [string, string]> = { qaadan: ['القعدان', "Qa'dan"], bakkar: ['البكار', 'Bakkar'], manqiya: ['المنقية', 'Manqiya'] }
const nat = (code?: string) => { const c = COUNTRIES.find((x) => x.code === code); return c ? [c.name, c.en] as const : null }

/** the circular attestation seal of the International Camel Organization's names registry (drawn, not an image) */
function Seal({ year, className = '' }: { year: number; className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} aria-label="ختم التوثيق · Attestation seal" role="img">
      <defs>
        <path id="sealTop" d="M 30 100 A 70 70 0 0 1 170 100" />
        <path id="sealBottom" d="M 22 100 A 78 78 0 0 0 178 100" />
      </defs>
      <circle cx="100" cy="100" r="95" fill="none" stroke="#00513B" strokeWidth="3" />
      <circle cx="100" cy="100" r="88" fill="none" stroke="#C99532" strokeWidth="1.2" />
      <circle cx="100" cy="100" r="56" fill="none" stroke="#00513B" strokeWidth="1.2" strokeDasharray="2 3" />
      <text fontSize="15" fontWeight="800" fill="#00513B" letterSpacing=".5"><textPath href="#sealTop" startOffset="50%" textAnchor="middle">المنظمة الدولية للإبل</textPath></text>
      <text fontSize="10.5" fontWeight="700" fill="#00513B" letterSpacing="1.6"><textPath href="#sealBottom" startOffset="50%" textAnchor="middle">INTERNATIONAL CAMEL ORGANIZATION</textPath></text>
      <text x="100" y="88" textAnchor="middle" fontSize="16" fontWeight="800" fill="#C99532">معتمد</text>
      <text x="100" y="106" textAnchor="middle" fontSize="10.5" fontWeight="800" fill="#00513B" letterSpacing="2.2">ATTESTED</text>
      <text x="100" y="124" textAnchor="middle" fontSize="11" fontWeight="700" fill="#092F27">{year}</text>
      <path d="M 66 100 L 56 100 M 134 100 L 144 100" stroke="#C99532" strokeWidth="1.5" />
    </svg>
  )
}

function Corner({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 60 60" className={`absolute h-12 w-12 text-gold ${className}`} aria-hidden>
      <path d="M2 58V14C2 7 7 2 14 2h44" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M10 58V20c0-6 4-10 10-10h38" fill="none" stroke="currentColor" strokeWidth="1" opacity=".7" />
      <path d="M22 22l6-6 6 6-6 6z" fill="currentColor" opacity=".85" />
    </svg>
  )
}

/** bilingual label: Arabic over English */
function L({ ar, en }: { ar: string; en: string }) {
  return <dt className="leading-tight"><span className="block text-[11.5px] font-bold text-muted">{ar}</span><span className="block text-[10px] font-medium uppercase tracking-[.08em] text-muted/80" dir="ltr">{en}</span></dt>
}

function useQr(c: Certificate) {
  const [qr, setQr] = useState('')
  useEffect(() => { QRCode.toDataURL(issuedVerifyUrl(c), { margin: 1, width: 260, errorCorrectionLevel: 'M', color: { dark: '#092F27', light: '#FFFFFF' } }).then(setQr) }, [c])
  return qr
}

function Frame({ children, revoked, portrait }: { children: React.ReactNode; revoked?: boolean; portrait?: boolean }) {
  return (
    <article className={`certificate-issued relative mx-auto w-full overflow-hidden bg-[#FBF8F0] text-ink shadow-card print:shadow-none ${portrait ? 'cert-portrait max-w-[52rem]' : 'cert-landscape aspect-[1.414] max-w-5xl'}`}>
      {/* watermark: the Sammha mark, very faint */}
      <img src="./sammha-mark.svg" alt="" aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 w-[46%] -translate-x-1/2 -translate-y-1/2 opacity-[.045]" />
      <div className="pointer-events-none absolute inset-3 border-[3px] border-pine" aria-hidden />
      <div className="pointer-events-none absolute inset-[18px] border border-gold" aria-hidden />
      <Corner className="left-5 top-5" /><Corner className="right-5 top-5 -scale-x-100" /><Corner className="bottom-5 left-5 -scale-y-100" /><Corner className="bottom-5 right-5 -scale-100" />
      {revoked && <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center" aria-hidden><span className="-rotate-[18deg] rounded-xl border-[6px] border-bad/70 px-10 py-3 text-[64px] font-black tracking-wider text-bad/70">ملغاة · REVOKED</span></div>}
      <div className={`cert-body relative flex h-full flex-col ${portrait ? 'px-[7%] py-[5%]' : 'px-[6%] py-[3.2%]'}`}>{children}</div>
    </article>
  )
}

function Header({ c }: { c: Certificate }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <Logo className="h-14 sm:h-16" />
      <div className="text-center leading-tight">
        <IcoLogo className="mx-auto h-9 sm:h-11" />
        <p className="mt-1 text-[12px] font-bold text-pine">السجل الدولي لأسماء الإبل</p>
        <p className="text-[9.5px] font-semibold uppercase tracking-[.14em] text-pine/80" dir="ltr">International Camel Names Registry</p>
      </div>
      <dl className="text-end text-[11px] leading-5">
        <div><span className="text-muted">رقم الشهادة · </span><b className="num" dir="ltr">{c.number}</b></div>
        <div className="text-[10px] text-muted" dir="ltr">Certificate No.</div>
        <div className="mt-1"><span className="text-muted">تاريخ الإصدار · </span><b className="num">{dAr(c.issuedAt)}</b></div>
        <div className="text-[10px] text-muted" dir="ltr">Issued {dEn(c.issuedAt)}</div>
      </dl>
    </div>
  )
}

function Footer({ c }: { c: Certificate }) {
  const qr = useQr(c)
  return (
    <div className="mt-auto grid grid-cols-[auto_1fr_auto] items-end gap-5 pt-2">
      <div className="flex items-end gap-3">
        {qr ? <img src={qr} alt="رمز التحقق · Verification QR" className="h-[84px] w-[84px] rounded border border-line bg-white p-1" /> : <div className="h-[84px] w-[84px]" />}
        <div className="max-w-[12rem] pb-1 text-[10.5px] leading-[1.45] text-muted">
          <p className="font-bold text-pine">امسح الرمز للتحقق من الشهادة</p>
          <p dir="ltr">Scan to verify this certificate</p>
          <p className="mt-1 break-all text-[9.5px]" dir="ltr">{location.host}{location.pathname.replace(/\/$/, '')} › verify › {c.number}</p>
        </div>
      </div>
      <div className="pb-1 text-center text-[10.5px] leading-[1.55] text-muted">
        <p className="font-bold text-ink">صدرت هذه الشهادة إلكترونيًا من منصة سمّها، وهي معتمدة من المنظمة الدولية للإبل ولا تحتاج إلى توقيع أو ختم يدوي.</p>
        <p dir="ltr">Issued electronically by Sammha and attested by the International Camel Organization; valid without a handwritten signature or stamp.</p>
        <p className="mt-1.5"><span className="font-bold text-pine">رمز التوثيق · Authentication code</span>{' '}<b className="num rounded bg-pine/5 px-1.5 py-0.5 tracking-[.12em] text-ink" dir="ltr">{c.signature}</b></p>
      </div>
      <Seal year={new Date(c.issuedAt).getFullYear()} className="h-[92px] w-[92px] -rotate-6 opacity-90" />
    </div>
  )
}

function OwnerBlock({ c }: { c: Certificate }) {
  const n = nat(c.nationality)
  return (
    <div className="grid grid-cols-2 gap-6 border-y border-gold/40 py-2">
      <div className="text-right" dir="rtl">
        <p className="text-[11.5px] font-bold text-muted">باسم المالك</p>
        <p className="text-[19px] font-extrabold leading-snug text-pine-deep">{c.ownerNameAr}</p>
        <p className="text-[11.5px] text-muted">{c.nationalIdMasked && <>الهوية <span className="num" dir="ltr">{c.nationalIdMasked}</span></>}{n && <> · الجنسية: {n[0]}</>}</p>
      </div>
      <div className="text-left" dir="ltr">
        <p className="text-[10.5px] font-bold uppercase tracking-[.1em] text-muted">Registered owner</p>
        <p className="text-[17px] font-extrabold leading-snug text-pine-deep">{c.ownerNameEn}</p>
        <p className="text-[11px] text-muted">{c.nationalIdMasked && <>ID <span className="num">{c.nationalIdMasked}</span></>}{n && <> · Nationality: {n[1]}</>}</p>
      </div>
    </div>
  )
}

function MarkCertificate({ c, it }: { c: Certificate; it: CertificateItem }) {
  const [tAr, tEn] = TYPE[it.type] ?? [it.type, it.type]
  const [sAr, sEn] = SOURCE[it.source] ?? [it.source, it.source]
  return (
    <Frame revoked={c.status === 'revoked'}>
      <Header c={c} />
      <div className="mt-2 text-center">
        <h1 className="text-[30px] font-extrabold leading-tight text-pine">شهادة تسجيل اسم شعار</h1>
        <p className="text-[13px] font-bold uppercase tracking-[.32em] text-gold-deep" dir="ltr">Certificate of Name Registration</p>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-6 text-[11.5px] leading-[1.6] text-ink/85">
        <p dir="rtl">تشهد المنظمة الدولية للإبل، عبر منصة سمّها، بأن اسم الشعار الموضّح أدناه مقيّد في السجل الدولي لأسماء الإبل، ومعتمد باسم مالكه، وله وحده حق استخدامه وفق أنظمة المنصة.</p>
        <p dir="ltr" className="text-left">The International Camel Organization, through Sammha, certifies that the name below is recorded in the International Camel Names Registry and attested in the name of its owner, who alone holds the right to use it under the platform's rules.</p>
      </div>
      <div className="mx-auto mt-2.5 w-full max-w-lg">
        <div className={`lot-field lot-brand-${it.type} rounded-xl border-2 border-gold/70 px-8 py-3 text-center text-paper shadow-lift`}>
          <div className="text-[44px] font-extrabold leading-none">{it.name}</div>
          <div className="mt-1 text-[17px] font-bold tracking-[.06em] text-gold-light" dir="ltr">{it.latin}</div>
          <div className="mt-1 text-[12px] font-semibold text-paper/85">{tAr} · <span dir="ltr">{tEn}</span>{it.baseName && <> · مركب من «{it.baseName}»</>}</div>
        </div>
      </div>
      <div className="mt-2.5"><OwnerBlock c={c} /></div>
      <dl className="mt-2 grid grid-cols-3 gap-4 text-center">
        <div><L ar="تاريخ القيد" en="Registered on" /><dd className="num text-[13.5px] font-extrabold">{dAr(it.acquiredAt)}</dd><dd className="text-[10.5px] text-muted" dir="ltr">{dEn(it.acquiredAt)}</dd></div>
        <div><L ar="رقم القيد في السجل" en="Registry No." /><dd className="num text-[13.5px] font-extrabold" dir="ltr">{it.registryCode}</dd></div>
        <div><L ar="طريقة الاقتناء" en="Acquired by" /><dd className="text-[13.5px] font-extrabold">{sAr}</dd><dd className="text-[10.5px] text-muted" dir="ltr">{sEn}</dd></div>
      </dl>
      <Footer c={c} />
    </Frame>
  )
}

function PortfolioCertificate({ c }: { c: Certificate }) {
  const by = (t: string) => c.items.filter((i) => i.type === t).length
  return (
    <Frame revoked={c.status === 'revoked'} portrait>
      <Header c={c} />
      <div className="mt-4 text-center">
        <h1 className="text-[28px] font-extrabold leading-tight text-pine">شهادة ملكية شعارات</h1>
        <p className="text-[12.5px] font-bold uppercase tracking-[.28em] text-gold-deep" dir="ltr">Certificate of Registered Names</p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-6 text-[12px] leading-6 text-ink/85">
        <p dir="rtl">تشهد المنظمة الدولية للإبل، عبر منصة سمّها، بأن أسماء الشعارات المدرجة أدناه، وعددها <b className="num">{c.items.length}</b>، مقيّدة في السجل الدولي لأسماء الإبل ومعتمدة باسم مالكها حتى تاريخ إصدار هذه الشهادة.</p>
        <p dir="ltr" className="text-left">The International Camel Organization, through Sammha, certifies that the <b>{c.items.length}</b> names listed below are recorded in the International Camel Names Registry and attested in the name of their owner as of this certificate's issue date.</p>
      </div>
      <div className="mt-3"><OwnerBlock c={c} /></div>
      <div className="mt-3 flex justify-center gap-2 text-[11.5px]">
        {(['qaadan', 'bakkar', 'manqiya'] as const).filter(by).map((t) => <span key={t} className={`lot-field lot-brand-${t} rounded-md px-2.5 py-1 font-bold text-paper`}>{TYPE[t][0]} · <span dir="ltr">{TYPE[t][1]}</span> <span className="num">({by(t)})</span></span>)}
      </div>
      <table className="mt-3 w-full border-collapse text-[11.5px]">
        <thead>
          <tr className="bg-pine text-paper">
            {[['#', '#'], ['الاسم', 'Name'], ['بالحروف اللاتينية', 'Latin'], ['الفئة', 'Type'], ['تاريخ القيد', 'Registered'], ['رقم القيد', 'Registry No.']].map(([a, e]) => (
              <th key={e} className="border border-pine px-2 py-1.5 text-start font-bold leading-tight">{a}<span className="block text-[9.5px] font-medium uppercase tracking-wider text-paper/70" dir="ltr">{e}</span></th>
            ))}
          </tr>
        </thead>
        <tbody>
          {c.items.map((i, n) => (
            <tr key={i.id} className={`break-inside-avoid ${n % 2 ? 'bg-pine/[.035]' : 'bg-white/60'} ${i.current !== 'valid' ? 'text-muted line-through decoration-bad/60' : ''}`}>
              <td className="num border border-line px-2 py-1">{n + 1}</td>
              <td className="border border-line px-2 py-1 text-[13px] font-extrabold">{i.name}</td>
              <td className="border border-line px-2 py-1 font-semibold" dir="ltr" style={{ textAlign: 'left' }}>{i.latin}</td>
              <td className="border border-line px-2 py-1">{(TYPE[i.type] ?? [i.type])[0]} · <span dir="ltr">{(TYPE[i.type] ?? [i.type, i.type])[1]}</span></td>
              <td className="num whitespace-nowrap border border-line px-2 py-1" dir="ltr" style={{ textAlign: 'left' }}>{dEn(i.acquiredAt)}</td>
              <td className="num border border-line px-2 py-1" dir="ltr" style={{ textAlign: 'left' }}>{i.registryCode}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Footer c={c} />
    </Frame>
  )
}

/** the issued certificate, ready to print (A4 landscape for one mark, A4 portrait for all marks) */
export function IssuedCertificate({ c }: { c: Certificate }) {
  return c.scope === 'mark' && c.items[0] ? <MarkCertificate c={c} it={c.items[0]} /> : <PortfolioCertificate c={c} />
}
