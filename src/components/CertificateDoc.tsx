import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { certNo, verifyUrl } from '../lib/cert'
import { TYPE_HINT, TYPE_LABEL } from '../lib/config'
import { date } from '../lib/format'
import type { ReservedName } from '../lib/types'
import { IcoLogo, Logo } from './Layout'

/** Official name-registration certificate (A4 landscape when printed). */
export function CertificateDoc({ r }: { r: ReservedName }) {
  const [qr, setQr] = useState('')
  useEffect(() => { QRCode.toDataURL(verifyUrl(r), { margin: 1, width: 220, color: { dark: '#0F3B24', light: '#FFFFFF' } }).then(setQr) }, [r])
  return (
    <article className="certificate relative mx-auto aspect-[1.414] w-full max-w-4xl overflow-hidden rounded-lg border border-line bg-white text-ink shadow-card print:rounded-none print:border-0 print:shadow-none">
      <div className="sadu" aria-hidden />
      <div className="absolute inset-x-6 bottom-6 top-12 rounded border-2 border-gold/60 sm:inset-x-10 sm:top-14" aria-hidden />
      <div className="relative flex h-[calc(100%-48px)] flex-col items-center px-10 pb-10 pt-8 text-center sm:px-16 sm:pt-10">
        <Logo className="h-14 sm:h-20" />
        <h1 className="mt-2 text-[22px] font-extrabold text-pine sm:mt-4 sm:text-[34px]">شهادة تسجيل اسم شعار</h1>
        <p className="mt-1 text-[13px] text-muted sm:text-[16px]">تشهد منصة سمّها التابعة للمنظمة الدولية للإبل بأن الاسم الآتي مسجّل ومعتمد باسم مالكه</p>
        <div className={`lot-field lot-${r.type} mt-4 rounded-xl px-12 py-4 text-paper sm:mt-6 sm:px-20 sm:py-6`}>
          <div className="text-[34px] font-extrabold leading-none sm:text-[56px]">{r.name}</div>
          <div className="mt-2 text-[13px] font-bold sm:text-[15px]">{TYPE_LABEL[r.type]}، {TYPE_HINT[r.type]}</div>
        </div>
        <dl className="mt-5 grid w-full max-w-2xl grid-cols-3 gap-3 text-[12px] sm:mt-8 sm:text-[15px]">
          <div><dt className="text-muted">المالك</dt><dd className="font-extrabold">{r.ownerName}</dd></div>
          <div><dt className="text-muted">تاريخ التسجيل</dt><dd className="num font-extrabold">{date(r.acquiredAt)}</dd></div>
          <div><dt className="text-muted">رقم الشهادة</dt><dd className="num font-extrabold" dir="ltr">{certNo(r)}</dd></div>
        </dl>
        <div className="mt-auto flex w-full items-end justify-between">
          <div className="text-start text-[11px] text-muted sm:text-[13px]">
            <div className="mb-6 w-40 border-b border-ink/40 sm:mb-8 sm:w-52" />
            رئيس لجنة الاعتماد
          </div>
          <IcoLogo className="mb-1 hidden h-8 sm:block sm:h-11" />
          <div className="flex items-end gap-3 text-start">
            <p className="hidden max-w-[11rem] text-[11px] leading-5 text-muted sm:block">امسح الرمز للتحقق من صحة الشهادة على منصة سمّها</p>
            {qr ? <img src={qr} alt="رمز التحقق من الشهادة" className="h-20 w-20 sm:h-28 sm:w-28" /> : <div className="h-20 w-20 sm:h-28 sm:w-28" />}
          </div>
        </div>
      </div>
    </article>
  )
}
