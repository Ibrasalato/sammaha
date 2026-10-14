import { tr } from '../lib/i18n'
import { useState } from 'react'
import type { PayMethod } from '../lib/api'
import { IS_DEMO } from '../lib/config'
import { sar } from '../lib/format'
import { api, useApp, useLoad } from '../lib/store'
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
  const { settings } = useApp()
  const channels = (settings.paymentChannels?.length ? settings.paymentChannels : ['mada', 'card', 'applepay']) as PayMethod[]
  const [method, setMethod] = useState<PayMethod>(cardOnly ? channels[0] : 'wallet')
  const [busy, setBusy] = useState(false)
  const enough = balance >= amount
  const m: PayMethod = method === 'wallet' ? (enough && !cardOnly ? 'wallet' : channels[0]) : channels.includes(method) ? method : channels[0]
  const via = IS_DEMO || settings.paymentProvider === 'simulated' ? tr('محاكاة دفع في النسخة التجريبية', 'Simulated payment in the demo') : settings.paymentProvider === 'moyasar' ? tr('دفع آمن عبر ميسّر', 'Secure payment via Moyasar') : tr('دفع آمن عبر هايبر باي', 'Secure payment via HyperPay')
  const CH: Record<string, { name: string; badges: string[] }> = {
    mada: { name: tr('بطاقة مدى', 'mada card'), badges: ['mada'] },
    card: { name: tr('بطاقة ائتمانية', 'Credit card'), badges: ['VISA', 'Mastercard'] },
    applepay: { name: 'Apple Pay', badges: ['Apple Pay'] },
  }

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
        {channels.map((c) => (
          <label key={c} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${m === c ? 'border-pine' : 'border-line'}`}>
            <input type="radio" name="pm" checked={m === c} onChange={() => setMethod(c)} />
            <span className="flex-1"><span className="block font-semibold">{CH[c]?.name ?? c}</span><span className="text-sm text-muted">{via}</span></span>
            <span className="flex gap-1" dir="ltr">{(CH[c]?.badges ?? []).map((b) => <span key={b} className="rounded border border-line bg-paper px-1.5 py-0.5 text-[11px] font-extrabold text-ink">{b}</span>)}</span>
          </label>
        ))}
      </fieldset>
      <button className="btn-gold mt-5 w-full" disabled={busy}
        onClick={async () => { setBusy(true); try { await onPay(m); onClose() } catch { /* toast shown by caller */ } finally { setBusy(false) } }}>
        {tr('ادفع', 'Pay')} {sar(amount)}
      </button>
    </Modal>
  )
}
