import { tr } from '../lib/i18n'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Loading, NameSeal, TypeBadge } from '../components/ui'
import { certNo } from '../lib/cert'
import { date } from '../lib/format'
import { api, useLoad } from '../lib/store'

export default function Verify() {
  const { code = '' } = useParams()
  const nav = useNavigate()
  const [input, setInput] = useState(code)
  const { data, loading } = useLoad(() => (code ? api.verifyCertificate(code) : Promise.resolve(null)), [code])

  return (
    <>
      <section className="hero-field text-paper">
        <div className="wrap py-12">
          <h1 className="text-[36px] font-extrabold text-paper">{tr('التحقق من شهادة اسم', 'Verify a name certificate')}</h1>
          <p className="mt-2 max-w-xl text-paper/75">{tr('اكتب رقم الشهادة أو امسح رمز QR المطبوع عليها للتأكد من أنها صادرة من منصة سمّها.', 'Enter the certificate number or scan its QR code to confirm it was issued by Sammha.')}</p>
          <form className="mt-6 flex max-w-lg gap-2 rounded-lg bg-paper p-2 shadow-lift" onSubmit={(e) => { e.preventDefault(); if (input.trim()) nav(`/verify/${input.trim().toUpperCase()}`) }}>
            <label htmlFor="cn" className="sr-only">{tr('رقم الشهادة', 'Certificate no.')}</label>
            <input id="cn" dir="ltr" className="min-w-0 flex-1 rounded-md px-3 py-2.5 text-[17px] font-bold text-ink outline-none placeholder:font-normal" placeholder="SMC-XXXXXXXX" value={input} onChange={(e) => setInput(e.target.value)} />
            <button className="btn-gold px-6">{tr('تحقق', 'Verify')}</button>
          </form>
        </div>
        <div className="h-1 bg-gold" aria-hidden />
      </section>
      <div className="wrap py-10">
        {!code ? null : loading ? <Loading /> : data ? (
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
        ) : (
          <div className="panel mx-auto max-w-2xl px-6 py-8 text-center">
            <p className="text-[18px] font-extrabold text-bad">{tr(`لا توجد شهادة بالرقم ${code}`, `No certificate found with number ${code}`)}</p>
            <p className="mt-2 text-muted">{tr('تأكد من كتابة الرقم كما هو مطبوع على الشهادة، أو تواصل معنا إن كنت تشك في صحتها.', 'Check the number exactly as printed on the certificate, or contact us if you doubt it.')}</p>
            <Link to="/names" className="btn-ghost btn-sm mt-4">{tr('ابحث في سجل الأسماء', 'Search the registry')}</Link>
          </div>
        )}
      </div>
    </>
  )
}
