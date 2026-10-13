import { useEffect, useState } from 'react'
import { SELLER, TYPE_LABEL } from '../lib/config'
import { dateTime, num, sar } from '../lib/format'
import { zatcaQrDataUrl } from '../lib/zatca'
import type { Invoice } from '../lib/types'
import { IcoLogo, Logo } from './Layout'

/** Simplified tax invoice (فاتورة ضريبية مبسطة) — printable. */
export function InvoiceDoc({ inv }: { inv: Invoice }) {
  const [qr, setQr] = useState('')
  useEffect(() => { zatcaQrDataUrl(inv).then(setQr) }, [inv])
  return (
    <article className="invoice panel mx-auto max-w-2xl bg-white p-6 sm:p-8 print:border-0 print:p-0">
      <div className="flex items-start justify-between gap-4 border-b border-line pb-5">
        <div>
          <h1 className="text-2xl">فاتورة ضريبية مبسطة</h1>
          <p className="num mt-1 text-muted">{inv.number}</p>
          <p className="text-sm text-muted">{dateTime(inv.issuedAt)}</p>
        </div>
        <div className="flex items-center gap-3"><IcoLogo className="h-9" /><Logo className="h-14" /></div>
      </div>
      <section className="grid gap-4 border-b border-line py-5 text-sm sm:grid-cols-2">
        <div>
          <p className="font-semibold">البائع</p>
          <p>{SELLER.name}</p>
          <p className="text-muted">{SELLER.address}</p>
          <p className="num text-muted">الرقم الضريبي {SELLER.vatNumber}</p>
        </div>
        <div>
          <p className="font-semibold">المشتري</p>
          <p>{inv.buyerName}</p>
          <p className="num text-muted" dir="ltr" style={{ textAlign: 'right' }}>{inv.buyerPhone}</p>
        </div>
      </section>
      <table className="tbl my-4">
        <thead><tr><th>البيان</th><th>النوع</th><th className="text-end">المبلغ</th></tr></thead>
        <tbody>
          <tr><td>اسم شعار «{inv.name}» عبر المزاد</td><td>{TYPE_LABEL[inv.type]}</td><td className="num text-end">{sar(inv.subtotal)}</td></tr>
        </tbody>
      </table>
      <div className="flex flex-col-reverse items-start justify-between gap-6 sm:flex-row">
        {qr ? <img src={qr} alt="رمز الاستجابة السريعة للفاتورة" className="h-36 w-36" /> : <div className="h-36 w-36" />}
        <dl className="num w-full max-w-xs space-y-1.5 text-sm">
          <div className="flex justify-between"><dt className="text-muted">المبلغ قبل الضريبة</dt><dd>{sar(inv.subtotal)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">ضريبة القيمة المضافة 15%</dt><dd>{sar(inv.vat)}</dd></div>
          <div className="flex justify-between border-t border-line pt-1.5 font-semibold"><dt>الإجمالي شامل الضريبة</dt><dd>{sar(inv.total)}</dd></div>
          {inv.depositApplied > 0 && <div className="flex justify-between text-ok"><dt>مخصوم من ضمان المزاد</dt><dd>−{num(inv.depositApplied)} ر.س</dd></div>}
          <div className="flex justify-between font-extrabold text-lg"><dt>المستحق</dt><dd>{sar(inv.amountDue)}</dd></div>
          <div className="pt-1 text-end"><span className={`pill ${inv.status === 'paid' ? 'bg-ok/10 text-ok' : 'bg-gold-soft text-gold-deep'}`}>{inv.status === 'paid' ? 'مدفوعة' : 'غير مدفوعة'}</span></div>
        </dl>
      </div>
    </article>
  )
}
