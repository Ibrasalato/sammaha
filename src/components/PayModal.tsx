import { useState } from 'react'
import type { PayMethod } from '../lib/api'
import { IS_DEMO } from '../lib/config'
import { sar } from '../lib/format'
import { api, useLoad } from '../lib/store'
import { Modal } from './ui'

export function PayModal({ open, onClose, title, amount, onPay }: {
  open: boolean
  onClose: () => void
  title: string
  amount: number
  onPay: (m: PayMethod) => Promise<void>
}) {
  const wallet = useLoad(() => (open ? api.myWallet() : Promise.resolve(null)), [open])
  const balance = wallet.data?.balance ?? 0
  const [method, setMethod] = useState<PayMethod>('wallet')
  const [busy, setBusy] = useState(false)
  const enough = balance >= amount
  const m = enough ? method : 'card'

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="mb-5 flex items-baseline justify-between rounded-lg bg-stone px-4 py-3">
        <span className="text-muted">المبلغ المستحق</span>
        <span className="num font-extrabold text-2xl font-semibold">{sar(amount)}</span>
      </div>
      <fieldset className="space-y-2">
        <legend className="label">طريقة الدفع</legend>
        <label className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${m === 'wallet' ? 'border-navy' : 'border-line'} ${!enough ? 'opacity-50' : ''}`}>
          <input type="radio" name="pm" checked={m === 'wallet'} disabled={!enough} onChange={() => setMethod('wallet')} />
          <span className="flex-1"><span className="block font-semibold">رصيد المحفظة</span><span className="num text-sm text-muted">الرصيد {sar(balance)}{!enough && '، غير كافٍ'}</span></span>
        </label>
        <label className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${m === 'card' ? 'border-navy' : 'border-line'}`}>
          <input type="radio" name="pm" checked={m === 'card'} onChange={() => setMethod('card')} />
          <span className="flex-1"><span className="block font-semibold">بطاقة مدى أو ائتمانية أو Apple Pay</span><span className="text-sm text-muted">{IS_DEMO ? 'محاكاة دفع في النسخة التجريبية' : 'دفع آمن عبر ميسّر'}</span></span>
        </label>
      </fieldset>
      <button className="btn-gold mt-5 w-full" disabled={busy}
        onClick={async () => { setBusy(true); try { await onPay(m); onClose() } catch { /* toast shown by caller */ } finally { setBusy(false) } }}>
        ادفع {sar(amount)}
      </button>
    </Modal>
  )
}
