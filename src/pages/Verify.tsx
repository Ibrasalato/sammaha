import { tr } from '../lib/i18n'
import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { CertificateVerify } from '../lib/types'
import { Loading, NameSeal, TypeBadge } from '../components/ui'
import { certNo } from '../lib/cert'
import { date } from '../lib/format'
import { api, useLoad } from '../lib/store'

export default function Verify() {
  const { code = '' } = useParams()
  const nav = useNavigate()
  const [input, setInput] = useState(code)
  const [params] = useSearchParams()
  const sig = params.get('s') ?? undefined
  const issued = /^SC-\d{4}-\d+$/i.test(code)
  const { data, loading } = useLoad(() => (code && !issued ? api.verifyCertificate(code) : Promise.resolve(null)), [code])
  const iss = useLoad(() => (code && issued ? api.verifyIssuedCertificate(code, sig) : Promise.resolve(null)), [code, sig])

  return (
    <>
      <section className="hero-field text-paper">
        <div className="wrap py-12">
          <h1 className="text-[36px] font-extrabold text-paper">{tr('التحقق من شهادة اسم', 'Verify a name certificate')}</h1>
          <p className="mt-2 max-w-xl text-paper/75">{tr('اكتب رقم الشهادة أو امسح رمز QR المطبوع عليها للتأكد من أنها صادرة من منصة سمّها.', 'Enter the certificate number or scan its QR code to confirm it was issued by Sammha.')}</p>
          <form className="mt-6 flex max-w-lg gap-2 rounded-lg bg-paper p-2 shadow-lift" onSubmit={(e) => { e.preventDefault(); if (input.trim()) nav(`/verify/${input.trim().toUpperCase()}`) }}>
            <label htmlFor="cn" className="sr-only">{tr('رقم الشهادة', 'Certificate no.')}</label>
            <input id="cn" dir="ltr" className="min-w-0 flex-1 rounded-md px-3 py-2.5 text-[17px] font-bold text-ink outline-none placeholder:font-normal" placeholder="SC-2026-000001" value={input} onChange={(e) => setInput(e.target.value)} />
            <button className="btn-gold px-6">{tr('تحقق', 'Verify')}</button>
          </form>
        </div>
        <div className="h-1 bg-gold" aria-hidden />
      </section>
      <div className="wrap py-10">
        {issued ? (iss.loading && !iss.data ? <Loading /> : iss.data ? <IssuedResult v={iss.data} /> : <NotFound code={code} />) : !code ? null : loading ? <Loading /> : data ? (
          <div className="panel mx-auto max-w-2xl overflow-hidden">
            <div className="flex items-center gap-3 bg-[#E2F0E8] px-6 py-4 text-ok">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden><path d="M20 6L9 17l-5-5" /></svg>
              <span className="text-[17px] font-extrabold">{tr('شهادة صحيحة ومسجلة في سجل الأسماء', 'Valid certificate, recorded in the names registry')}</span>
            </div>
            <div className="flex flex-col items-center gap-6 p-6 sm:flex-row">
              <NameSeal name={data.name} type={data.type} size="lg" />
              <dl className="grid flex-1 grid-cols-2 gap-4 text-[15px]">
                <div><dt className="text-[13px] font-medium text-muted">{tr('الاسم', 'Name')}</dt><dd className="text-xl font-extrabold">{data.name}</dd></div>
                <div><dt className="text-[13px] font-medium text-muted">{tr('النوع', 'Type')}</dt><dd><TypeBadge type={data.type} /></dd></div>
                <div><dt className="text-[13px] font-medium text-muted">{tr('المالك', 'Owner')}</dt><dd className="font-bold">{data.ownerName}</dd></div>
                <div><dt className="text-[13px] font-medium text-muted">{tr('تاريخ التسجيل', 'Registered on')}</dt><dd className="num font-bold">{date(data.acquiredAt)}</dd></div>
                <div className="col-span-2"><dt className="text-[13px] font-medium text-muted">{tr('رقم الشهادة', 'Certificate no.')}</dt><dd className="num font-bold" dir="ltr" style={{ textAlign: 'start' }}>{certNo(data)}</dd></div>
              </dl>
            </div>
          </div>
        ) : <NotFound code={code} />}
      </div>
    </>
  )
}

function NotFound({ code }: { code: string }) {
  return (
    <div className="panel mx-auto max-w-2xl px-6 py-8 text-center">
      <p className="text-[18px] font-extrabold text-bad">{tr(`لا توجد شهادة بالرقم ${code}`, `No certificate found with number ${code}`)}</p>
      <p className="mt-2 text-muted">{tr('تأكد من كتابة الرقم كما هو مطبوع على الشهادة، أو تواصل معنا إن كنت تشك في صحتها.', 'Check the number exactly as printed on the certificate, or contact us if you doubt it.')}</p>
      <Link to="/names" className="btn-ghost btn-sm mt-4">{tr('ابحث في سجل الأسماء', 'Search the registry')}</Link>
    </div>
  )
}

const ISSUED_STATUS = () => ({
  valid: [tr('شهادة صحيحة وسارية', 'Valid certificate, in force'), tr('كل الأسماء فيها ما زالت مسجلة باسم مالكها.', 'Every name on it is still registered to its owner.'), 'bg-[#E2F0E8] text-ok'],
  partial: [tr('شهادة صحيحة، وتغيّرت ملكية بعض أسمائها', 'Genuine certificate; some of its names changed hands'), tr('الأسماء المشطوبة لم تعد مسجلة باسم هذا المالك منذ صدور الشهادة.', 'Struck-through names are no longer registered to this owner since it was issued.'), 'bg-gold-soft text-gold-deep'],
  superseded: [tr('شهادة صحيحة لكنها لم تعد تعكس الملكية', 'Genuine certificate, no longer reflecting ownership'), tr('انتقلت ملكية أسمائها بعد صدورها.', 'Its names have changed hands since it was issued.'), 'bg-stone-deep text-ink'],
  revoked: [tr('شهادة ملغاة', 'Revoked certificate'), tr('ألغت المنصة هذه الشهادة ولا يُعتد بها.', 'The platform revoked this certificate; it must not be relied on.'), 'bg-bad/10 text-bad'],
}) as Record<CertificateVerify['status'], [string, string, string]>

const CURRENT = () => ({ valid: [tr('مسجل باسمه', 'Registered to owner'), 'text-ok'], transferred: [tr('انتقلت ملكيته', 'Changed hands'), 'text-gold-deep'], removed: [tr('لم يعد في السجل', 'No longer in registry'), 'text-bad'] }) as Record<string, [string, string]>

/** an issued (bilingual, signed) certificate: status today, whether the printed code matches, and its names */
function IssuedResult({ v }: { v: CertificateVerify }) {
  const [title, sub, cls] = ISSUED_STATUS()[v.status]
  const cur = CURRENT()
  return (
    <div className="panel mx-auto max-w-3xl overflow-hidden">
      <div className={`px-6 py-4 ${cls}`}>
        <p className="text-[18px] font-extrabold">{title}</p>
        <p className="text-[14px] opacity-90">{sub}</p>
        {v.status === 'revoked' && v.revokeReason && <p className="mt-1 text-[14px]">{tr('السبب:', 'Reason:')} {v.revokeReason}</p>}
      </div>
      {v.signatureMatches !== undefined && v.signatureMatches !== null && (
        <p className={`border-b border-line px-6 py-2.5 text-[14px] font-bold ${v.signatureMatches ? 'text-ok' : 'text-bad'}`}>
          {v.signatureMatches ? tr('✓ رمز التوثيق مطابق لما في السجل', '✓ The authentication code matches the registry') : tr('✗ رمز التوثيق لا يطابق هذه الشهادة: قد تكون النسخة معدّلة', '✗ The authentication code does not match this certificate: the copy may be altered')}
        </p>
      )}
      <dl className="grid gap-4 p-6 text-[15px] sm:grid-cols-2">
        <div><dt className="text-[13px] font-medium text-muted">{tr('رقم الشهادة', 'Certificate no.')}</dt><dd className="num font-extrabold" dir="ltr" style={{ textAlign: 'start' }}>{v.number}</dd></div>
        <div><dt className="text-[13px] font-medium text-muted">{tr('تاريخ الإصدار', 'Issued on')}</dt><dd className="num font-bold">{date(v.issuedAt)}</dd></div>
        <div><dt className="text-[13px] font-medium text-muted">{tr('المالك', 'Owner')}</dt><dd className="font-bold">{v.ownerNameAr}</dd><dd className="text-[13px] text-muted" dir="ltr" style={{ textAlign: 'start' }}>{v.ownerNameEn}</dd></div>
        <div><dt className="text-[13px] font-medium text-muted">{tr('الشمول', 'Covers')}</dt><dd className="font-bold">{v.scope === 'mark' ? tr('شعار واحد', 'One mark') : tr(`جميع شعارات المالك (${v.items.length})`, `All the owner’s marks (${v.items.length})`)}</dd></div>
      </dl>
      <div className="overflow-x-auto border-t border-line">
        <table className="tbl">
          <thead><tr><th>{tr('الاسم', 'Name')}</th><th>{tr('النوع', 'Type')}</th><th>{tr('تاريخ القيد', 'Registered')}</th><th>{tr('الوضع اليوم', 'Today')}</th></tr></thead>
          <tbody>
            {v.items.map((i) => (
              <tr key={i.id} className={i.current !== 'valid' ? 'text-muted' : ''}>
                <td><b className={`block text-[16px] ${i.current !== 'valid' ? 'line-through' : ''}`}>{i.name}</b><span className="text-[12.5px] text-muted" dir="ltr">{i.latin}</span></td>
                <td><TypeBadge type={i.type} /></td>
                <td className="num whitespace-nowrap text-[13.5px]">{date(i.acquiredAt)}</td>
                <td className={`whitespace-nowrap text-[13.5px] font-bold ${cur[i.current][1]}`}>{cur[i.current][0]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-line px-6 py-3 text-[12.5px] text-muted">{tr('صادرة من منصة سمّها ومعتمدة من المنظمة الدولية للإبل. لا تعرض صفحة التحقق رقم هوية المالك.', 'Issued by Sammha and attested by the International Camel Organization. The verification page never shows the owner’s ID number.')}</p>
    </div>
  )
}
