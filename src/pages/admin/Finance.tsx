import { useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Icon, StatTile } from '../../components/dash'
import { Empty, ErrorBox, Loading, Modal, PageHead, Segmented, TypeBadge } from '../../components/ui'
import { NoResults, TableTools, useTableFilter } from '../../components/TableTools'
import { TYPE_LABEL } from '../../lib/config'
import { date, dateTime, num, sar } from '../../lib/format'
import { can } from '../../lib/permissions'
import { downloadCsv, printReport } from '../../lib/print'
import { api, useApp, useLoad } from '../../lib/store'
import type { BankStatus, DepositRow, DocumentFile, StaffBankAccount, WalletRow, Withdrawal, WithdrawalStatus } from '../../lib/types'

const BANK: Record<BankStatus, [string, string]> = { pending: ['بانتظار الاعتماد', 'bg-gold-soft text-gold-deep'], verified: ['معتمد', 'bg-[#E2F0E8] text-ok'], rejected: ['مرفوض', 'bg-bad/10 text-bad'] }
const WD: Record<WithdrawalStatus, [string, string]> = { pending: ['قيد التنفيذ', 'bg-gold-soft text-gold-deep'], completed: ['حُوّل', 'bg-[#E2F0E8] text-ok'], rejected: ['مرفوض', 'bg-bad/10 text-bad'] }
const TX: Record<string, string> = { topup: 'شحن', deposit: 'ضمان مزاد', refund: 'استرداد', invoice_payment: 'سداد فاتورة', service_fee: 'رسوم استثمار', investment_payout: 'عائد استثمار', bid_deposit: 'ضمان دخول', sale_payout: 'ثمن بيع', purchase: 'شراء اسم', withdrawal: 'استرداد للبنك', adjustment: 'تسوية' }

/** the IBAN certificate in a dialog: PDF inline, images as images, and a download link */
export function DocViewer({ doc, onClose }: { doc: DocumentFile | null; onClose: () => void }) {
  const url = doc ? `data:${doc.contentType};base64,${doc.base64}` : ''
  return (
    <Modal open={!!doc} onClose={onClose} title="شهادة الآيبان" wide>
      {doc && (
        <div className="space-y-3">
          {doc.contentType === 'application/pdf'
            ? <iframe title="شهادة الآيبان" src={url} className="h-[70vh] w-full rounded-lg border border-line" />
            : <img src={url} alt="شهادة الآيبان" className="mx-auto max-h-[70vh] rounded-lg border border-line" />}
          <a href={url} download={doc.name} className="btn-ghost btn-sm">تنزيل الملف</a>
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
        }}>{busy ? 'جارٍ التنفيذ…' : title}</button>
      </div>
    </Modal>
  )
}

function WithdrawalsTable({ list, onChange }: { list: Withdrawal[]; onChange: () => void }) {
  const { user, toast } = useApp()
  const [ask, setAsk] = useState<{ w: Withdrawal; kind: 'complete' | 'reject' } | null>(null)
  const canRefund = can(user, 'wallets.refund')
  if (!list.length) return <Empty title="لا توجد طلبات استرداد بهذه التصفية" />
  return (
    <div className="panel overflow-x-auto">
      <table className="tbl">
        <thead><tr><th>الطلب</th><th>المالك</th><th>المبلغ</th><th>الحساب</th><th>الحالة</th><th>التاريخ</th><th className="no-print"></th></tr></thead>
        <tbody>
          {list.map((w) => (
            <tr key={w.id}>
              <td className="num font-semibold">{w.number}{w.byStaff && <span className="block text-[12px] font-normal text-muted">من الإدارة المالية</span>}</td>
              <td>{w.ownerName}</td>
              <td className="num whitespace-nowrap font-bold">{sar(w.amount)}</td>
              <td className="text-[13px]"><span className="num" dir="ltr">{w.iban}</span><span className="block text-muted">{w.bankName} · {w.accountName}</span></td>
              <td><span className={`pill ${WD[w.status][1]}`}>{WD[w.status][0]}</span>{w.transferRef && <span className="num block text-[12px] text-muted">حوالة {w.transferRef}</span>}{w.note && <span className="block max-w-[14rem] text-[12px] text-muted">{w.note}</span>}</td>
              <td className="whitespace-nowrap text-[13px] text-muted">{dateTime(w.createdAt)}</td>
              <td className="no-print whitespace-nowrap">{canRefund && w.status === 'pending' && <div className="flex gap-1">
                <button className="btn-primary btn-sm" onClick={() => setAsk({ w, kind: 'complete' })}>تم التحويل</button>
                <button className="btn-danger btn-sm" onClick={() => setAsk({ w, kind: 'reject' })}>رفض</button>
              </div>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {ask && <Ask title={ask.kind === 'complete' ? 'تأكيد التحويل' : 'رفض طلب الاسترداد'} label={ask.kind === 'complete' ? 'رقم الحوالة البنكية' : 'سبب الرفض (يصل للمالك)'} danger={ask.kind === 'reject'}
        hint={ask.kind === 'complete' ? `حوّل ${sar(ask.w.amount)} إلى ${ask.w.bankName} ثم اكتب رقم الحوالة.` : `يُعاد ${sar(ask.w.amount)} إلى محفظة المالك.`}
        onClose={() => setAsk(null)} onSubmit={async (v) => { await (ask.kind === 'complete' ? api.completeWithdrawal(ask.w.id, v) : api.rejectWithdrawal(ask.w.id, v)); toast(ask.kind === 'complete' ? 'سُجّل التحويل' : 'رُفض الطلب وأُعيد المبلغ'); onChange() }} />}
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
      toast(mode === 'refund' ? 'سُجّل الاسترداد' : 'سُجّلت التسوية'); setMode(null); setAmount(''); setRef2(''); setNote(''); reload(); onChange()
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title={`محفظة ${row.ownerName}`} wide>
      <div className="space-y-5">
        {error && <ErrorBox text={error} />}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile icon="wallet" tone="pine" label="الرصيد" value={sar(w.balance)} />
          <StatTile icon="plus" tone="green" label="الوارد" value={sar(w.totalIn)} />
          <StatTile icon="arrow" tone="red" label="المصروف" value={sar(w.totalOut)} />
          <StatTile icon="clock" tone="gold" label="استرداد قيد التنفيذ" value={sar(w.pendingWithdrawals)} />
        </div>
        <div className="rounded-lg border border-line p-4 text-[14.5px]">
          <b>الحساب البنكي: </b>
          {data?.bank ? <><span className="num" dir="ltr">{data.bank.iban}</span> · {data.bank.bankName} · {data.bank.accountName} <span className={`pill ${BANK[data.bank.status][1]}`}>{BANK[data.bank.status][0]}</span></> : <span className="text-muted">لم يضف حسابًا بنكيًا</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          {can(user, 'wallets.refund') && <button className="btn-primary btn-sm" disabled={data?.bank?.status !== 'verified' || w.balance <= 0} title={data?.bank?.status !== 'verified' ? 'يلزم حساب بنكي معتمد' : ''} onClick={() => { setMode('refund'); setAmount(String(w.balance)) }}>استرداد إلى الحساب البنكي</button>}
          {can(user, 'wallets.adjust') && <button className="btn-ghost btn-sm" onClick={() => setMode('adjust')}>تسوية الرصيد</button>}
        </div>
        {mode && (
          <div className="space-y-3 rounded-lg border border-pine/30 bg-pine-soft/40 p-4">
            {err && <ErrorBox text={err} />}
            {mode === 'adjust' && <div className="flex gap-2">{([[1, 'إضافة للرصيد'], [-1, 'خصم من الرصيد']] as const).map(([s, l]) => <button key={s} type="button" className={`btn-sm rounded-lg border-2 px-3 ${sign === s ? 'border-pine bg-paper' : 'border-line'}`} onClick={() => setSign(s)}>{l}</button>)}</div>}
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className="label" htmlFor="am">المبلغ (ريال)</label><input id="am" className="field num" dir="ltr" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} /></div>
              {mode === 'refund' && <div><label className="label" htmlFor="tr">رقم الحوالة البنكية</label><input id="tr" className="field num" dir="ltr" value={ref2} onChange={(e) => setRef2(e.target.value)} /></div>}
            </div>
            <div><label className="label" htmlFor="nt">{mode === 'refund' ? 'ملاحظة (اختياري)' : 'سبب التسوية (يظهر في كشف المالك)'}</label><input id="nt" className="field" value={note} onChange={(e) => setNote(e.target.value)} /></div>
            <div className="flex gap-2"><button className="btn-primary btn-sm" disabled={busy || !Number(amount)} onClick={submit}>{busy ? 'جارٍ التنفيذ…' : 'تنفيذ'}</button><button className="btn-ghost btn-sm" onClick={() => setMode(null)}>إلغاء</button></div>
          </div>
        )}
        <div>
          <h3 className="mb-2 font-bold">كشف الحركات</h3>
          {data ? (
            <div className="max-h-[40vh] overflow-y-auto rounded-lg border border-line">
              <table className="tbl"><thead><tr><th>التاريخ</th><th>النوع</th><th>البيان</th><th>المبلغ</th></tr></thead>
                <tbody>{data.txs.map((t) => <tr key={t.id}><td className="whitespace-nowrap text-[13px] text-muted">{dateTime(t.createdAt)}</td><td className="whitespace-nowrap text-[13px]">{TX[t.kind] ?? t.kind}</td><td className="text-[13.5px]">{t.note}</td><td className={`num whitespace-nowrap font-semibold ${t.amount < 0 ? 'text-bad' : 'text-ok'}`} dir="ltr">{t.amount > 0 ? '+' : ''}{num(t.amount)}</td></tr>)}</tbody>
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
  if (!list.length) return <Empty title="لا توجد حسابات بنكية بهذه التصفية" />
  return (
    <div className="panel overflow-x-auto">
      <table className="tbl">
        <thead><tr><th>المالك</th><th>الآيبان</th><th>البنك</th><th>صاحب الحساب</th><th>الحالة</th><th>آخر تحديث</th><th className="no-print"></th></tr></thead>
        <tbody>
          {list.map((b) => {
            const mismatch = b.account.accountName.replace(/\s+/g, '') !== b.ownerName.replace(/\s+/g, '')
            return (
              <tr key={b.userId}>
                <td className="font-semibold">{b.ownerName}</td>
                <td className="num whitespace-nowrap" dir="ltr" style={{ textAlign: 'right' }}>{b.account.iban}</td>
                <td>{b.account.bankName}</td>
                <td>{b.account.accountName}{mismatch && <span className="block text-[12px] text-gold-deep">يختلف عن اسم الحساب في المنصة، تحقق من الشهادة</span>}</td>
                <td><span className={`pill ${BANK[b.account.status][1]}`}>{BANK[b.account.status][0]}</span>{b.account.rejectReason && <span className="block text-[12px] text-bad">{b.account.rejectReason}</span>}{b.account.reviewedBy && <span className="block text-[12px] text-muted">{b.account.reviewedBy}</span>}</td>
                <td className="whitespace-nowrap text-[13px] text-muted">{dateTime(b.account.updatedAt)}</td>
                <td className="no-print whitespace-nowrap">{verify && <div className="flex gap-1">
                  <button className="btn-ghost btn-sm" onClick={async () => { try { setDoc(await api.bankDocument(b.userId)) } catch (e) { toast((e as Error).message, 'bad') } }}>الشهادة</button>
                  {b.account.status !== 'verified' && <button className="btn-primary btn-sm" onClick={async () => { try { await api.verifyBankAccount(b.userId); toast('اعتُمد الحساب'); onChange() } catch (e) { toast((e as Error).message, 'bad') } }}>اعتماد</button>}
                  {b.account.status !== 'rejected' && <button className="btn-danger btn-sm" onClick={() => setRej(b)}>رفض</button>}
                </div>}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <DocViewer doc={doc} onClose={() => setDoc(null)} />
      {rej && <Ask title="رفض الحساب البنكي" label="السبب (يصل للمالك)" danger onClose={() => setRej(null)} onSubmit={async (v) => { await api.rejectBankAccount(rej.userId, v); toast('رُفض الحساب'); onChange() }} />}
    </div>
  )
}

export function AdminWallets() {
  const { user } = useApp()
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
      { key: 'bal', label: 'الرصيد', options: [['', 'الكل'], ['pos', 'رصيد أكبر من صفر'], ['zero', 'رصيد صفر']], test: (w, v) => (v === 'pos' ? w.balance > 0 : w.balance === 0) },
      { key: 'bank', label: 'الحساب البنكي', options: [['', 'الكل'], ['verified', 'معتمد'], ['pending', 'بانتظار الاعتماد'], ['none', 'بدون حساب']], test: (w, v) => (v === 'none' ? !w.bankStatus : w.bankStatus === v) },
    ],
  })
  const list = [...tf.list]
  const total = list.reduce((s, w) => s + w.balance, 0)
  const pendingCount = (ws.data ?? []).filter((w) => w.status === 'pending').length
  const reload = () => { wallets.reload(); ws.reload(); banks.reload() }
  const setTab = (t: string) => setParams((p) => { p.set('tab', t); return p }, { replace: true })

  return (
    <>
      <PageHead title="المحافظ والاسترداد" sub="أرصدة محافظ الملاك، وطلبات الاسترداد إلى الحسابات البنكية، واعتماد شهادات الآيبان."
        action={tab === 'wallets' && <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => downloadCsv(`المحافظ-${new Date().toISOString().slice(0, 10)}.csv`, [['المالك', 'الجوال', 'الرصيد', 'الوارد', 'المصروف', 'استرداد قيد التنفيذ', 'عدد الحركات', 'آخر حركة', 'الحساب البنكي'],
            ...list.map((w) => [w.ownerName, w.phone, w.balance, w.totalIn, w.totalOut, w.pendingWithdrawals, w.txCount, w.lastTxAt ? date(w.lastTxAt) : '', w.bankStatus ? `${w.bankName} (${BANK[w.bankStatus][0]})` : 'بدون'])])}>تصدير Excel</button>
          <button className="btn-primary" onClick={() => printReport({ title: 'تقرير المحافظ', subtitle: `${num(list.length)} محفظة · إجمالي الأرصدة ${sar(total)}`, by: user?.fullName, el: ref.current, landscape: true })}><Icon name="file" className="h-4 w-4" />طباعة التقرير</button>
        </div>} />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon="wallet" tone="pine" label="إجمالي أرصدة الملاك" value={sar((wallets.data ?? []).reduce((s, w) => s + w.balance, 0))} />
        <StatTile icon="users" tone="blue" label="محافظ برصيد" value={num((wallets.data ?? []).filter((w) => w.balance > 0).length)} />
        <StatTile icon="clock" tone="gold" label="استرداد قيد التنفيذ" value={sar((wallets.data ?? []).reduce((s, w) => s + w.pendingWithdrawals, 0))} />
        <StatTile icon="shield" tone="red" label="حسابات بانتظار الاعتماد" value={num((banks.data ?? []).filter((b) => b.account.status === 'pending').length)} />
      </div>
      <div className="mb-4"><Segmented value={tab} onChange={setTab} options={[
        ...(can(user, 'wallets.view') ? [['wallets', 'المحافظ'] as [string, string]] : []),
        ['withdrawals', `طلبات الاسترداد${pendingCount ? ` (${num(pendingCount)})` : ''}`],
        ...(can(user, 'banks.verify') || can(user, 'wallets.view') ? [['banks', 'الحسابات البنكية'] as [string, string]] : []),
      ]} /></div>

      {tab === 'wallets' && (wallets.error ? <ErrorBox text={wallets.error} /> : wallets.loading && !wallets.data ? <Loading /> : (
        <>
          <TableTools t={tf} placeholder="بحث باسم المالك أو الجوال" />
          <div ref={ref} className="panel overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>المالك</th><th>الجوال</th><th>الرصيد</th><th>الوارد</th><th>المصروف</th><th>استرداد قيد التنفيذ</th><th>آخر حركة</th><th>الحساب البنكي</th><th className="no-print"></th></tr></thead>
              <tbody>
                {!list.length && <NoResults cols={9} onReset={tf.reset} />}
                {list.map((w) => (
                  <tr key={w.userId}>
                    <td className="font-semibold">{w.ownerName}</td>
                    <td className="num" dir="ltr" style={{ textAlign: 'right' }}>{w.phone}</td>
                    <td className="num whitespace-nowrap font-bold">{sar(w.balance)}</td>
                    <td className="num whitespace-nowrap text-ok">{sar(w.totalIn)}</td>
                    <td className="num whitespace-nowrap text-muted">{sar(w.totalOut)}</td>
                    <td className="num whitespace-nowrap">{w.pendingWithdrawals ? sar(w.pendingWithdrawals) : '—'}</td>
                    <td className="whitespace-nowrap text-[13px] text-muted">{w.lastTxAt ? date(w.lastTxAt) : '—'}</td>
                    <td>{w.bankStatus ? <><span className={`pill ${BANK[w.bankStatus][1]}`}>{BANK[w.bankStatus][0]}</span><span className="block text-[12px] text-muted">{w.bankName}</span></> : <span className="text-muted">—</span>}</td>
                    <td className="no-print"><button className="btn-ghost btn-sm" onClick={() => setOpen(w)}>الكشف والإجراءات</button></td>
                  </tr>
                ))}
              </tbody>
              {list.length > 0 && <tfoot><tr className="bg-stone font-bold"><td colSpan={2}>الإجمالي</td><td className="num whitespace-nowrap">{sar(total)}</td><td colSpan={6}></td></tr></tfoot>}
            </table>
          </div>
        </>
      ))}
      {tab === 'withdrawals' && <>
        <div className="mb-3"><Segmented value={wStatus} onChange={setWStatus} options={[['pending', 'قيد التنفيذ'], ['completed', 'حُوّلت'], ['rejected', 'مرفوضة'], ['all', 'الكل']]} /></div>
        {ws.error ? <ErrorBox text={ws.error} /> : ws.loading && !ws.data ? <Loading /> : <WithdrawalsTable list={ws.data ?? []} onChange={reload} />}
      </>}
      {tab === 'banks' && <>
        <div className="mb-3"><Segmented value={bStatus} onChange={setBStatus} options={[['pending', 'بانتظار الاعتماد'], ['verified', 'معتمدة'], ['rejected', 'مرفوضة'], ['all', 'الكل']]} /></div>
        {banks.error ? <ErrorBox text={banks.error} /> : banks.loading && !banks.data ? <Loading /> : <BanksTable list={banks.data ?? []} onChange={reload} />}
      </>}
      {open && <WalletDialog row={open} onClose={() => setOpen(null)} onChange={reload} />}
    </>
  )
}

const DEP_STATE: Record<DepositRow['state'], [string, string]> = { held: ['محجوز', 'bg-gold-soft text-gold-deep'], applied: ['خُصم من الفاتورة', 'bg-info-soft text-info-deep'], refunded: ['مُسترد', 'bg-[#E2F0E8] text-ok'], fee: ['رسوم غير مستردة', 'bg-stone-deep text-muted'] }
const CONTEXT: Record<string, string> = { under_review: 'تحت المراجعة', accepted: 'مقبول', rejected: 'مرفوض', cancelled: 'ملغى', open: 'المزاد مفتوح', ended: 'انتهى المزاد', settled: 'تمت الترسية' }

export function AdminDeposits() {
  const { user, toast } = useApp()
  const [state, setState] = useState<'held' | 'all' | 'refunded' | 'applied'>('held')
  const { data, loading, error, reload } = useLoad(() => api.deposits(state), [state])
  const [refund, setRefund] = useState<DepositRow | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const tf = useTableFilter(data, {
    fields: (d) => [d.ownerName, d.reference, d.auctionNumber, d.names],
    filters: [{ key: 'kind', label: 'النوع', options: [['', 'الكل'], ['request', 'ضمان طلب شعار'], ['bid', 'ضمان دخول مزاد']], test: (d, v) => d.kind === v }],
  })
  const list = tf.list
  const held = (data ?? []).filter((d) => d.state === 'held')
  return (
    <>
      <PageHead title="الضمانات" sub="ضمانات طلبات الشعارات (تُخصم من الفاتورة عند الفوز أو تُرد) وضمانات دخول مزادات إعادة البيع."
        action={<div className="flex gap-2">
          <button className="btn-ghost" onClick={() => downloadCsv(`الضمانات-${new Date().toISOString().slice(0, 10)}.csv`, [['المالك', 'النوع', 'المرجع', 'رقم المزاد', 'الأسماء', 'الفئة', 'المبلغ', 'الحالة', 'الوضع', 'التاريخ'],
            ...list.map((d) => [d.ownerName, d.kind === 'request' ? 'ضمان طلب' : 'ضمان دخول مزاد', d.reference, d.auctionNumber ?? '', d.names, TYPE_LABEL[d.type], d.amount, DEP_STATE[d.state][0], CONTEXT[d.context] ?? d.context, date(d.at)])])}>تصدير Excel</button>
          <button className="btn-primary" onClick={() => printReport({ title: 'تقرير الضمانات', subtitle: `${num(list.length)} ضمان · المحجوز ${sar(held.reduce((s, d) => s + d.amount, 0))}`, by: user?.fullName, el: ref.current, landscape: true })}><Icon name="file" className="h-4 w-4" />طباعة التقرير</button>
        </div>} />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile icon="lock" tone="gold" label="ضمانات محجوزة" value={state === 'held' || state === 'all' ? sar(held.reduce((s, d) => s + d.amount, 0)) : '—'} />
        <StatTile icon="users" tone="blue" label="ملاك لهم ضمانات محجوزة" value={state === 'held' || state === 'all' ? num(new Set(held.map((d) => d.userId)).size) : '—'} />
        <StatTile icon="file" tone="pine" label="السجلات" value={num(list.length)} />
      </div>
      <div className="mb-3"><Segmented value={state} onChange={setState} options={[['held', 'محجوزة'], ['applied', 'خُصمت من الفاتورة'], ['refunded', 'مستردة'], ['all', 'الكل']]} /></div>
      <TableTools t={tf} placeholder="بحث بالمالك أو الطلب أو المزاد أو الاسم" />
      {error && <ErrorBox text={error} />}
      {loading && !data ? <Loading /> : (
        <div ref={ref} className="panel overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>المالك</th><th>النوع</th><th>المرجع</th><th>الأسماء</th><th>المبلغ</th><th>الحالة</th><th>الوضع</th><th>التاريخ</th><th className="no-print"></th></tr></thead>
            <tbody>
              {!list.length && <NoResults cols={9} onReset={tf.reset} />}
              {list.map((d) => (
                <tr key={`${d.kind}-${d.requestId ?? d.auctionId}-${d.userId}`}>
                  <td className="font-semibold">{d.ownerName}</td>
                  <td className="whitespace-nowrap text-[13px]">{d.kind === 'request' ? 'ضمان طلب شعار' : 'ضمان دخول مزاد'}</td>
                  <td className="num whitespace-nowrap text-[13px]">{d.reference || '—'}{d.auctionNumber && <span className="block text-muted">{d.auctionNumber}</span>}</td>
                  <td><span className="flex items-center gap-1.5"><TypeBadge type={d.type} /><span className="font-bold">{d.names}</span></span></td>
                  <td className="num whitespace-nowrap font-bold">{sar(d.amount)}</td>
                  <td><span className={`pill ${DEP_STATE[d.state][1]}`}>{DEP_STATE[d.state][0]}</span></td>
                  <td className="text-[13px] text-muted">{CONTEXT[d.context] ?? d.context}</td>
                  <td className="whitespace-nowrap text-[13px] text-muted">{date(d.at)}</td>
                  <td className="no-print">{d.state === 'held' && can(user, 'deposits.refund') && !d.context.startsWith('رسوم') && <button className="btn-ghost btn-sm" onClick={() => setRefund(d)}>استرداد الضمان</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {refund && (
        <Ask title="استرداد الضمان" label="سبب الاسترداد (يصل للمالك)" onClose={() => setRefund(null)}
          onSubmit={async (v) => { await api.refundDeposit({ kind: refund.kind, requestId: refund.requestId, auctionId: refund.auctionId, userId: refund.userId, reason: v }); toast('أُعيد الضمان إلى محفظة المالك'); reload() }}>
          <p className="text-[14.5px] leading-7">يُعاد <b>{sar(refund.amount)}</b> إلى محفظة <b>{refund.ownerName}</b> ({refund.names}).
            {refund.kind === 'request' ? ' بعد الاسترداد لا يُخصم الضمان من فاتورته إن فاز بأحد أسماء الطلب.' : ' لا يُرد ضمان المتصدر قبل انتهاء المزاد.'}</p>
        </Ask>
      )}
    </>
  )
}
