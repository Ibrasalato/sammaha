import { tr } from '../lib/i18n'
import { useEffect, useState } from 'react'
import { SELLER, TYPE_LABEL } from '../lib/config'
import { dateTime, sar } from '../lib/format'
import { zatcaQrDataUrl } from '../lib/zatca'
import type { Invoice } from '../lib/types'
import { IcoLogo, Logo } from './Layout'

const itemLabel = (inv: Invoice) => `${tr('اسم شعار', 'Mark name')} «${inv.name}» ${inv.listingId ? (inv.auctionId === inv.listingId ? tr('بالشراء الفوري من مالكه', 'bought instantly from its owner') : tr('عبر مزاد إعادة البيع', 'via resale auction')) : tr('عبر المزاد', 'via auction')}`

/**
 * Before payment: a payment request (طلب سداد), never a tax invoice.
 * Once paid: the simplified tax invoice with its own number, date and ZATCA QR code.
 */
export function InvoiceDoc({ inv, onPay }: { inv: Invoice; onPay?: () => void }) {
  return inv.status === 'paid' ? <TaxInvoice inv={inv} /> : <PaymentRequest inv={inv} onPay={onPay} />
}

function PaymentRequest({ inv, onPay }: { inv: Invoice; onPay?: () => void }) {
  const cancelled = inv.status === 'cancelled'
  return (
    <article className="invoice panel mx-auto max-w-2xl bg-white p-6 sm:p-8 print:border-0 print:p-0">
      <div className="flex items-start justify-between gap-4 border-b border-line pb-5">
        <div>
          <h1 className="text-2xl">{tr('طلب سداد', 'Payment request')}</h1>
          <p className="num mt-1 text-muted">{inv.number}</p>
          <p className="text-sm text-muted">{dateTime(inv.issuedAt)}</p>
        </div>
        <Logo className="h-14" />
      </div>
      <p className={`mt-4 rounded-lg px-4 py-3 text-[14px] leading-7 ${cancelled ? 'bg-bad/10 text-bad' : 'bg-gold-soft text-gold-deep'}`}>
        {cancelled
          ? tr('أُلغي طلب السداد لانتهاء المهلة دون سداد.', 'This payment request was cancelled: the deadline passed without payment.')
          : tr('هذا طلب سداد وليس فاتورة ضريبية. تصدر الفاتورة الضريبية المبسطة تلقائيًا بعد إتمام السداد عبر قنوات الدفع.', 'This is a payment request, not a tax invoice. The simplified tax invoice is issued automatically once payment is completed through the payment channels.')}
      </p>
      <table className="tbl my-4">
        <thead><tr><th>{tr('البيان', 'Description')}</th><th>{tr('النوع', 'Type')}</th><th className="text-end">{tr('المبلغ', 'Amount')}</th></tr></thead>
        <tbody><tr><td>{itemLabel(inv)}</td><td>{TYPE_LABEL[inv.type]}</td><td className="num text-end">{sar(inv.total)}</td></tr></tbody>
      </table>
      <dl className="num ms-auto w-full max-w-xs space-y-1.5 text-sm">
        <div className="flex justify-between"><dt className="text-muted">{tr('المبلغ شامل ضريبة القيمة المضافة', 'Amount incl. VAT')}</dt><dd>{sar(inv.total)}</dd></div>
        {inv.depositApplied > 0 && <div className="flex justify-between text-ok"><dt>{tr('مخصوم من ضمان المزاد', 'Deducted from auction guarantee')}</dt><dd>−{sar(inv.depositApplied)}</dd></div>}
        <div className="flex justify-between font-extrabold text-lg"><dt>{tr('المبلغ المطلوب سداده', 'Amount to pay')}</dt><dd>{sar(inv.amountDue)}</dd></div>
        {inv.dueAt && !cancelled && <div className="flex justify-between text-bad"><dt>{tr('آخر موعد للسداد', 'Pay by')}</dt><dd>{dateTime(inv.dueAt)}</dd></div>}
        <div className="pt-1 text-end"><span className={`pill ${cancelled ? 'bg-bad/10 text-bad' : 'bg-gold-soft text-gold-deep'}`}>{cancelled ? tr('ملغى', 'Cancelled') : tr('بانتظار السداد', 'Awaiting payment')}</span></div>
      </dl>
      {onPay && !cancelled && (
        <div className="mt-6 print:hidden">
          <button type="button" className="btn-gold w-full py-3 text-[17px]" onClick={onPay}>{tr('سداد', 'Pay')} {sar(inv.amountDue)}</button>
          <p className="mt-2 text-center text-[13px] text-muted">{tr('مدى أو بطاقة ائتمانية أو Apple Pay', 'mada, credit card or Apple Pay')}</p>
        </div>
      )}
      <div className="mt-6 flex justify-center border-t border-line pt-4"><IcoLogo className="h-8" /></div>
    </article>
  )
}

/** Simplified tax invoice (فاتورة ضريبية مبسطة) — printable; issued at payment. */
function TaxInvoice({ inv }: { inv: Invoice }) {
  const [qr, setQr] = useState('')
  useEffect(() => { zatcaQrDataUrl(inv).then(setQr) }, [inv])
  return (
    <article className="invoice panel mx-auto max-w-2xl bg-white p-6 sm:p-8 print:border-0 print:p-0">
      <div className="flex items-start justify-between gap-4 border-b border-line pb-5">
        <div>
          <h1 className="text-2xl">{tr('فاتورة ضريبية مبسطة', 'Simplified tax invoice')}</h1>
          <p className="num mt-1 text-muted">{inv.number}</p>
          <p className="text-sm text-muted">{dateTime(inv.paidAt ?? inv.issuedAt)}</p>
          {inv.requestNumber && <p className="num text-[12.5px] text-muted">{tr('عن طلب السداد', 'For payment request')} {inv.requestNumber}</p>}
        </div>
        <Logo className="h-14" />
      </div>
      <section className="grid gap-4 border-b border-line py-5 text-sm sm:grid-cols-2">
        <div>
          <p className="font-semibold">{tr('البائع', 'Seller')}</p>
          <p>{tr(SELLER.name, SELLER.nameEn)}</p>
          <p className="text-muted">{tr(SELLER.address, SELLER.addressEn)}</p>
          <p className="num text-muted">{tr('الرقم الضريبي', 'VAT No.')} {SELLER.vatNumber}</p>
        </div>
        <div>
          <p className="font-semibold">{tr('المشتري', 'Buyer')}</p>
          <p>{inv.buyerName}</p>
          <p className="num text-muted" dir="ltr" style={{ textAlign: 'right' }}>{inv.buyerPhone}</p>
        </div>
      </section>
      <table className="tbl my-4">
        <thead><tr><th>{tr('البيان', 'Description')}</th><th>{tr('النوع', 'Type')}</th><th className="text-end">{tr('المبلغ', 'Amount')}</th></tr></thead>
        <tbody>
          <tr><td>{itemLabel(inv)}</td><td>{TYPE_LABEL[inv.type]}</td><td className="num text-end">{sar(inv.subtotal)}</td></tr>
        </tbody>
      </table>
      <div className="flex flex-col-reverse items-start justify-between gap-6 sm:flex-row">
        {qr ? <img src={qr} alt={tr('رمز الاستجابة السريعة للفاتورة', 'Invoice QR code')} className="h-36 w-36" /> : <div className="h-36 w-36" />}
        <dl className="num w-full max-w-xs space-y-1.5 text-sm">
          <div className="flex justify-between"><dt className="text-muted">{tr('المبلغ قبل الضريبة', 'Amount before VAT')}</dt><dd>{sar(inv.subtotal)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">{tr('ضريبة القيمة المضافة 15%', 'VAT 15%')}</dt><dd>{sar(inv.vat)}</dd></div>
          <div className="flex justify-between border-t border-line pt-1.5 font-semibold"><dt>{tr('الإجمالي شامل الضريبة', 'Total incl. VAT')}</dt><dd>{sar(inv.total)}</dd></div>
          {inv.depositApplied > 0 && <div className="flex justify-between text-ok"><dt>{tr('مخصوم من ضمان المزاد', 'Deducted from auction guarantee')}</dt><dd>−{sar(inv.depositApplied)}</dd></div>}
          <div className="flex justify-between font-extrabold text-lg"><dt>{tr('المدفوع', 'Paid')}</dt><dd>{sar(inv.amountDue)}</dd></div>
          <div className="pt-1 text-end"><span className="pill bg-ok/10 text-ok">{tr('مدفوعة', 'Paid')}</span></div>
        </dl>
      </div>
      <div className="mt-6 flex justify-center border-t border-line pt-4"><IcoLogo className="h-8" /></div>
    </article>
  )
}
