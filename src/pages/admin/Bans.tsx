import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Icon } from '../../components/dash'
import { ErrorBox, Loading, Modal } from '../../components/ui'
import { date, num } from '../../lib/format'
import { tr } from '../../lib/i18n'
import { can } from '../../lib/permissions'
import { api, useApp, useLoad } from '../../lib/store'
import type { Ban, BanStatus } from '../../lib/types'

const STATUS: Record<BanStatus, () => [string, string]> = {
  active: () => [tr('ساري', 'In force'), 'bg-bad text-paper'],
  scheduled: () => [tr('يبدأ لاحقًا', 'Starts later'), 'bg-gold-soft text-gold-deep'],
  ended: () => [tr('انتهت مدته', 'Ended'), 'bg-stone-deep text-muted'],
  lifted: () => [tr('مرفوع', 'Lifted'), 'bg-[#E2F0E8] text-ok'],
}
const FILTERS: (BanStatus | 'all')[] = ['active', 'scheduled', 'ended', 'lifted', 'all']
const SOURCE: Record<string, () => string> = { legacy_blacklist: () => tr('القائمة السوداء (المنصة السابقة)', 'Blacklist (previous platform)'), legacy_excluded: () => tr('المستبعدون (المنصة السابقة)', 'Excluded (previous platform)') }
/** today in Riyadh, yyyy-mm-dd */
const today = () => new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10)
const plus = (days: number) => new Date(Date.now() + 3 * 3600_000 + days * 86400_000).toISOString().slice(0, 10)

function Pill({ s }: { s: BanStatus }) {
  const [l, cls] = STATUS[s]()
  return <span className={`pill whitespace-nowrap ${cls}`}>{l}</span>
}

/** the period: a quick choice or two dates; empty end = until lifted */
function PeriodFields({ start, end, setStart, setEnd }: { start: string; end: string; setStart: (v: string) => void; setEnd: (v: string) => void }) {
  const quick: [string, number | null][] = [[tr('أسبوع', 'A week'), 7], [tr('شهر', 'A month'), 30], [tr('3 أشهر', '3 months'), 90], [tr('سنة', 'A year'), 365], [tr('دائم', 'For good'), null]]
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {quick.map(([l, d]) => (
          <button key={l} type="button" className="rounded-full border border-line px-3 py-1 text-[13px] font-bold hover:border-pine" onClick={() => { setStart(today()); setEnd(d == null ? '' : plus(d)) }}>{l}</button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label" htmlFor="bn-from">{tr('من', 'From')}</label><input id="bn-from" type="date" className="field" value={start} onChange={(e) => setStart(e.target.value)} required /></div>
        <div>
          <label className="label" htmlFor="bn-to">{tr('إلى (اتركه فارغًا للحظر الدائم)', 'To (leave empty for a ban until lifted)')}</label>
          <input id="bn-to" type="date" className="field" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>
    </div>
  )
}

function NewBan({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { toast } = useApp()
  const [who, setWho] = useState<'owner' | 'id'>('owner')
  const [owner, setOwner] = useState('')
  const [nationalId, setNationalId] = useState('')
  const [name, setName] = useState('')
  const [reason, setReason] = useState('')
  const [start, setStart] = useState(today())
  const [end, setEnd] = useState(plus(30))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const valid = reason.trim().length >= 3 && !!start && !(end && end < start) && (who === 'owner' ? owner.trim().length >= 5 : nationalId.trim().length >= 5 && name.trim().length >= 3)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setErr('')
    try {
      const b = await api.createBan(who === 'owner' ? { owner: owner.trim(), reason: reason.trim(), startsOn: start, endsOn: end || undefined } : { nationalId: nationalId.trim(), name: name.trim(), reason: reason.trim(), startsOn: start, endsOn: end || undefined })
      toast(b.ownerId ? tr(`حُظر ${b.name} وأُبلغ`, `${b.name} is banned and was notified`) : tr(`أُضيف ${b.name} إلى قائمة الحظر`, `${b.name} added to the ban list`))
      onDone()
    } catch (x) { setErr((x as Error).message) } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title={tr('حظر مالك', 'Ban an owner')} wide>
      <form onSubmit={submit} className="space-y-4">
        {err && <ErrorBox text={err} />}
        <div className="grid grid-cols-2 gap-2">
          {([['owner', tr('مالك مسجل', 'A registered owner'), tr('بالجوال أو رقم الهوية', 'By mobile or ID number')], ['id', tr('شخص غير مسجل', 'Someone not registered'), tr('برقم الهوية والاسم؛ يُطبَّق إن سجّل لاحقًا', 'By ID number and name; applies if they register later')]] as const).map(([k, l, h]) => (
            <button key={k} type="button" aria-pressed={who === k} onClick={() => setWho(k)} className={`rounded-lg border-2 p-3 text-start ${who === k ? 'border-pine bg-pine-soft/60' : 'border-line'}`}>
              <b className="block">{l}</b><span className="text-[12.5px] text-muted">{h}</span>
            </button>
          ))}
        </div>
        {who === 'owner' ? (
          <div><label className="label" htmlFor="bn-owner">{tr('جوال المالك أو رقم هويته', 'Owner’s mobile or ID number')}</label><input id="bn-owner" className="field num" dir="ltr" value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="05xxxxxxxx / 1xxxxxxxxx" /></div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="label" htmlFor="bn-nid">{tr('رقم الهوية', 'ID number')}</label><input id="bn-nid" className="field num" dir="ltr" maxLength={20} value={nationalId} onChange={(e) => setNationalId(e.target.value)} /></div>
            <div><label className="label" htmlFor="bn-name">{tr('الاسم', 'Name')}</label><input id="bn-name" className="field" maxLength={150} value={name} onChange={(e) => setName(e.target.value)} /></div>
          </div>
        )}
        <PeriodFields start={start} end={end} setStart={setStart} setEnd={setEnd} />
        <div><label className="label" htmlFor="bn-reason">{tr('سبب الحظر (يصل للمالك)', 'Reason (sent to the owner)')}</label><textarea id="bn-reason" className="field" rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
        <p className="rounded-lg bg-stone/70 p-3 text-[13px] leading-6 text-muted">{tr('المحظور لا يستطيع المزايدة أو الشراء أو البيع أو تقديم طلبات جديدة طوال مدة الحظر، ويبقى قادرًا على الدخول وسداد مستحقاته.', 'A banned owner cannot bid, buy, sell or send new requests during the ban, but can still sign in and pay what they owe.')}</p>
        <div className="flex gap-2">
          <button className="btn-primary flex-1 bg-bad hover:bg-bad" disabled={!valid || busy}>{busy ? '…' : tr('حظر', 'Ban')}</button>
          <button type="button" className="btn-ghost" onClick={onClose}>{tr('رجوع', 'Back')}</button>
        </div>
      </form>
    </Modal>
  )
}

function BanDialog({ b, onClose, onChanged }: { b: Ban; onClose: () => void; onChanged: () => void }) {
  const { user, toast } = useApp()
  const manage = can(user, 'bans.manage') && b.status !== 'lifted'
  const [mode, setMode] = useState<'edit' | 'lift' | null>(null)
  const [reason, setReason] = useState(b.reason)
  const [start, setStart] = useState(b.startsOn)
  const [end, setEnd] = useState(b.endsOn ?? '')
  const [lift, setLift] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function run() {
    setBusy(true); setErr('')
    try {
      if (mode === 'edit') { await api.updateBan(b.id, { reason: reason.trim(), startsOn: start, endsOn: end || undefined }); toast(tr('حُفظ الحظر', 'Ban saved')) }
      else { await api.liftBan(b.id, lift.trim()); toast(tr(`رُفع الحظر عن ${b.name}`, `Ban on ${b.name} lifted`)) }
      onChanged()
    } catch (x) { setErr((x as Error).message) } finally { setBusy(false) }
  }
  const row = (l: string, v: ReactNode) => <div className="flex justify-between gap-3 border-b border-line/60 py-1.5 text-[14.5px]"><dt className="text-muted">{l}</dt><dd className="text-end font-bold">{v}</dd></div>
  return (
    <Modal open onClose={onClose} title={tr(`حظر ${b.name}`, `Ban on ${b.name}`)} wide>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2"><Pill s={b.status} />{SOURCE[b.source] && <span className="pill bg-stone text-ink/80">{SOURCE[b.source]()}</span>}</div>
        <dl className="grid gap-x-8 sm:grid-cols-2">
          {row(tr('الاسم', 'Name'), b.name)}
          {row(tr('رقم الهوية', 'ID number'), <span className="num" dir="ltr">{b.nationalId ?? '—'}</span>)}
          {row(tr('الجوال', 'Mobile'), <span className="num" dir="ltr">{b.phone ?? tr('غير مسجل', 'Not registered')}</span>)}
          {row(tr('المدة', 'Period'), <>{date(b.startsOn)} ← {b.endsOn ? date(b.endsOn) : tr('حتى الرفع', 'until lifted')}</>)}
          {row(tr('أضافه', 'Added by'), <>{b.createdByName} <span className="block text-[12px] font-normal text-muted">{date(b.createdAt)}</span></>)}
        </dl>
        <p className="rounded-lg bg-stone px-3 py-2 text-[14px]"><b>{tr('السبب', 'Reason')}:</b> {b.reason}</p>
        {b.liftedAt && <p className="rounded-lg bg-[#E2F0E8] px-3 py-2 text-[14px] text-ok">{tr('رُفع', 'Lifted')} {date(b.liftedAt)} — {b.liftedByName}: {b.liftReason}</p>}
        {manage && !mode && (
          <div className="flex gap-2">
            <button className="btn-ghost btn-sm" onClick={() => setMode('edit')}>{tr('تعديل المدة أو السبب', 'Edit period or reason')}</button>
            <button className="btn-primary btn-sm" onClick={() => setMode('lift')}>{tr('رفع الحظر', 'Lift the ban')}</button>
          </div>
        )}
        {mode && (
          <div className="space-y-3 rounded-xl border-2 border-line p-4">
            {err && <ErrorBox text={err} />}
            {mode === 'edit' ? (
              <>
                <PeriodFields start={start} end={end} setStart={setStart} setEnd={setEnd} />
                <div><label className="label" htmlFor="bn-er">{tr('السبب', 'Reason')}</label><textarea id="bn-er" className="field" rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
              </>
            ) : (
              <div><label className="label" htmlFor="bn-lift">{tr('سبب رفع الحظر', 'Reason for lifting')}</label><textarea id="bn-lift" className="field" rows={2} maxLength={500} value={lift} onChange={(e) => setLift(e.target.value)} autoFocus /></div>
            )}
            <div className="flex gap-2">
              <button className="btn-primary" disabled={busy || (mode === 'lift' ? lift.trim().length < 3 : reason.trim().length < 3 || !start || !!(end && end < start))} onClick={run}>{busy ? '…' : mode === 'edit' ? tr('حفظ', 'Save') : tr('رفع الحظر', 'Lift')}</button>
              <button className="btn-ghost" onClick={() => setMode(null)}>{tr('رجوع', 'Back')}</button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

/** settings → «الحظر»: owners barred from bidding, buying, selling and new requests (bans.view / bans.manage) */
export function BansPanel() {
  const { user } = useApp()
  const [status, setStatus] = useState<BanStatus | 'all'>('active')
  const [q, setQ] = useState('')
  const [term, setTerm] = useState('')
  const [adding, setAdding] = useState(false)
  const [open, setOpen] = useState<Ban | null>(null)
  const { data, loading, error, reload } = useLoad(() => api.adminBans({ q: term || undefined, status }), [term, status])
  const label = (f: BanStatus | 'all') => (f === 'all' ? tr('الكل', 'All') : STATUS[f]()[0])
  const count = (f: BanStatus | 'all') => (data ? data.counts[f] : undefined)
  return (
    <section className="panel overflow-hidden">
      <header className="flex flex-wrap items-start gap-3 border-b border-line/70 px-5 py-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-bad/10 text-bad"><Icon name="lock" className="h-[18px] w-[18px]" /></span>
        <div className="flex-1"><h2 className="text-[17px]">{tr('قائمة الحظر', 'Ban list')}</h2><p className="mt-0.5 text-[14px] leading-6 text-muted">{tr('المحظور لا يستطيع المزايدة أو الشراء أو البيع أو تقديم طلبات جديدة حتى نهاية المدة أو رفع الحظر، ويبقى قادرًا على الدخول وسداد مستحقاته. الحظر برقم الهوية يُطبَّق على من يسجّل به لاحقًا.', 'A banned owner cannot bid, buy, sell or send new requests until the ban ends or is lifted, but can still sign in and pay. A ban by ID number applies to whoever registers with it later.')}</p></div>
        {can(user, 'bans.manage') && <button className="btn-primary btn-sm bg-bad hover:bg-bad" onClick={() => setAdding(true)}><Icon name="plus" className="h-4 w-4" />{tr('حظر مالك', 'Ban an owner')}</button>}
      </header>
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-stone/40 px-5 py-3">
        <div className="flex flex-wrap gap-1.5" role="tablist">
          {FILTERS.map((f) => (
            <button key={f} type="button" role="tab" aria-selected={status === f} onClick={() => setStatus(f)}
              className={`rounded-full border px-3 py-1.5 text-[13.5px] font-bold transition ${status === f ? 'border-pine bg-pine text-paper' : 'border-line bg-paper text-ink hover:border-pine/40'}`}>
              {label(f)}{count(f) !== undefined && <span className={`num ms-1.5 ${status === f ? 'text-paper/75' : 'text-muted'}`}>{num(count(f)!)}</span>}
            </button>
          ))}
        </div>
        <form className="w-full sm:ms-auto sm:w-72" onSubmit={(e) => { e.preventDefault(); setTerm(q.trim()) }}>
          <input className="field py-2 text-[14px]" placeholder={tr('بحث بالاسم أو الجوال أو رقم الهوية', 'Search by name, mobile or ID number')} value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => setTerm(q.trim())} />
        </form>
      </div>
      {error ? <div className="p-5"><ErrorBox text={error} /></div> : loading && !data ? <Loading /> : data?.items.length ? (
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>{tr('المحظور', 'Banned')}</th><th>{tr('رقم الهوية', 'ID number')}</th><th>{tr('المدة', 'Period')}</th><th>{tr('السبب', 'Reason')}</th><th>{tr('الحالة', 'Status')}</th><th /></tr></thead>
            <tbody>
              {data.items.map((b) => (
                <tr key={b.id}>
                  <td><b className="block text-[14.5px]">{b.name}</b><span className="text-[12.5px] text-muted">{b.ownerId ? <span className="num" dir="ltr">{b.phone}</span> : tr('غير مسجل', 'Not registered')}</span></td>
                  <td className="num" dir="ltr" style={{ textAlign: 'start' }}>{b.nationalId ?? '—'}</td>
                  <td className="whitespace-nowrap text-[13.5px]">{date(b.startsOn)}<span className="block text-muted">{b.endsOn ? `← ${date(b.endsOn)}` : tr('← حتى الرفع', '→ until lifted')}</span></td>
                  <td className="max-w-[18rem] text-[13.5px]">{b.reason}</td>
                  <td><Pill s={b.status} /></td>
                  <td><button className="btn-ghost btn-sm" onClick={() => setOpen(b)}>{tr('عرض', 'View')}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="px-5 py-10 text-center text-muted">{status === 'active' && !term ? tr('لا يوجد محظورون حاليًا.', 'No one is banned right now.') : tr('لا توجد نتائج.', 'No results.')}</p>}
      {adding && <NewBan onClose={() => setAdding(false)} onDone={() => { setAdding(false); reload() }} />}
      {open && <BanDialog b={open} onClose={() => setOpen(null)} onChanged={() => { setOpen(null); reload() }} />}
    </section>
  )
}
