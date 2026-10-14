import { useEffect, useState } from 'react'
import { SectionCard } from '../../components/dash'
import { ErrorBox, Modal } from '../../components/ui'
import { Req } from '../../components/ProfileFields'
import { dateTime, sar } from '../../lib/format'
import { api, useApp, useLoad } from '../../lib/store'
import type { BankAccount, IbanCheck } from '../../lib/types'
import { tr } from '../../lib/i18n'
import { localizeServerText as L } from '../../lib/serverText'

const statusMap = (): Record<BankAccount['status'], [string, string, string]> => ({
  pending: [tr('بانتظار الاعتماد', 'Awaiting approval'), 'bg-gold-soft text-gold-deep', tr('تراجع الإدارة المالية شهادة الآيبان، ويصلك إشعار عند الاعتماد.', 'The finance team reviews the IBAN certificate; you will be notified once approved.')],
  verified: [tr('معتمد', 'Approved'), 'bg-[#E2F0E8] text-ok', tr('يمكنك طلب استرداد رصيد محفظتك إلى هذا الحساب.', 'You can request a refund of your wallet balance to this account.')],
  rejected: [tr('مرفوض', 'Rejected'), 'bg-bad/10 text-bad', tr('حدّث البيانات أو ارفع شهادة صحيحة.', 'Update the details or upload a valid certificate.')],
})
const wdMap = () => ({ pending: [tr('قيد التنفيذ', 'In progress'), 'text-gold-deep'], processing: [tr('قيد التحويل البنكي', 'Bank transfer in progress'), 'text-info'], completed: [tr('حُوّل', 'Transferred'), 'text-ok'], rejected: [tr('مرفوض، أُعيد المبلغ', 'Rejected, amount returned'), 'text-bad'] }) as const

const toBase64 = (f: File) => new Promise<string>((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => bad(r.error); r.readAsDataURL(f) })

/** the owner's bank account: IBAN checked as typed, holder name, and the IBAN certificate */
function BankForm({ current, onSaved, onCancel }: { current: BankAccount | null; onSaved: (b: BankAccount) => void; onCancel?: () => void }) {
  const { user } = useApp()
  const [iban, setIban] = useState(current?.iban ?? '')
  const [name, setName] = useState(current?.accountName ?? user?.fullName ?? '')
  const [bankName, setBankName] = useState(current?.bankName ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [check, setCheck] = useState<IbanCheck | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  // the IBAN checker runs as the owner types
  useEffect(() => {
    const v = iban.replace(/\s/g, '')
    if (v.length < 15) { setCheck(null); return }
    const t = setTimeout(() => { api.checkIban(v).then(setCheck).catch(() => setCheck(null)) }, 300)
    return () => clearTimeout(t)
  }, [iban])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    if (file && file.size > 5 * 1024 * 1024) { setErr(tr('حجم الملف أكبر من 5 ميجابايت', 'The file is larger than 5 MB')); return }
    setBusy(true)
    try {
      onSaved(await api.saveMyBankAccount({ iban, accountName: name, bankName: check?.bankName ? undefined : bankName, docName: file?.name, docType: file?.type, docBase64: file ? await toBase64(file) : undefined }))
    } catch (x) { setErr((x as Error).message) } finally { setBusy(false) }
  }

  const pretty = (v: string) => v.replace(/\s/g, '').toUpperCase().replace(/(.{4})/g, '$1 ').trim()
  return (
    <form onSubmit={save} className="space-y-4">
      {err && <ErrorBox text={err} />}
      <div>
        <Req htmlFor="iban">{tr('رقم الآيبان (IBAN)', 'IBAN')}</Req>
        <input id="iban" className="field num tracking-wider" dir="ltr" autoComplete="off" placeholder="SA00 0000 0000 0000 0000 0000" maxLength={42} value={pretty(iban)} onChange={(e) => setIban(e.target.value)} required />
        {check && <p className={`hint font-semibold ${check.valid ? 'text-ok' : 'text-bad'}`}>{check.valid ? '✓ ' : '✗ '}{L(check.message ?? '')}</p>}
        {!check && <p className="hint">{tr('24 خانة للحسابات السعودية، تبدأ بـ SA. نتحقق من صحته ونعرف البنك تلقائيًا.', '24 characters for Saudi accounts, starting with SA. We validate it and detect the bank automatically.')}</p>}
      </div>
      {check?.valid && !check.bankName && <div><Req htmlFor="bn">{tr('اسم البنك', 'Bank name')}</Req><input id="bn" className="field" value={bankName} onChange={(e) => setBankName(e.target.value)} required /></div>}
      <div><Req htmlFor="an">{tr('اسم صاحب الحساب', 'Account holder name')}</Req><input id="an" className="field" value={name} onChange={(e) => setName(e.target.value)} required /><p className="hint">{tr('كما يظهر في شهادة الآيبان، ويُفضّل أن يطابق اسمك في المنصة.', 'As shown on the IBAN certificate; ideally it matches your name on the platform.')}</p></div>
      <div>
        <Req htmlFor="doc" optional={!!current}>{tr('شهادة الآيبان', 'IBAN certificate')}</Req>
        <input id="doc" type="file" accept="application/pdf,image/png,image/jpeg" className="field py-2 text-sm" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required={!current} />
        <p className="hint">{tr('PDF أو صورة PNG/JPG حتى 5 ميجابايت، من تطبيق البنك أو الفرع.', 'PDF or PNG/JPG image up to 5 MB, from your bank app or branch.')}{current ? tr(' اتركها فارغة لإبقاء الشهادة الحالية.', ' Leave empty to keep the current certificate.') : ''}</p>
      </div>
      <p className="rounded-lg bg-stone px-4 py-3 text-[13.5px] leading-6 text-muted">{tr('أي تعديل على الحساب يعيده إلى مراجعة الإدارة المالية قبل أي تحويل.', 'Any change to the account sends it back for finance review before any transfer.')}</p>
      <div className="flex gap-2">
        <button className="btn-primary" disabled={busy || (check !== null && !check.valid)}>{busy ? tr('جارٍ الحفظ…', 'Saving…') : tr('حفظ الحساب البنكي', 'Save bank account')}</button>
        {onCancel && <button type="button" className="btn-ghost" onClick={onCancel}>{tr('إلغاء', 'Cancel')}</button>}
      </div>
    </form>
  )
}

/** the owner's bank account card: IBAN checker, holder name and IBAN certificate; used on the wallet page and in settings */
export function BankAccountCard({ onChange }: { onChange?: (b: BankAccount) => void }) {
  const { toast } = useApp()
  const bank = useLoad(() => api.myBankAccount(), [])
  const [edit, setEdit] = useState(false)
  const b = bank.data
  const STATUS = statusMap()
  const showForm = edit || (!bank.loading && !b)
  return (
    <SectionCard title={tr('الحساب البنكي', 'Bank account')} icon="wallet" action={b && !edit && <button className="btn-ghost btn-sm" onClick={() => setEdit(true)}>{tr('تعديل', 'Edit')}</button>}>
      <div className="p-5">
        {showForm ? <BankForm current={b ?? null} onCancel={b ? () => setEdit(false) : undefined} onSaved={(n) => { bank.setData(n); setEdit(false); onChange?.(n); toast(tr('حُفظ الحساب البنكي، وهو الآن بانتظار الاعتماد', 'Bank account saved and now awaiting approval')) }} />
          : b ? (
            <div className="space-y-3 text-[14.5px]">
              <div className="flex flex-wrap items-center gap-2"><b className="num tracking-wider" dir="ltr">{b.iban.replace(/(.{4})/g, '$1 ').trim()}</b><span className={`pill ${STATUS[b.status][1]}`}>{STATUS[b.status][0]}</span></div>
              <p>{b.bankName} · {b.accountName}</p>
              <p className="text-muted">{STATUS[b.status][2]}{b.rejectReason ? tr(` السبب: ${b.rejectReason}`, ` Reason: ${L(b.rejectReason)}`) : ''}</p>
              <button className="text-[13.5px] font-semibold text-gold-deep underline" onClick={async () => {
                try { const d = await api.myBankDocument(); const a = document.createElement('a'); a.href = `data:${d.contentType};base64,${d.base64}`; a.download = d.name; a.click() } catch (e) { toast((e as Error).message, 'bad') }
              }}>{tr('تنزيل شهادة الآيبان المرفوعة', 'Download the uploaded IBAN certificate')} ({b.docName})</button>
            </div>
          ) : null}
      </div>
    </SectionCard>
  )
}

export function BankAndRefunds({ balance, onChange }: { balance: number; onChange: () => void }) {
  const { toast } = useApp()
  const bank = useLoad(() => api.myBankAccount(), [])
  const ws = useLoad(() => api.myWithdrawals(), [])
  const [ask, setAsk] = useState(false)
  const [amount, setAmount] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const b = bank.data
  const WD = wdMap()

  async function withdraw() {
    setBusy(true); setErr('')
    try { await api.requestWithdrawal(Number(amount)); toast(tr('أُرسل طلب الاسترداد', 'Refund request sent')); setAsk(false); setAmount(''); ws.reload(); onChange() } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-2">
      <BankAccountCard onChange={(n) => bank.setData(n)} />
      <SectionCard title={tr('الاسترداد إلى حسابك البنكي', 'Refund to your bank account')} icon="arrow" action={<button className="btn-primary btn-sm" disabled={b?.status !== 'verified' || balance < 10} onClick={() => { setAsk(true); setAmount(String(balance)) }}>{tr('طلب استرداد', 'Request refund')}</button>}>
        <div className="p-5">
          {b?.status !== 'verified' && <p className="mb-3 text-[14px] text-muted">{b ? tr('يُتاح الاسترداد بعد اعتماد حسابك البنكي.', 'Refunds are available once your bank account is approved.') : tr('أضف حسابك البنكي وشهادة الآيبان لتتمكن من الاسترداد.', 'Add your bank account and IBAN certificate to enable refunds.')}</p>}
          {ws.data?.length ? (
            <ul className="divide-y divide-line/70">
              {ws.data.map((w) => (
                <li key={w.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-[14px]">
                  <b className="num">{w.number}</b><span className="num font-bold">{sar(w.amount)}</span>
                  <span className={WD[w.status][1]}>{WD[w.status][0]}</span>
                  {w.transferRef && <span className="num text-muted">{tr('حوالة', 'Transfer')} {w.transferRef}</span>}
                  <span className="ms-auto text-[12.5px] text-muted">{dateTime(w.createdAt)}</span>
                  {w.note && <span className="w-full text-[12.5px] text-bad">{L(w.note)}</span>}
                </li>
              ))}
            </ul>
          ) : <p className="text-[14px] text-muted">{tr('لا توجد طلبات استرداد بعد. يُخصم المبلغ من المحفظة عند الطلب ويُحوّل خلال أيام العمل، ويُعاد إن رُفض الطلب.', 'No refund requests yet. The amount is deducted from your wallet when you request it, transferred within business days, and returned if the request is rejected.')}</p>}
        </div>
      </SectionCard>
      <Modal open={ask} onClose={() => setAsk(false)} title={tr('طلب استرداد إلى حسابك البنكي', 'Request a refund to your bank account')}>
        <div className="space-y-4">
          {err && <ErrorBox text={err} />}
          <p className="text-[14.5px]">{tr('إلى', 'To')} <b>{b?.bankName}</b> <span className="num" dir="ltr">{b?.ibanMasked}</span>. {tr('الرصيد المتاح', 'Available balance')} <b className="num">{sar(balance)}</b>.</p>
          <div><label className="label" htmlFor="wa">{tr('المبلغ (ريال)', 'Amount (SAR)')}</label><input id="wa" className="field num" dir="ltr" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} /><p className="hint">{tr('أقل مبلغ 10 ريال.', 'Minimum 10 SAR.')}</p></div>
          <button className="btn-primary w-full" disabled={busy || !(Number(amount) >= 10) || Number(amount) > balance} onClick={withdraw}>{busy ? tr('جارٍ الإرسال…', 'Sending…') : tr('إرسال الطلب', 'Send request')}</button>
        </div>
      </Modal>
    </div>
  )
}
