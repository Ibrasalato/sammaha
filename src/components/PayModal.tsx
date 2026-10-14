import { tr } from '../lib/i18n'
import { useState } from 'react'
import type { PayMethod } from '../lib/api'
import { IS_DEMO } from '../lib/config'
import { sar } from '../lib/format'
import { api, useLoad } from '../lib/store'
import { Modal } from './ui'

/** cardOnly: invoices, purchases and fees go through the payment channels; the wallet pays guarantees only */
export function PayModal({ open, onClose, title, amount, onPay, cardOnly = false }: {
  open: boolean
  onClose: () => void
  title: string
  amount: number
  onPay: (m: PayMethod) => Promise<void>
  cardOnly?: boolean
}) {
  const wallet = useLoad(() => (open && !cardOnly ? api.myWallet() : Promise.resolve(null)), [open, cardOnly])
  const balance = wallet.data?.balance ?? 0
  const [method, setMethod] = useState<PayMethod>('wallet')
  const [busy, setBusy] = useState(false)
  const enough = balance >= amount
  const m = enough && !cardOnly ? method : 'card'

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="mb-5 flex items-baseline justify-between rounded-lg bg-stone px-4 py-3">
        <span className="text-muted">{tr('المبلغ المستحق', 'Amount due')}</span>
        <span className="num font-extrabold text-2xl font-semibold">{sar(amount)}</span>
      </div>
      <fieldset className="space-y-2">
        <legend className="label">{tr('طريقة الدفع', 'Payment method')}</legend>
        {cardOnly
          ? <p className="rounded-lg bg-stone px-3 py-2 text-sm text-muted">{tr('تُسدَّد هذه العملية بالبطاقة أو Apple Pay فقط؛ رصيد المحفظة مخصص لسداد الضمانات.', 'This is paid by card or Apple Pay only; the wallet balance is for guarantees.')}</p>
          : <label className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${m === 'wallet' ? 'border-pine' : 'border-line'} ${!enough ? 'opacity-50' : ''}`}>
              <input type="radio" name="pm" checked={m === 'wallet'} disabled={!enough} onChange={() => setMethod('wallet')} />
              <span className="flex-1"><span className="block font-semibold">{tr('رصيد المحفظة', 'Wallet balance')}</span><span className="num text-sm text-muted">{tr('الرصيد', 'Balance')} {sar(balance)}{!enough && tr('، غير كافٍ', ', not enough')}</span></span>
            </label>}
        <label className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${m === 'card' ? 'border-pine' : 'border-line'}`}>
          <input type="radio" name="pm" checked={m === 'card'} onChange={() => setMethod('card')} />
          <span className="flex-1"><span className="block font-semibold">{tr('بطاقة مدى أو ائتمانية أو Apple Pay', 'mada, credit card or Apple Pay')}</span><span className="text-sm text-muted">{IS_DEMO ? tr('محاكاة دفع في النسخة التجريبية', 'Simulated payment in the demo') : tr('دفع آمن عبر ميسّر', 'Secure payment via Moyasar')}</span></span>
        </label>
      </fieldset>
      <button className="btn-gold mt-5 w-full" disabled={busy}
        onClick={async () => { setBusy(true); try { await onPay(m); onClose() } catch { /* toast shown by caller */ } finally { setBusy(false) } }}>
        {tr('ادفع', 'Pay')} {sar(amount)}
      </button>
    </Modal>
  )
}
