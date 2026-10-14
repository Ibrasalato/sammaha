import { useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Icon, StatTile } from '../../components/dash'
import { OWNER_COLUMNS, OwnerCell, ownerColumns, useOwners } from '../../components/OwnerCell'
import { Empty, ErrorBox, Loading, Modal, PageHead, Segmented, TypeBadge } from '../../components/ui'
import { NoResults, TableTools, useTableFilter } from '../../components/TableTools'
import { TYPE_LABEL } from '../../lib/config'
import { date, dateTime, num, sar } from '../../lib/format'
import { can } from '../../lib/permissions'
import { downloadCsv } from '../../lib/print'
import { usePrint } from '../../components/usePrint'
import { api, useApp, useLoad } from '../../lib/store'
import type { BankStatus, DepositRow, DocumentFile, StaffBankAccount, WalletRow, Withdrawal, WithdrawalStatus } from '../../lib/types'
import { tr } from '../../lib/i18n'
import { localizeServerText as L } from '../../lib/serverText'

const BANK: Record<BankStatus, [string, string]> = {
  get pending(): [string, string] { return [tr('بانتظار الاعتماد', 'Awaiting approval'), 'bg-gold-soft text-gold-deep'] },
  get verified(): [string, string] { return [tr('معتمد', 'Approved'), 'bg-[#E2F0E8] text-ok'] },
  get rejected(): [string, string] { return [tr('مرفوض', 'Rejected'), 'bg-bad/10 text-bad'] },
}
const WD: Record<WithdrawalStatus, [string, string]> = {
  get pending(): [string, string] { return [tr('قيد التنفيذ', 'In progress'), 'bg-gold-soft text-gold-deep'] },
  get processing(): [string, string] { return [tr('قيد التحويل البنكي', 'Bank transfer in progress'), 'bg-info/10 text-info'] },
  get completed(): [string, string] { return [tr('حُوّل', 'Transferred'), 'bg-[#E2F0E8] text-ok'] },
  get rejected(): [string, string] { return [tr('مرفوض', 'Rejected'), 'bg-bad/10 text-bad'] },
}
const TX: Record<string, string> = {
  get topup() { return tr('شحن', 'Top-up') },
  get deposit() { return tr('ضمان مزاد', 'Auction guarantee') },
  get refund() { return tr('استرداد', 'Refund') },
  get invoice_payment() { return tr('سداد فاتورة', 'Invoice payment') },
  get service_fee() { return tr('رسوم استثمار', 'Investment fee') },
  get investment_payout() { return tr('عائد استثمار', 'Investment payout') },
  get bid_deposit() { return tr('ضمان دخول', 'Entry guarantee') },
  get sale_payout() { return tr('ثمن بيع', 'Sale proceeds') },
  get purchase() { return tr('شراء اسم', 'Name purchase') },
  get withdrawal() { return tr('استرداد للبنك', 'Refund to bank') },
  get adjustment() { return tr('تسوية', 'Adjustment') },
}

/** the IBAN certificate in a dialog: PDF inline, images as images, and a download link */
export function DocViewer({ doc, onClose }: { doc: DocumentFile | null; onClose: () => void }) {
  const url = doc ? `data:${doc.contentType};base64,${doc.base64}` : ''
  return (
    <Modal open={!!doc} onClose={onClose} title={tr('شهادة الآيبان', 'IBAN certificate')} wide>
      {doc && (
        <div className="space-y-3">
          {doc.contentType === 'application/pdf'
            ? <iframe title={tr('شهادة الآيبان', 'IBAN certificate')} src={url} className="h-[70vh] w-full rounded-lg border border-line" />
            : <img src={url} alt={tr('شهادة الآيبان', 'IBAN certificate')} className="mx-auto max-h-[70vh] rounded-lg border border-line" />}
          <a href={url} download={doc.name} className="btn-ghost btn-sm">{tr('تنزيل الملف', 'Download file')}</a>
        </div>
      )}
    </Modal>
  )
}

function Ask({ title, label, hint, danger, onClose, onSubmit, children }: { title: string; label: string; hint?: string; danger?: boolean; onClose: () => void; onSubmit: (v: string) => Promise<void>; children?: React.ReactNode }) {
  const [v, setV] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <Modal open onClose={onClose} title={title}>
      <div className="space-y-3">
        {err && <ErrorBox text={err} />}
        {children}
        <div><label className="label" htmlFor="ask">{label}</label><input id="ask" className="field" value={v} onChange={(e) => setV(e.target.value)} autoFocus /></div>
        {hint && <p className="hint">{hint}</p>}
        <button className={`${danger ? 'btn-danger' : 'btn-primary'} w-full`} disabled={busy || v.trim().length < 3} onClick={async () => {
          setBusy(true); setErr('')
          try { await onSubmit(v.trim()); onClose() } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
        }}>{busy ? tr('جارٍ التنفيذ…', 'Processing…') : title}</button>
      </div>
    </Modal>
  )
}

function WithdrawalsTable({ list, onChange }: { list: Withdrawal[]; onChange: () => void }) {
  const { user, toast } = useApp()
  const [ask, setAsk] = useState<{ w: Withdrawal; kind: 'complete' | 'reject' } | null>(null)
  const canRefund = can(user, 'wallets.refund')
  const payout = useLoad(() => api.payoutStatus().catch(() => ({ enabled: false, provider: 'manual' })), [])
  const [paying, setPaying] = useState<Withdrawal | null>(null)
  const [busy, setBusy] = useState(false)
  if (!list.length) return <Empty title={tr('لا توجد طلبات استرداد بهذه التصفية', 'No refund requests match this filter')} />
  return (
    <div className="panel overflow-x-auto">
      <table className="tbl">
        <thead><tr><th>{tr('الطلب', 'Request')}</th><th>{tr('المالك', 'Owner')}</th><th>{tr('المبلغ', 'Amount')}</th><th>{tr('الحساب', 'Account')}</th><th>{tr('الحالة', 'Status')}</th><th>{tr('التاريخ', 'Date')}</th><th className="no-print"></th></tr></thead>
        <tbody>
          {list.map((w) => (
            <tr key={w.id}>
              <td className="num font-semibold">{w.number}{w.byStaff && <span className="block text-[12px] font-normal text-muted">{tr('من الإدارة المالية', 'By the finance team')}</span>}</td>
              <td><OwnerCell id={w.userId} name={w.ownerName} /></td>
              <td className="num whitespace-nowrap font-bold">{sar(w.amount)}</td>
              <td className="text-[13px]"><span className="num" dir="ltr">{w.iban}</span><span className="block text-muted">{w.bankName} · {w.accountName}</span></td>
              <td><span className={`pill ${WD[w.status][1]}`}>{WD[w.status][0]}</span>{w.transferRef && <span className="num block text-[12px] text-muted">{tr('حوالة', 'Transfer')} {w.transferRef}</span>}{w.note && <span className="block max-w-[14rem] text-[12px] text-muted">{L(w.note)}</span>}{w.payoutError && w.status === 'pending' && <span className="block max-w-[14rem] text-[12px] text-bad">{tr('تعذّر التحويل المباشر:', 'Direct transfer failed:')} {L(w.payoutError)}</span>}</td>
              <td className="whitespace-nowrap text-[13px] text-muted">{dateTime(w.createdAt)}</td>
              <td className="no-print whitespace-nowrap">{canRefund && w.status === 'pending' && <div className="flex gap-1">
                {payout.data?.enabled && <button className="btn-gold btn-sm" onClick={() => setPaying(w)}>{tr('موافقة وتحويل مباشر', 'Approve & transfer')}</button>}
                <button className={`${payout.data?.enabled ? 'btn-ghost' : 'btn-primary'} btn-sm`} onClick={() => setAsk({ w, kind: 'complete' })}>{payout.data?.enabled ? tr('حوّلته يدويًا', 'Transferred manually') : tr('تم التحويل', 'Transferred')}</button>
                <button className="btn-danger btn-sm" onClick={() => setAsk({ w, kind: 'reject' })}>{tr('رفض', 'Reject')}</button>
              </div>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {paying && <Modal open onClose={() => setPaying(null)} title={tr('تحويل مباشر إلى حساب المالك', 'Direct transfer to the owner’s account')}>
        <div className="space-y-3">
          <p>{tr(`سيُحوَّل ${sar(paying.amount)} الآن إلى ${paying.bankName} (${paying.accountName}) عبر بوابة الدفع، ويصل المالك إشعار عند اكتمال التحويل.`, `${sar(paying.amount)} will be sent now to ${paying.bankName} (${paying.accountName}) through the payment gateway; the owner is notified when it completes.`)}</p>
          <p className="num text-sm text-muted" dir="ltr">{paying.iban}</p>
          <button className="btn-gold w-full" disabled={busy} onClick={async () => {
            setBusy(true)
            try {
              const r = await api.payoutWithdrawal(paying.id)
              toast(r.status === 'completed' ? tr('تم التحويل إلى حساب المالك', 'Transferred to the owner’s account') : r.status === 'processing' ? tr('أُرسل التحويل، وهو قيد المعالجة لدى البنك', 'Transfer sent; the bank is processing it') : tr('تعذّر التحويل المباشر، راجع السبب في الجدول', 'The direct transfer failed; see the reason in the table'), r.status === 'pending' ? 'bad' : undefined)
              setPaying(null); onChange()
            } catch (e) { toast((e as Error).message, 'bad') } finally { setBusy(false) }
          }}>{busy ? tr('جارٍ التحويل…', 'Transferring…') : tr('تأكيد التحويل', 'Confirm transfer')}</button>
        </div>
      </Modal>}
      {ask && <Ask title={ask.kind === 'complete' ? tr('تأكيد التحويل', 'Confirm transfer') : tr('رفض طلب الاسترداد', 'Reject refund request')} label={ask.kind === 'complete' ? tr('رقم الحوالة البنكية', 'Bank transfer reference') : tr('سبب الرفض (يصل للمالك)', 'Rejection reason (sent to the owner)')} danger={ask.kind === 'reject'}
        hint={ask.kind === 'complete' ? tr(`حوّل ${sar(ask.w.amount)} إلى ${ask.w.bankName} ثم اكتب رقم الحوالة.`, `Transfer ${sar(ask.w.amount)} to ${ask.w.bankName}, then enter the transfer reference.`) : tr(`يُعاد ${sar(ask.w.amount)} إلى محفظة المالك.`, `${sar(ask.w.amount)} will be returned to the owner’s wallet.`)}
        onClose={() => setAsk(null)} onSubmit={async (v) => { await (ask.kind === 'complete' ? api.completeWithdrawal(ask.w.id, v) : api.rejectWithdrawal(ask.w.id, v)); toast(ask.kind === 'complete' ? tr('سُجّل التحويل', 'Transfer recorded') : tr('رُفض الطلب وأُعيد المبلغ', 'Request rejected and amount returned')); onChange() }} />}
    </div>
  )
}

function WalletDialog({ row, onClose, onChange }: { row: WalletRow; onClose: () => void; onChange: () => void }) {
  const { user, toast } = useApp()
  const { data, error, reload } = useLoad(() => api.walletDetail(row.userId), [row.userId])
  const [mode, setMode] = useState<'refund' | 'adjust' | null>(null)
  const [amount, setAmount] = useState('')
  const [ref2, setRef2] = useState('')
  const [note, setNote] = useState('')
  const [sign, setSign] = useState<1 | -1>(1)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const w = data?.wallet ?? row
  async function submit() {
    setBusy(true); setErr('')
    try {
      if (mode === 'refund') await api.directRefund(row.userId, Number(amount), ref2, note || undefined)
      else await api.adjustWallet(row.userId, sign * Number(amount), note)
      toast(mode === 'refund' ? tr('سُجّل الاسترداد', 'Refund recorded') : tr('سُجّلت التسوية', 'Adjustment recorded')); setMode(null); setAmount(''); setRef2(''); setNote(''); reload(); onChange()
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title={tr(`محفظة ${row.ownerName}`, `${row.ownerName}’s wallet`)} wide>
      <div className="space-y-5">
        {error && <ErrorBox text={error} />}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile icon="wallet" tone="pine" label={tr('الرصيد', 'Balance')} value={sar(w.balance)} />
          <StatTile icon="plus" tone="green" label={tr('الوارد', 'Incoming')} value={sar(w.totalIn)} />
          <StatTile icon="arrow" tone="red" label={tr('المصروف', 'Outgoing')} value={sar(w.totalOut)} />
          <StatTile icon="clock" tone="gold" label={tr('استرداد قيد التنفيذ', 'Refunds in progress')} value={sar(w.pendingWithdrawals)} />
        </div>
        <div className="rounded-lg border border-line p-4 text-[14.5px]">
          <b>{tr('الحساب البنكي: ', 'Bank account: ')}</b>
          {data?.bank ? <><span className="num" dir="ltr">{data.bank.iban}</span> · {data.bank.bankName} · {data.bank.accountName} <span className={`pill ${BANK[data.bank.status][1]}`}>{BANK[data.bank.status][0]}</span></> : <span className="text-muted">{tr('لم يضف حسابًا بنكيًا', 'No bank account added')}</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          {can(user, 'wallets.refund') && <button className="btn-primary btn-sm" disabled={data?.bank?.status !== 'verified' || w.balance <= 0} title={data?.bank?.status !== 'verified' ? tr('يلزم حساب بنكي معتمد', 'An approved bank account is required') : ''} onClick={() => { setMode('refund'); setAmount(String(w.balance)) }}>{tr('استرداد إلى الحساب البنكي', 'Refund to bank account')}</button>}
          {can(user, 'wallets.adjust') && <button className="btn-ghost btn-sm" onClick={() => setMode('adjust')}>{tr('تسوية الرصيد', 'Adjust balance')}</button>}
        </div>
        {mode && (
          <div className="space-y-3 rounded-lg border border-pine/30 bg-pine-soft/40 p-4">
            {err && <ErrorBox text={err} />}
            {mode === 'adjust' && <div className="flex gap-2">{([[1, tr('إضافة للرصيد', 'Add to balance')], [-1, tr('خصم من الرصيد', 'Deduct from balance')]] as const).map(([s, l]) => <button key={s} type="button" className={`btn-sm rounded-lg border-2 px-3 ${sign === s ? 'border-pine bg-paper' : 'border-line'}`} onClick={() => setSign(s)}>{l}</button>)}</div>}
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className="label" htmlFor="am">{tr('المبلغ (⃁)', 'Amount (⃁)')}</label><input id="am" className="field num" dir="ltr" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} /></div>
              {mode === 'refund' && <div><label className="label" htmlFor="tr">{tr('رقم الحوالة البنكية', 'Bank transfer reference')}</label><input id="tr" className="field num" dir="ltr" value={ref2} onChange={(e) => setRef2(e.target.value)} /></div>}
            </div>
            <div><label className="label" htmlFor="nt">{mode === 'refund' ? tr('ملاحظة (اختياري)', 'Note (optional)') : tr('سبب التسوية (يظهر في كشف المالك)', 'Adjustment reason (shown on the owner’s statement)')}</label><input id="nt" className="field" value={note} onChange={(e) => setNote(e.target.value)} /></div>
            <div className="flex gap-2"><button className="btn-primary btn-sm" disabled={busy || !Number(amount)} onClick={submit}>{busy ? tr('جارٍ التنفيذ…', 'Processing…') : tr('تنفيذ', 'Execute')}</button><button className="btn-ghost btn-sm" onClick={() => setMode(null)}>{tr('إلغاء', 'Cancel')}</button></div>
          </div>
        )}
        <div>
          <h3 className="mb-2 font-bold">{tr('كشف الحركات', 'Transaction statement')}</h3>
          {data ? (
            <div className="max-h-[40vh] overflow-y-auto rounded-lg border border-line">
              <table className="tbl"><thead><tr><th>{tr('التاريخ', 'Date')}</th><th>{tr('النوع', 'Type')}</th><th>{tr('البيان', 'Description')}</th><th>{tr('المبلغ', 'Amount')}</th></tr></thead>
                <tbody>{data.txs.map((t) => <tr key={t.id}><td className="whitespace-nowrap text-[13px] text-muted">{dateTime(t.createdAt)}</td><td className="whitespace-nowrap text-[13px]">{TX[t.kind] ?? t.kind}</td><td className="text-[13.5px]">{L(t.note ?? '')}</td><td className={`num whitespace-nowrap font-semibold ${t.amount < 0 ? 'text-bad' : 'text-ok'}`} dir="ltr">{t.amount > 0 ? '+' : ''}{num(t.amount)}</td></tr>)}</tbody>
              </table>
            </div>
          ) : <Loading />}
        </div>
      </div>
    </Modal>
  )
}

function BanksTable({ list, onChange }: { list: StaffBankAccount[]; onChange: () => void }) {
  const { user, toast } = useApp()
  const [doc, setDoc] = useState<DocumentFile | null>(null)
  const [rej, setRej] = useState<StaffBankAccount | null>(null)
  const verify = can(user, 'banks.verify')
  if (!list.length) return <Empty title={tr('لا توجد حسابات بنكية بهذه التصفية', 'No bank accounts match this filter')} />
  return (
    <div className="panel overflow-x-auto">
      <table className="tbl">
        <thead><tr><th>{tr('المالك', 'Owner')}</th><th>{tr('الآيبان', 'IBAN')}</th><th>{tr('البنك', 'Bank')}</th><th>{tr('صاحب الحساب', 'Account holder')}</th><th>{tr('الحالة', 'Status')}</th><th>{tr('آخر تحديث', 'Last updated')}</th><th className="no-print"></th></tr></thead>
        <tbody>
          {list.map((b) => {
            const mismatch = b.account.accountName.replace(/\s+/g, '') !== b.ownerName.replace(/\s+/g, '')
            return (
              <tr key={b.userId}>
                <td><OwnerCell id={b.userId} name={b.ownerName} /></td>
                <td className="num whitespace-nowrap" dir="ltr" style={{ textAlign: 'right' }}>{b.account.iban}</td>
                <td>{b.account.bankName}</td>
                <td>{b.account.accountName}{mismatch && <span className="block text-[12px] text-gold-deep">{tr('يختلف عن اسم الحساب في المنصة، تحقق من الشهادة', 'Differs from the platform account name; check the certificate')}</span>}</td>
                <td><span className={`pill ${BANK[b.account.status][1]}`}>{BANK[b.account.status][0]}</span>{b.account.rejectReason && <span className="block text-[12px] text-bad">{L(b.account.rejectReason)}</span>}{b.account.reviewedBy && <span className="block text-[12px] text-muted">{b.account.reviewedBy}</span>}</td>
                <td className="whitespace-nowrap text-[13px] text-muted">{dateTime(b.account.updatedAt)}</td>
                <td className="no-print whitespace-nowrap">{verify && <div className="flex gap-1">
                  <button className="btn-ghost btn-sm" onClick={async () => { try { setDoc(await api.bankDocument(b.userId)) } catch (e) { toast((e as Error).message, 'bad') } }}>{tr('الشهادة', 'Certificate')}</button>
                  {b.account.status !== 'verified' && <button className="btn-primary btn-sm" onClick={async () => { try { await api.verifyBankAccount(b.userId); toast(tr('اعتُمد الحساب', 'Account approved')); onChange() } catch (e) { toast((e as Error).message, 'bad') } }}>{tr('اعتماد', 'Approve')}</button>}
                  {b.account.status !== 'rejected' && <button className="btn-danger btn-sm" onClick={() => setRej(b)}>{tr('رفض', 'Reject')}</button>}
                </div>}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <DocViewer doc={doc} onClose={() => setDoc(null)} />
      {rej && <Ask title={tr('رفض الحساب البنكي', 'Reject bank account')} label={tr('السبب (يصل للمالك)', 'Reason (sent to the owner)')} danger onClose={() => setRej(null)} onSubmit={async (v) => { await api.rejectBankAccount(rej.userId, v); toast(tr('رُفض الحساب', 'Account rejected')); onChange() }} />}
    </div>
  )
}

export function AdminWallets() {
  const print = usePrint()
  const { user } = useApp()
  const owners = useOwners()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as 'wallets' | 'withdrawals' | 'banks') ?? (can(user, 'wallets.view') ? 'wallets' : can(user, 'banks.verify') ? 'banks' : 'withdrawals')
  const [wStatus, setWStatus] = useState<WithdrawalStatus | 'all'>('pending')
  const [bStatus, setBStatus] = useState<BankStatus | 'all'>('pending')
  const wallets = useLoad(() => (can(user, 'wallets.view') ? api.wallets() : Promise.resolve([])), [])
  const ws = useLoad(() => api.withdrawals(wStatus), [wStatus])
  const banks = useLoad(() => (can(user, 'banks.verify') || can(user, 'wallets.view') ? api.bankAccounts(bStatus) : Promise.resolve([])), [bStatus])
  const [open, setOpen] = useState<WalletRow | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const tf = useTableFilter(wallets.data, {
    fields: (w) => [w.ownerName, w.phone],
    filters: [
      { key: 'bal', label: tr('الرصيد', 'Balance'), options: [['', tr('الكل', 'All')], ['pos', tr('رصيد أكبر من صفر', 'Balance above zero')], ['zero', tr('رصيد صفر', 'Zero balance')]], test: (w, v) => (v === 'pos' ? w.balance > 0 : w.balance === 0) },
      { key: 'bank', label: tr('الحساب البنكي', 'Bank account'), options: [['', tr('الكل', 'All')], ['verified', tr('معتمد', 'Approved')], ['pending', tr('بانتظار الاعتماد', 'Awaiting approval')], ['none', tr('بدون حساب', 'No account')]], test: (w, v) => (v === 'none' ? !w.bankStatus : w.bankStatus === v) },
    ],
  })
  const list = [...tf.list]
  const total = list.reduce((s, w) => s + w.balance, 0)
  const pendingCount = (ws.data ?? []).filter((w) => w.status === 'pending').length
  const reload = () => { wallets.reload(); ws.reload(); banks.reload() }
  const setTab = (t: string) => setParams((p) => { p.set('tab', t); return p }, { replace: true })

  return (
    <>
      <PageHead title={tr('المحافظ والاسترداد', 'Wallets & refunds')} sub={tr('أرصدة محافظ الملاك، وطلبات الاسترداد إلى الحسابات البنكية، واعتماد شهادات الآيبان.', 'Owner wallet balances, refund requests to bank accounts, and IBAN certificate approval.')}
        action={tab === 'wallets' && <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => downloadCsv(`${tr('المحافظ', 'wallets')}-${new Date().toISOString().slice(0, 10)}.csv`, [[tr('المالك', 'Owner'), ...OWNER_COLUMNS, tr('الرصيد', 'Balance'), tr('الوارد', 'Incoming'), tr('المصروف', 'Outgoing'), tr('استرداد قيد التنفيذ', 'Refunds in progress'), tr('عدد الحركات', 'Transactions'), tr('آخر حركة', 'Last transaction'), tr('الحساب البنكي', 'Bank account')],
            ...list.map((w) => [w.ownerName, ...ownerColumns(owners.get(w.userId)), w.balance, w.totalIn, w.totalOut, w.pendingWithdrawals, w.txCount, w.lastTxAt ? date(w.lastTxAt) : '', w.bankStatus ? `${w.bankName} (${BANK[w.bankStatus][0]})` : tr('بدون', 'None')])])}>{tr('تصدير Excel', 'Export to Excel')}</button>
          <button className="btn-primary" onClick={() => print({ title: tr('تقرير المحافظ', 'Wallets report'), subtitle: tr(`${num(list.length)} محفظة · إجمالي الأرصدة ${sar(total)}`, `${num(list.length)} wallets · Total balances ${sar(total)}`), el: ref.current, landscape: true })}><Icon name="file" className="h-4 w-4" />{tr('طباعة التقرير', 'Print report')}</button>
        </div>} />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon="wallet" tone="pine" label={tr('إجمالي أرصدة الملاك', 'Total owner balances')} value={sar((wallets.data ?? []).reduce((s, w) => s + w.balance, 0))} />
        <StatTile icon="users" tone="blue" label={tr('محافظ برصيد', 'Wallets with balance')} value={num((wallets.data ?? []).filter((w) => w.balance > 0).length)} />
        <StatTile icon="clock" tone="gold" label={tr('استرداد قيد التنفيذ', 'Refunds in progress')} value={sar((wallets.data ?? []).reduce((s, w) => s + w.pendingWithdrawals, 0))} />
        <StatTile icon="shield" tone="red" label={tr('حسابات بانتظار الاعتماد', 'Accounts awaiting approval')} value={num((banks.data ?? []).filter((b) => b.account.status === 'pending').length)} />
      </div>
      <div className="mb-4"><Segmented value={tab} onChange={setTab} options={[
        ...(can(user, 'wallets.view') ? [['wallets', tr('المحافظ', 'Wallets')] as [string, string]] : []),
        ['withdrawals', `${tr('طلبات الاسترداد', 'Refund requests')}${pendingCount ? ` (${num(pendingCount)})` : ''}`],
        ...(can(user, 'banks.verify') || can(user, 'wallets.view') ? [['banks', tr('الحسابات البنكية', 'Bank accounts')] as [string, string]] : []),
      ]} /></div>

      {tab === 'wallets' && (wallets.error ? <ErrorBox text={wallets.error} /> : wallets.loading && !wallets.data ? <Loading /> : (
        <>
          <TableTools t={tf} placeholder={tr('بحث باسم المالك أو الجوال', 'Search by owner name or mobile')} />
          <div ref={ref} className="panel overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>{tr('المالك', 'Owner')}</th><th>{tr('الرصيد', 'Balance')}</th><th>{tr('الوارد', 'Incoming')}</th><th>{tr('المصروف', 'Outgoing')}</th><th>{tr('استرداد قيد التنفيذ', 'Refunds in progress')}</th><th>{tr('آخر حركة', 'Last transaction')}</th><th>{tr('الحساب البنكي', 'Bank account')}</th><th className="no-print"></th></tr></thead>
              <tbody>
                {!list.length && <NoResults cols={8} onReset={tf.reset} />}
                {list.map((w) => (
                  <tr key={w.userId}>
                    <td><OwnerCell id={w.userId} name={w.ownerName} /></td>
                    <td className="num whitespace-nowrap font-bold">{sar(w.balance)}</td>
                    <td className="num whitespace-nowrap text-ok">{sar(w.totalIn)}</td>
                    <td className="num whitespace-nowrap text-muted">{sar(w.totalOut)}</td>
                    <td className="num whitespace-nowrap">{w.pendingWithdrawals ? sar(w.pendingWithdrawals) : '—'}</td>
                    <td className="whitespace-nowrap text-[13px] text-muted">{w.lastTxAt ? date(w.lastTxAt) : '—'}</td>
                    <td>{w.bankStatus ? <><span className={`pill ${BANK[w.bankStatus][1]}`}>{BANK[w.bankStatus][0]}</span><span className="block text-[12px] text-muted">{w.bankName}</span></> : <span className="text-muted">—</span>}</td>
                    <td className="no-print"><button className="btn-ghost btn-sm" onClick={() => setOpen(w)}>{tr('الكشف والإجراءات', 'Statement & actions')}</button></td>
                  </tr>
                ))}
              </tbody>
              {list.length > 0 && <tfoot><tr className="bg-stone font-bold"><td>{tr('الإجمالي', 'Total')}</td><td className="num whitespace-nowrap">{sar(total)}</td><td colSpan={6}></td></tr></tfoot>}
            </table>
          </div>
        </>
      ))}
      {tab === 'withdrawals' && <>
        <div className="mb-3"><Segmented value={wStatus} onChange={setWStatus} options={[['pending', tr('قيد التنفيذ', 'In progress')], ['completed', tr('حُوّلت', 'Transferred')], ['rejected', tr('مرفوضة', 'Rejected')], ['all', tr('الكل', 'All')]]} /></div>
        {ws.error ? <ErrorBox text={ws.error} /> : ws.loading && !ws.data ? <Loading /> : <WithdrawalsTable list={ws.data ?? []} onChange={reload} />}
      </>}
      {tab === 'banks' && <>
        <div className="mb-3"><Segmented value={bStatus} onChange={setBStatus} options={[['pending', tr('بانتظار الاعتماد', 'Awaiting approval')], ['verified', tr('معتمدة', 'Approved')], ['rejected', tr('مرفوضة', 'Rejected')], ['all', tr('الكل', 'All')]]} /></div>
        {banks.error ? <ErrorBox text={banks.error} /> : banks.loading && !banks.data ? <Loading /> : <BanksTable list={banks.data ?? []} onChange={reload} />}
      </>}
      {open && <WalletDialog row={open} onClose={() => setOpen(null)} onChange={reload} />}
    </>
  )
}

const DEP_STATE: Record<DepositRow['state'], [string, string]> = {
  get held(): [string, string] { return [tr('محجوز', 'Held'), 'bg-gold-soft text-gold-deep'] },
  get forfeited(): [string, string] { return [tr('خُصم لعدم السداد في المهلة', 'Forfeited: not paid in time'), 'bg-bad/10 text-bad'] },
  get applied(): [string, string] { return [tr('خُصم من الفاتورة', 'Applied to invoice'), 'bg-info-soft text-info-deep'] },
  get refunded(): [string, string] { return [tr('مُسترد', 'Refunded'), 'bg-[#E2F0E8] text-ok'] },
  get fee(): [string, string] { return [tr('رسوم غير مستردة', 'Non-refundable fee'), 'bg-stone-deep text-muted'] },
}
const CONTEXT: Record<string, string> = {
  get under_review() { return tr('تحت المراجعة', 'Under review') },
  get accepted() { return tr('مقبول', 'Accepted') },
  get rejected() { return tr('مرفوض', 'Rejected') },
  get cancelled() { return tr('ملغى', 'Cancelled') },
  get open() { return tr('المزاد مفتوح', 'Auction open') },
  get ended() { return tr('انتهى المزاد', 'Auction ended') },
  get settled() { return tr('تمت الترسية', 'Awarded') },
}

export function AdminDeposits() {
  const print = usePrint()
  const { user, toast } = useApp()
  const owners = useOwners()
  const [state, setState] = useState<'held' | 'all' | 'refunded' | 'applied'>('held')
  const { data, loading, error, reload } = useLoad(() => api.deposits(state), [state])
  const [refund, setRefund] = useState<DepositRow | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const tf = useTableFilter(data, {
    fields: (d) => [d.ownerName, d.reference, d.auctionNumber, d.names],
    filters: [{ key: 'kind', label: tr('النوع', 'Type'), options: [['', tr('الكل', 'All')], ['request', tr('ضمان طلب شعار', 'Mark request guarantee')], ['bid', tr('ضمان دخول مزاد', 'Auction entry guarantee')]], test: (d, v) => d.kind === v }],
  })
  const list = tf.list
  const held = (data ?? []).filter((d) => d.state === 'held')
  return (
    <>
      <PageHead title={tr('الضمانات', 'Guarantees')} sub={tr('ضمانات طلبات الشعارات (تُخصم من الفاتورة عند الفوز أو تُرد) وضمانات دخول مزادات إعادة البيع.', 'Mark request guarantees (applied to the invoice on winning, or refunded) and resale auction entry guarantees.')}
        action={<div className="flex gap-2">
          <button className="btn-ghost" onClick={() => downloadCsv(`${tr('الضمانات', 'guarantees')}-${new Date().toISOString().slice(0, 10)}.csv`, [[tr('المالك', 'Owner'), ...OWNER_COLUMNS, tr('النوع', 'Type'), tr('المرجع', 'Reference'), tr('رقم المزاد', 'Auction no.'), tr('الأسماء', 'Names'), tr('الفئة', 'Category'), tr('المبلغ', 'Amount'), tr('الحالة', 'Status'), tr('الوضع', 'Context'), tr('التاريخ', 'Date')],
            ...list.map((d) => [d.ownerName, ...ownerColumns(owners.get(d.userId)), d.kind === 'request' ? tr('ضمان طلب', 'Request guarantee') : tr('ضمان دخول مزاد', 'Auction entry guarantee'), d.reference, d.auctionNumber ?? '', d.names, TYPE_LABEL[d.type], d.amount, DEP_STATE[d.state][0], CONTEXT[d.context] ?? d.context, date(d.at)])])}>{tr('تصدير Excel', 'Export to Excel')}</button>
          <button className="btn-primary" onClick={() => print({ title: tr('تقرير الضمانات', 'Guarantees report'), subtitle: tr(`${num(list.length)} ضمان · المحجوز ${sar(held.reduce((s, d) => s + d.amount, 0))}`, `${num(list.length)} guarantees · Held ${sar(held.reduce((s, d) => s + d.amount, 0))}`), el: ref.current, landscape: true })}><Icon name="file" className="h-4 w-4" />{tr('طباعة التقرير', 'Print report')}</button>
        </div>} />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile icon="lock" tone="gold" label={tr('ضمانات محجوزة', 'Held guarantees')} value={state === 'held' || state === 'all' ? sar(held.reduce((s, d) => s + d.amount, 0)) : '—'} />
        <StatTile icon="users" tone="blue" label={tr('ملاك لهم ضمانات محجوزة', 'Owners with held guarantees')} value={state === 'held' || state === 'all' ? num(new Set(held.map((d) => d.userId)).size) : '—'} />
        <StatTile icon="file" tone="pine" label={tr('السجلات', 'Records')} value={num(list.length)} />
      </div>
      <div className="mb-3"><Segmented value={state} onChange={setState} options={[['held', tr('محجوزة', 'Held')], ['applied', tr('خُصمت من الفاتورة', 'Applied to invoice')], ['refunded', tr('مستردة', 'Refunded')], ['all', tr('الكل', 'All')]]} /></div>
      <TableTools t={tf} placeholder={tr('بحث بالمالك أو الطلب أو المزاد أو الاسم', 'Search by owner, request, auction or name')} />
      {error && <ErrorBox text={error} />}
      {loading && !data ? <Loading /> : (
        <div ref={ref} className="panel overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>{tr('المالك', 'Owner')}</th><th>{tr('النوع', 'Type')}</th><th>{tr('المرجع', 'Reference')}</th><th>{tr('الأسماء', 'Names')}</th><th>{tr('المبلغ', 'Amount')}</th><th>{tr('الحالة', 'Status')}</th><th>{tr('الوضع', 'Context')}</th><th>{tr('التاريخ', 'Date')}</th><th className="no-print"></th></tr></thead>
            <tbody>
              {!list.length && <NoResults cols={9} onReset={tf.reset} />}
              {list.map((d) => (
                <tr key={`${d.kind}-${d.requestId ?? d.auctionId}-${d.userId}`}>
                  <td><OwnerCell id={d.userId} name={d.ownerName} /></td>
                  <td className="whitespace-nowrap text-[13px]">{d.kind === 'request' ? tr('ضمان طلب شعار', 'Mark request guarantee') : tr('ضمان دخول مزاد', 'Auction entry guarantee')}</td>
                  <td className="num whitespace-nowrap text-[13px]">{d.reference || '—'}{d.auctionNumber && <span className="block text-muted">{d.auctionNumber}</span>}</td>
                  <td><span className="flex items-center gap-1.5"><TypeBadge type={d.type} /><span className="font-bold">{d.names}</span></span></td>
                  <td className="num whitespace-nowrap font-bold">{sar(d.amount)}</td>
                  <td><span className={`pill ${DEP_STATE[d.state][1]}`}>{DEP_STATE[d.state][0]}</span></td>
                  <td className="text-[13px] text-muted">{CONTEXT[d.context] ?? d.context}</td>
                  <td className="whitespace-nowrap text-[13px] text-muted">{date(d.at)}</td>
                  <td className="no-print">{d.state === 'held' && can(user, 'deposits.refund') && !d.context.startsWith('رسوم') && <button className="btn-ghost btn-sm" onClick={() => setRefund(d)}>{tr('استرداد الضمان', 'Refund guarantee')}</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {refund && (
        <Ask title={tr('استرداد الضمان', 'Refund guarantee')} label={tr('سبب الاسترداد (يصل للمالك)', 'Refund reason (sent to the owner)')} onClose={() => setRefund(null)}
          onSubmit={async (v) => { await api.refundDeposit({ kind: refund.kind, requestId: refund.requestId, auctionId: refund.auctionId, userId: refund.userId, reason: v }); toast(tr('أُعيد الضمان إلى محفظة المالك', 'Guarantee returned to the owner’s wallet')); reload() }}>
          <p className="text-[14.5px] leading-7">{tr('يُعاد', 'Return')} <b>{sar(refund.amount)}</b> {tr('إلى محفظة', 'to the wallet of')} <b>{refund.ownerName}</b> ({refund.names}).
            {refund.kind === 'request' ? tr(' بعد الاسترداد لا يُخصم الضمان من فاتورته إن فاز بأحد أسماء الطلب.', ' After the refund, the guarantee is not applied to their invoice if they win one of the requested names.') : tr(' لا يُرد ضمان المتصدر قبل انتهاء المزاد.', ' The leading bidder’s guarantee cannot be refunded before the auction ends.')}</p>
        </Ask>
      )}
    </>
  )
}
