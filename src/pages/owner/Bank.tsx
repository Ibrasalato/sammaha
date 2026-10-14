import { useEffect, useState } from 'react'
import { SectionCard } from '../../components/dash'
import { ErrorBox, Modal } from '../../components/ui'
import { Req } from '../../components/ProfileFields'
import { dateTime, sar } from '../../lib/format'
import { api, useApp, useLoad } from '../../lib/store'
import type { BankAccount, IbanCheck } from '../../lib/types'

const STATUS: Record<BankAccount['status'], [string, string, string]> = {
  pending: ['بانتظار الاعتماد', 'bg-gold-soft text-gold-deep', 'تراجع الإدارة المالية شهادة الآيبان، ويصلك إشعار عند الاعتماد.'],
  verified: ['معتمد', 'bg-[#E2F0E8] text-ok', 'يمكنك طلب استرداد رصيد محفظتك إلى هذا الحساب.'],
  rejected: ['مرفوض', 'bg-bad/10 text-bad', 'حدّث البيانات أو ارفع شهادة صحيحة.'],
}
const WD = { pending: ['قيد التنفيذ', 'text-gold-deep'], completed: ['حُوّل', 'text-ok'], rejected: ['مرفوض، أُعيد المبلغ', 'text-bad'] } as const

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
    if (file && file.size > 5 * 1024 * 1024) { setErr('حجم الملف أكبر من 5 ميجابايت'); return }
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
        <Req htmlFor="iban">رقم الآيبان (IBAN)</Req>
        <input id="iban" className="field num tracking-wider" dir="ltr" autoComplete="off" placeholder="SA00 0000 0000 0000 0000 0000" maxLength={42} value={pretty(iban)} onChange={(e) => setIban(e.target.value)} required />
        {check && <p className={`hint font-semibold ${check.valid ? 'text-ok' : 'text-bad'}`}>{check.valid ? '✓ ' : '✗ '}{check.message}</p>}
        {!check && <p className="hint">24 خانة للحسابات السعودية، تبدأ بـ SA. نتحقق من صحته ونعرف البنك تلقائيًا.</p>}
      </div>
      {check?.valid && !check.bankName && <div><Req htmlFor="bn">اسم البنك</Req><input id="bn" className="field" value={bankName} onChange={(e) => setBankName(e.target.value)} required /></div>}
      <div><Req htmlFor="an">اسم صاحب الحساب</Req><input id="an" className="field" value={name} onChange={(e) => setName(e.target.value)} required /><p className="hint">كما يظهر في شهادة الآيبان، ويُفضّل أن يطابق اسمك في المنصة.</p></div>
      <div>
        <Req htmlFor="doc" optional={!!current}>شهادة الآيبان</Req>
        <input id="doc" type="file" accept="application/pdf,image/png,image/jpeg" className="field py-2 text-sm" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required={!current} />
        <p className="hint">PDF أو صورة PNG/JPG حتى 5 ميجابايت، من تطبيق البنك أو الفرع.{current ? ' اتركها فارغة لإبقاء الشهادة الحالية.' : ''}</p>
      </div>
      <p className="rounded-lg bg-stone px-4 py-3 text-[13.5px] leading-6 text-muted">أي تعديل على الحساب يعيده إلى مراجعة الإدارة المالية قبل أي تحويل.</p>
      <div className="flex gap-2">
        <button className="btn-primary" disabled={busy || (check !== null && !check.valid)}>{busy ? 'جارٍ الحفظ…' : 'حفظ الحساب البنكي'}</button>
        {onCancel && <button type="button" className="btn-ghost" onClick={onCancel}>إلغاء</button>}
      </div>
    </form>
  )
}

export function BankAndRefunds({ balance, onChange }: { balance: number; onChange: () => void }) {
  const { toast } = useApp()
  const bank = useLoad(() => api.myBankAccount(), [])
  const ws = useLoad(() => api.myWithdrawals(), [])
  const [edit, setEdit] = useState(false)
  const [ask, setAsk] = useState(false)
  const [amount, setAmount] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const b = bank.data
  const showForm = edit || (!bank.loading && !b)

  async function withdraw() {
    setBusy(true); setErr('')
    try { await api.requestWithdrawal(Number(amount)); toast('أُرسل طلب الاسترداد'); setAsk(false); setAmount(''); ws.reload(); onChange() } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-2">
      <SectionCard title="الحساب البنكي" icon="wallet" action={b && !edit && <button className="btn-ghost btn-sm" onClick={() => setEdit(true)}>تعديل</button>}>
        <div className="p-5">
          {showForm ? <BankForm current={b ?? null} onCancel={b ? () => setEdit(false) : undefined} onSaved={(n) => { bank.setData(n); setEdit(false); toast('حُفظ الحساب البنكي، وهو الآن بانتظار الاعتماد') }} />
            : b ? (
              <div className="space-y-3 text-[14.5px]">
                <div className="flex flex-wrap items-center gap-2"><b className="num tracking-wider" dir="ltr">{b.iban.replace(/(.{4})/g, '$1 ').trim()}</b><span className={`pill ${STATUS[b.status][1]}`}>{STATUS[b.status][0]}</span></div>
                <p>{b.bankName} · {b.accountName}</p>
                <p className="text-muted">{STATUS[b.status][2]}{b.rejectReason ? ` السبب: ${b.rejectReason}` : ''}</p>
                <button className="text-[13.5px] font-semibold text-gold-deep underline" onClick={async () => {
                  try { const d = await api.myBankDocument(); const a = document.createElement('a'); a.href = `data:${d.contentType};base64,${d.base64}`; a.download = d.name; a.click() } catch (e) { toast((e as Error).message, 'bad') }
                }}>تنزيل شهادة الآيبان المرفوعة ({b.docName})</button>
              </div>
            ) : null}
        </div>
      </SectionCard>
      <SectionCard title="الاسترداد إلى حسابك البنكي" icon="arrow" action={<button className="btn-primary btn-sm" disabled={b?.status !== 'verified' || balance < 10} onClick={() => { setAsk(true); setAmount(String(balance)) }}>طلب استرداد</button>}>
        <div className="p-5">
          {b?.status !== 'verified' && <p className="mb-3 text-[14px] text-muted">{b ? 'يُتاح الاسترداد بعد اعتماد حسابك البنكي.' : 'أضف حسابك البنكي وشهادة الآيبان لتتمكن من الاسترداد.'}</p>}
          {ws.data?.length ? (
            <ul className="divide-y divide-line/70">
              {ws.data.map((w) => (
                <li key={w.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-[14px]">
                  <b className="num">{w.number}</b><span className="num font-bold">{sar(w.amount)}</span>
                  <span className={WD[w.status][1]}>{WD[w.status][0]}</span>
                  {w.transferRef && <span className="num text-muted">حوالة {w.transferRef}</span>}
                  <span className="ms-auto text-[12.5px] text-muted">{dateTime(w.createdAt)}</span>
                  {w.note && <span className="w-full text-[12.5px] text-bad">{w.note}</span>}
                </li>
              ))}
            </ul>
          ) : <p className="text-[14px] text-muted">لا توجد طلبات استرداد بعد. يُخصم المبلغ من المحفظة عند الطلب ويُحوّل خلال أيام العمل، ويُعاد إن رُفض الطلب.</p>}
        </div>
      </SectionCard>
      <Modal open={ask} onClose={() => setAsk(false)} title="طلب استرداد إلى حسابك البنكي">
        <div className="space-y-4">
          {err && <ErrorBox text={err} />}
          <p className="text-[14.5px]">إلى <b>{b?.bankName}</b> <span className="num" dir="ltr">{b?.ibanMasked}</span>. الرصيد المتاح <b className="num">{sar(balance)}</b>.</p>
          <div><label className="label" htmlFor="wa">المبلغ (ريال)</label><input id="wa" className="field num" dir="ltr" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} /><p className="hint">أقل مبلغ 10 ريال.</p></div>
          <button className="btn-primary w-full" disabled={busy || !(Number(amount) >= 10) || Number(amount) > balance} onClick={withdraw}>{busy ? 'جارٍ الإرسال…' : 'إرسال الطلب'}</button>
        </div>
      </Modal>
    </div>
  )
}
