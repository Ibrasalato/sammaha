import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Icon } from '../../components/dash'
import { AttachmentViewer, VIOLATION_STATUS, ViolationStatusPill, payMethodLabel } from '../../components/ViolationUi'
import { Empty, ErrorBox, Loading, Modal, PageHead } from '../../components/ui'
import { dateTime, num, sar } from '../../lib/format'
import { tr } from '../../lib/i18n'
import { can } from '../../lib/permissions'
import { api, useApp, useLoad } from '../../lib/store'
import type { DocumentFile, Festival, Violation, ViolationOwner, ViolationPage, ViolationStatus, ViolationType } from '../../lib/types'

const MAX_FILE = 5 * 1024 * 1024
const ACCEPT = 'application/pdf,image/png,image/jpeg,image/webp'
const toBase64 = (f: File) => new Promise<string>((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1] ?? ''); r.onerror = () => bad(r.error); r.readAsDataURL(f) })

/** «مسددة» and «غير مسددة» first: the main filters */
const FILTERS: (ViolationStatus | 'all')[] = ['all', 'unpaid', 'paid', 'resolved_name', 'banned', 'cancelled', 'recorded']
const CHIP_OK = /^[\p{L}\p{N}]*$/u
export const festivalLabel = (f: Pick<Festival, 'name' | 'nameEn'>) => tr(f.name, f.nameEn || f.name)
const filterLabel = (f: ViolationStatus | 'all') => (f === 'all' ? tr('الكل', 'All') : VIOLATION_STATUS[f][0])

/** «إصدار مخالفة»: find the owner by mobile or ID, choose the type (its amount is fixed), describe it, attach evidence */
function IssueDialog({ onClose, onDone }: { onClose: () => void; onDone: (v: Violation) => void }) {
  const types = useLoad(() => api.violationTypes(true), [])
  const festivals = useLoad(() => api.festivals(true), [])
  const [festivalId, setFestivalId] = useState('')
  const [chip, setChip] = useState('')
  const [q, setQ] = useState('')
  const [owner, setOwner] = useState<ViolationOwner | null>(null)
  const [finding, setFinding] = useState(false)
  const [ownerErr, setOwnerErr] = useState('')
  const [typeId, setTypeId] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [fileErr, setFileErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const type = types.data?.find((t) => t.id === typeId)
  const chipOk = chip.trim().length <= 40 && CHIP_OK.test(chip.trim())
  const valid = !!owner && !!type && description.trim().length >= 10 && !fileErr && chipOk

  async function find() {
    setFinding(true); setOwnerErr(''); setOwner(null)
    try { setOwner(await api.findViolationOwner(q.trim())) } catch (e) { setOwnerErr((e as Error).message) } finally { setFinding(false) }
  }
  function pick(f: File | null) {
    setFileErr('')
    if (f && f.size > MAX_FILE) setFileErr(tr('حجم المرفق أكبر من 5 ميجابايت', 'The attachment is larger than 5 MB'))
    else if (f && f.type && !ACCEPT.split(',').includes(f.type)) setFileErr(tr('المرفق يكون PDF أو صورة PNG أو JPG أو WebP', 'The attachment must be a PDF or a PNG, JPG or WebP image'))
    setFile(f)
  }
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!owner || !type) return
    setBusy(true); setErr('')
    try {
      const attachment = file ? { fileName: file.name, contentType: file.type || 'application/octet-stream', dataBase64: await toBase64(file) } : undefined
      onDone(await api.issueViolation({ ownerId: owner.id, typeId: type.id, description: description.trim(), festivalId: festivalId || undefined, camelChip: chip.trim() || undefined, attachment }))
    } catch (x) { setErr((x as Error).message) } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title={tr('إصدار مخالفة', 'Issue a violation')} wide>
      <form onSubmit={submit} className="space-y-4">
        {err && <ErrorBox text={err} />}
        <div>
          <label className="label" htmlFor="vl-owner">{tr('المالك: الجوال أو رقم الهوية', 'Owner: mobile or ID number')}</label>
          <div className="flex gap-2">
            <input id="vl-owner" className="field num flex-1" dir="ltr" value={q} placeholder="05xxxxxxxx / 1xxxxxxxxx"
              onChange={(e) => { setQ(e.target.value); setOwner(null); setOwnerErr('') }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (q.trim()) find() } }} />
            <button type="button" className="btn-ghost shrink-0" disabled={!q.trim() || finding} onClick={find}>{finding ? '…' : tr('بحث', 'Find')}</button>
          </div>
          {owner && <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[14px] text-ok"><Icon name="check" className="h-4 w-4" /><b>{owner.fullName}</b> · <span className="num" dir="ltr">{owner.phone}</span>{owner.nationalId && <> · <span className="num" dir="ltr">{owner.nationalId}</span></>}</p>}
          {ownerErr && <p className="mt-1.5 text-[14px] text-bad">{ownerErr}</p>}
        </div>
        <div className="grid gap-4 rounded-xl border-2 border-gold/50 bg-gold-soft/30 p-4 sm:grid-cols-[1.4fr_1fr]">
          <div>
            <label className="label" htmlFor="vl-fest">{tr('المهرجان الذي شارك فيه', 'Festival taken part in')}</label>
            <select id="vl-fest" className="field" value={festivalId} onChange={(e) => setFestivalId(e.target.value)}>
              <option value="">{festivals.loading ? '…' : tr('بدون مهرجان', 'No festival')}</option>
              {(festivals.data ?? []).map((f) => <option key={f.id} value={f.id}>{festivalLabel(f)}</option>)}
            </select>
            <p className="hint">{tr('اختياري؛ يظهر للمالك مع المخالفة', 'Optional; shown to the owner with the violation')}</p>
          </div>
          <div>
            <label className="label" htmlFor="vl-chip">{tr('رقم شريحة الجمل', 'Camel chip number')}</label>
            <input id="vl-chip" className="field num" dir="ltr" list="vl-chips" maxLength={40} value={chip} onChange={(e) => setChip(e.target.value.replace(/\s/g, ''))} placeholder="982…" />
            <datalist id="vl-chips">{(owner?.chips ?? []).map((c) => <option key={c} value={c} />)}</datalist>
            <p className={chipOk ? 'hint' : 'mt-1.5 text-[14px] text-bad'}>{!chipOk ? tr('أرقام وحروف فقط', 'Letters and digits only') : owner?.chips.length ? tr(`اختر من شرائح المالك (${owner.chips.length}) أو اكتب الرقم`, `Pick one of the owner’s chips (${owner.chips.length}) or type it`) : tr('اختياري', 'Optional')}</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
          <div>
            <label className="label" htmlFor="vl-type">{tr('نوع المخالفة', 'Violation type')}</label>
            {types.error ? <ErrorBox text={types.error} /> : (
              <select id="vl-type" className="field" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
                <option value="">{types.loading ? '…' : tr('اختر النوع', 'Choose the type')}</option>
                {(types.data ?? []).map((t) => <option key={t.id} value={t.id}>{tr(t.name, t.nameEn || t.name)}</option>)}
              </select>
            )}
            {types.data && !types.data.length && <p className="hint">{tr('لا توجد أنواع مخالفات مفعّلة. يضيفها مدير النظام من الإعدادات ← المخالفات.', 'No active violation types. The administrator adds them in Settings → Violations.')}</p>}
          </div>
          <div>
            <span className="label">{tr('قيمة الغرامة', 'Fine')}</span>
            <span className="field num block bg-stone">{type ? (type.amount > 0 ? sar(type.amount) : tr('بلا غرامة', 'No fine')) : '—'}</span>
            <p className="hint">{tr('من نوع المخالفة', 'Set by the type')}</p>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="vl-desc">{tr('وصف المخالفة (يصل للمالك)', 'Description (sent to the owner)')}</label>
          <textarea id="vl-desc" className="field min-h-[110px]" maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} />
          <p className="hint num">{description.trim().length < 10 ? tr('10 أحرف على الأقل', 'At least 10 characters') : `${description.length}/2000`}</p>
        </div>
        <div>
          <label className="label" htmlFor="vl-file">{tr('مرفق (اختياري)', 'Attachment (optional)')}</label>
          <input id="vl-file" type="file" accept={ACCEPT} className="field py-2" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
          <p className={fileErr ? 'mt-1.5 text-[14px] text-bad' : 'hint'}>{fileErr || tr('PDF أو صورة، حتى 5 ميجابايت', 'PDF or image, up to 5 MB')}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-primary flex-1" disabled={!valid || busy}>{busy ? tr('جارٍ الإصدار…', 'Issuing…') : tr('إصدار المخالفة', 'Issue violation')}</button>
          <button type="button" className="btn-ghost" onClick={onClose}>{tr('رجوع', 'Back')}</button>
        </div>
      </form>
    </Modal>
  )
}

type Action = 'cancel' | 'ban' | 'resolve'

function DetailDialog({ v, onClose, onChanged }: { v: Violation; onClose: () => void; onChanged: (v: Violation) => void }) {
  const { user, toast } = useApp()
  const [doc, setDoc] = useState<DocumentFile | null>(null)
  const [action, setAction] = useState<Action | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const manage = can(user, 'violations.manage')
  const open = v.status === 'unpaid' || v.status === 'recorded'
  const ACTION: Record<Action, { label: string; field: string; done: string; min: number; danger: boolean }> = {
    cancel: { label: tr('إلغاء المخالفة', 'Cancel violation'), field: tr('سبب الإلغاء (يصل للمالك)', 'Cancellation reason (sent to the owner)'), done: tr(`أُلغيت المخالفة ${v.number} وأُبلغ المالك`, `Violation ${v.number} cancelled and the owner notified`), min: 3, danger: true },
    ban: { label: tr('منع من المشاركة', 'Bar from taking part'), field: tr('سبب المنع (يصل للمالك)', 'Reason for the bar (sent to the owner)'), done: tr(`صدر قرار المنع في المخالفة ${v.number} وأُبلغ المالك`, `Bar recorded on violation ${v.number}; the owner was notified`), min: 3, danger: true },
    resolve: { label: tr('تسوية بربط اسم', 'Settle by a linked name'), field: tr('ملاحظة (اختياري، مثل الاسم والشريحة)', 'Note (optional, e.g. the name and chip)'), done: tr(`سُوّيت المخالفة ${v.number} بربط اسم`, `Violation ${v.number} settled by a linked name`), min: 0, danger: false },
  }
  async function run() {
    if (!action) return
    setBusy(true)
    try {
      const r = action === 'cancel' ? await api.cancelViolation(v.id, text.trim()) : action === 'ban' ? await api.banViolation(v.id, text.trim()) : await api.resolveViolationByName(v.id, text.trim() || undefined)
      toast(ACTION[action].done); setAction(null); setText(''); onChanged(r)
    } catch (e) { toast((e as Error).message, 'bad') } finally { setBusy(false) }
  }
  const Row = ({ k, children }: { k: string; children: ReactNode }) => <div className="flex justify-between gap-3 border-b border-line/60 py-2 text-[14.5px] last:border-0"><dt className="text-muted">{k}</dt><dd className="text-end">{children}</dd></div>
  return (
    <Modal open onClose={onClose} title={tr(`المخالفة ${v.number}`, `Violation ${v.number}`)} wide>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2"><b className="text-[17px]">{tr(v.typeName, v.typeNameEn || v.typeName)}</b><ViolationStatusPill s={v.status} /><span className="num ms-auto text-xl font-extrabold">{v.amount > 0 ? sar(v.amount) : tr('بلا غرامة', 'No fine')}</span></div>
        <dl>
          <Row k={tr('المالك', 'Owner')}><b>{v.ownerName}</b>{v.ownerPhone && <span className="num block text-[13px] text-muted" dir="ltr">{v.ownerPhone}</span>}</Row>
          <Row k={tr('المهرجان', 'Festival')}>{v.festivalName ?? <span className="text-muted">—</span>}</Row>
          <Row k={tr('شريحة الجمل', 'Camel chip')}>{v.camelChip ? <span className="num" dir="ltr">{v.camelChip}</span> : <span className="text-muted">—</span>}</Row>
          <Row k={tr('صدرت', 'Issued')}>{dateTime(v.issuedAt)}{v.issuedByName && <span className="block text-[13px] text-muted">{v.issuedByName}</span>}</Row>
          {v.status === 'paid' && <Row k={tr('السداد ومواصلة المشاركة', 'Paid, keeps taking part')}>{dateTime(v.paidAt)} · {payMethodLabel(v.paymentMethod)}</Row>}
          {(v.status === 'resolved_name' || v.status === 'banned') && <Row k={v.status === 'banned' ? tr('المنع من المشاركة', 'Barred') : tr('التسوية بربط اسم', 'Settled by a name')}>{dateTime(v.resolvedAt)}{v.resolvedByName && ` · ${v.resolvedByName}`}{v.resolutionNote && <span className={`block text-[13px] ${v.status === 'banned' ? 'text-bad' : 'text-muted'}`}>{v.resolutionNote}</span>}</Row>}
          {v.status === 'cancelled' && <Row k={tr('الإلغاء', 'Cancelled')}>{dateTime(v.cancelledAt)}{v.cancelledByName && ` · ${v.cancelledByName}`}{v.cancelReason && <span className="block text-[13px] text-bad">{v.cancelReason}</span>}</Row>}
        </dl>
        <div><span className="label">{tr('الوصف', 'Description')}</span><p className="whitespace-pre-line rounded-lg bg-stone p-3 text-[15px] leading-7">{v.description}</p></div>
        {v.attachmentName && (
          <button className="btn-ghost btn-sm" onClick={async () => { try { setDoc(await api.violationAttachment(v.id)) } catch (e) { toast((e as Error).message, 'bad') } }}>
            <Icon name="file" className="h-4 w-4" />{tr('عرض المرفق', 'View attachment')} <span dir="ltr" className="text-muted">{v.attachmentName}</span>
          </button>
        )}
        {manage && open && (action ? (
          <div className={`space-y-2 rounded-lg border p-3 ${ACTION[action].danger ? 'border-bad/30 bg-bad/5' : 'border-pine/30 bg-pine-soft/40'}`}>
            <label className="label" htmlFor="vl-action">{ACTION[action].field}</label>
            <textarea id="vl-action" className="field min-h-[80px]" maxLength={500} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
            <div className="flex gap-2">
              <button className={`${ACTION[action].danger ? 'btn-danger' : 'btn-primary'} flex-1`} disabled={busy || text.trim().length < ACTION[action].min} onClick={run}>{busy ? '…' : ACTION[action].label}</button>
              <button className="btn-ghost" onClick={() => { setAction(null); setText('') }}>{tr('رجوع', 'Back')}</button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 border-t border-line pt-4">
            {v.status === 'unpaid' && v.allowsNameResolution && <button className="btn-primary btn-sm" onClick={() => setAction('resolve')}><Icon name="check" className="h-4 w-4" />{ACTION.resolve.label}</button>}
            <button className="btn-danger btn-sm" onClick={() => setAction('ban')}>{ACTION.ban.label}</button>
            <button className="btn-ghost btn-sm text-bad" onClick={() => setAction('cancel')}>{ACTION.cancel.label}</button>
          </div>
        ))}
      </div>
      <AttachmentViewer doc={doc} onClose={() => setDoc(null)} />
    </Modal>
  )
}

/** «المخالفات»: fines and penalties issued to owners — violations.view lists them, violations.manage issues and cancels */
export function AdminViolations({ embedded = false }: { embedded?: boolean } = {}) {
  const { user, toast } = useApp()
  const [status, setStatus] = useState<ViolationStatus | 'all'>('all')
  const [q, setQ] = useState('')
  const [term, setTerm] = useState('')
  const [page, setPage] = useState(1)
  const [festivalId, setFestivalId] = useState('')
  const festivals = useLoad(() => api.festivals(), [])
  const { data, loading, error, reload } = useLoad<ViolationPage>(() => api.adminViolations({ q: term || undefined, status, festivalId: festivalId || undefined, page }), [term, status, festivalId, page])
  const [issuing, setIssuing] = useState(false)
  const [open, setOpen] = useState<Violation | null>(null)
  const manage = can(user, 'violations.manage')
  const pages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1
  const count = (f: ViolationStatus | 'all') => (!data ? undefined : f === 'all' ? data.counts.all : f === 'resolved_name' ? data.counts.resolvedName : data.counts[f])
  const issueButton = manage && <button className="btn-gold" onClick={() => setIssuing(true)}><Icon name="plus" className="h-4 w-4" />{tr('إصدار مخالفة', 'Issue a violation')}</button>

  return (
    <>
      {!embedded
        ? <PageHead title={tr('المخالفات', 'Violations')} sub={tr('المخالفات والغرامات الصادرة لملاك الإبل. تُسدَّد الغرامة من حساب المالك بالبطاقة، والمخالفة بلا غرامة تُسجَّل دون سداد.', 'Violations and fines issued to camel owners. The owner pays a fine by card from their account; a violation without a fine is recorded with nothing to pay.')} action={issueButton} />
        : manage && <div className="mb-4 flex justify-end">{issueButton}</div>}
      <section className="panel overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-stone/40 px-5 py-3">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={tr('الحالة', 'Status')}>
            {FILTERS.map((f) => (
              <button key={f} type="button" role="tab" aria-selected={status === f} onClick={() => { setStatus(f); setPage(1) }}
                className={`rounded-full border px-3 py-1.5 text-[13.5px] font-bold transition ${status === f ? 'border-pine bg-pine text-paper' : 'border-line bg-paper text-ink hover:border-pine/40'}`}>
                {filterLabel(f)}{count(f) !== undefined && <span className={`num ms-1.5 ${status === f ? 'text-paper/75' : f === 'unpaid' && count(f) ? 'text-bad' : 'text-muted'}`}>{num(count(f)!)}</span>}
              </button>
            ))}
          </div>
          <select className={`field w-auto py-2 text-[14px] sm:ms-auto ${festivalId ? 'border-pine bg-pine-soft font-bold text-pine' : ''}`} value={festivalId} onChange={(e) => { setFestivalId(e.target.value); setPage(1) }} aria-label={tr('المهرجان', 'Festival')}>
            <option value="">{tr('كل المهرجانات', 'All festivals')}</option>
            {(festivals.data ?? []).map((f) => <option key={f.id} value={f.id}>{festivalLabel(f)}</option>)}
          </select>
          <form className="w-full sm:w-72" onSubmit={(e) => { e.preventDefault(); setTerm(q.trim()); setPage(1) }}>
            <input className="field py-2 text-[14px]" placeholder={tr('بحث بالرقم أو اسم المالك أو جواله', 'Search by number, owner name or mobile')} value={q}
              onChange={(e) => setQ(e.target.value)} onBlur={() => { if (q.trim() !== term) { setTerm(q.trim()); setPage(1) } }} />
          </form>
        </div>
        {error ? <div className="p-5"><ErrorBox text={error} /></div> : loading && !data ? <Loading /> : data?.items.length ? (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr>
                <th>{tr('الرقم', 'Number')}</th><th>{tr('المالك', 'Owner')}</th><th>{tr('النوع', 'Type')}</th><th>{tr('المهرجان', 'Festival')}</th><th>{tr('الغرامة', 'Fine')}</th>
                <th>{tr('الحالة', 'Status')}</th><th>{tr('صدرت', 'Issued')}</th><th>{tr('أصدرها', 'Issued by')}</th><th />
              </tr></thead>
              <tbody>
                {data.items.map((v) => (
                  <tr key={v.id}>
                    <td className="num whitespace-nowrap font-bold" dir="ltr" style={{ textAlign: 'start' }}>{v.number}</td>
                    <td><b className="block text-[14.5px]">{v.ownerName}</b>{v.ownerPhone && <span className="num block text-[12.5px] text-muted" dir="ltr" style={{ textAlign: 'start' }}>{v.ownerPhone}</span>}</td>
                    <td className="text-[14px]">{tr(v.typeName, v.typeNameEn || v.typeName)}{v.attachmentName && <Icon name="file" className="ms-1 inline h-3.5 w-3.5 text-muted" />}</td>
                    <td className="text-[13.5px]">{v.festivalName ?? <span className="text-muted">—</span>}{v.camelChip && <span className="num block text-[12px] text-muted" dir="ltr" style={{ textAlign: 'start' }}>{v.camelChip}</span>}</td>
                    <td className="num whitespace-nowrap">{v.amount > 0 ? sar(v.amount) : <span className="text-muted">{tr('بلا غرامة', 'No fine')}</span>}</td>
                    <td><ViolationStatusPill s={v.status} /></td>
                    <td className="whitespace-nowrap text-[13px] text-muted">{dateTime(v.issuedAt)}</td>
                    <td className="text-[13px]">{v.issuedByName}</td>
                    <td><button className="btn-ghost btn-sm" onClick={() => setOpen(v)}>{tr('عرض', 'View')}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-5"><Empty title={term || status !== 'all' || festivalId ? tr('لا توجد مخالفات بهذه التصفية', 'No violations match this filter') : tr('لا توجد مخالفات بعد', 'No violations yet')}>
            {(term || status !== 'all' || festivalId) && <button className="btn-ghost btn-sm" onClick={() => { setStatus('all'); setQ(''); setTerm(''); setFestivalId(''); setPage(1) }}>{tr('مسح التصفية', 'Clear filters')}</button>}
          </Empty></div>
        )}
        {pages > 1 && (
          <div className="flex items-center justify-center gap-3 border-t border-line px-5 py-3 text-[14px]">
            <button className="btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>{tr('السابق', 'Previous')}</button>
            <span className="num">{tr(`صفحة ${page} من ${pages}`, `Page ${page} of ${pages}`)}</span>
            <button className="btn-ghost btn-sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>{tr('التالي', 'Next')}</button>
          </div>
        )}
      </section>
      {issuing && <IssueDialog onClose={() => setIssuing(false)} onDone={(v) => { setIssuing(false); toast(tr(`صدرت المخالفة ${v.number} وأُبلغ المالك`, `Violation ${v.number} issued and the owner notified`)); reload() }} />}
      {open && <DetailDialog v={open} onClose={() => setOpen(null)} onChanged={(v) => { setOpen(v); reload() }} />}
    </>
  )
}

/** settings → «المخالفات»: the violation types and their fines (settings.manage) */
export function ViolationTypesPanel() {
  const { toast } = useApp()
  const { data, loading, error, reload } = useLoad(() => api.violationTypes(), [])
  const blank = { name: '', nameEn: '', amount: '', active: true, allowsNameResolution: false }
  const [edit, setEdit] = useState<{ id: string | null; name: string; nameEn: string; amount: string; active: boolean; allowsNameResolution: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const amount = edit ? Number(edit.amount) : NaN
  const valid = !!edit && edit.name.trim().length >= 3 && edit.amount.trim() !== '' && amount >= 0 && amount <= 1_000_000

  async function save() {
    if (!edit) return
    setBusy(true); setErr('')
    try {
      const t = await api.saveViolationType(edit.id, { name: edit.name.trim(), nameEn: edit.nameEn.trim() || undefined, amount, active: edit.active, allowsNameResolution: edit.allowsNameResolution })
      toast(tr(`حُفظ نوع المخالفة «${t.name}»`, `Violation type “${t.name}” saved`)); setEdit(null); reload()
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  async function remove(t: ViolationType) {
    try { await api.deleteViolationType(t.id); toast(tr(`حُذف نوع المخالفة «${t.name}»`, `Violation type “${t.name}” deleted`)); reload() } catch (e) { toast((e as Error).message, 'bad') }
  }
  async function toggle(t: ViolationType) {
    try { await api.saveViolationType(t.id, { name: t.name, nameEn: t.nameEn, amount: t.amount, active: !t.active, allowsNameResolution: t.allowsNameResolution }); reload() } catch (e) { toast((e as Error).message, 'bad') }
  }

  return (
    <section className="panel overflow-hidden">
      <header className="flex flex-wrap items-start gap-3 border-b border-line/70 px-5 py-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-pine-soft text-pine"><Icon name="alert" className="h-[18px] w-[18px]" /></span>
        <div className="flex-1"><h2 className="text-[17px]">{tr('أنواع المخالفات', 'Violation types')}</h2><p className="mt-0.5 text-[14px] leading-6 text-muted">{tr('يختار الموظف النوع عند إصدار المخالفة فتُحدَّد الغرامة منه. الغرامة 0 تعني مخالفة مسجلة دون مبلغ. تعديل النوع لا يغيّر المخالفات الصادرة.', 'Staff pick the type when issuing a violation, which sets the fine. A fine of 0 records the violation with nothing to pay. Editing a type does not change violations already issued.')}</p></div>
        {!edit && <button className="btn-primary btn-sm" onClick={() => { setEdit({ id: null, ...blank }); setErr('') }}><Icon name="plus" className="h-4 w-4" />{tr('نوع جديد', 'New type')}</button>}
      </header>
      {edit && (
        <div className="space-y-3 border-b border-line bg-stone/40 px-5 py-4">
          {err && <ErrorBox text={err} />}
          <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr_10rem]">
            <div><label className="label" htmlFor="vt-name">{tr('اسم المخالفة', 'Violation name')}</label><input id="vt-name" className="field" maxLength={100} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} autoFocus /></div>
            <div><label className="label" htmlFor="vt-en">{tr('الاسم بالإنجليزية (اختياري)', 'English name (optional)')}</label><input id="vt-en" className="field" dir="ltr" maxLength={100} value={edit.nameEn} onChange={(e) => setEdit({ ...edit, nameEn: e.target.value })} /></div>
            <div><label className="label" htmlFor="vt-amount">{tr('الغرامة (ريال)', 'Fine (SAR)')}</label><input id="vt-amount" className="field num" dir="ltr" inputMode="decimal" value={edit.amount} onChange={(e) => setEdit({ ...edit, amount: e.target.value.replace(/[^\d.]/g, '') })} placeholder="0" /></div>
          </div>
          <label className="flex items-center gap-2 text-[14.5px]"><input type="checkbox" checked={edit.allowsNameResolution} onChange={(e) => setEdit({ ...edit, allowsNameResolution: e.target.checked })} />{tr('تقبل التسوية بربط اسم (يربط المالك اسم قعود أو بكار يملكه بشريحة الجمل بدل السداد)', 'Can be settled by linking a name (the owner links a qaadan or bakkar name they own to the camel chip instead of paying)')}</label>
          <label className="flex items-center gap-2 text-[14.5px]"><input type="checkbox" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} />{tr('مفعّل (يظهر عند إصدار مخالفة)', 'Active (offered when issuing a violation)')}</label>
          <div className="flex gap-2">
            <button className="btn-primary btn-sm" disabled={!valid || busy} onClick={save}>{busy ? tr('جارٍ الحفظ…', 'Saving…') : tr('حفظ', 'Save')}</button>
            <button className="btn-ghost btn-sm" onClick={() => setEdit(null)}>{tr('إلغاء', 'Cancel')}</button>
          </div>
        </div>
      )}
      {error ? <div className="p-5"><ErrorBox text={error} /></div> : loading && !data ? <Loading /> : data?.length ? (
        <ul className="divide-y divide-line/70">
          {data.map((t) => (
            <li key={t.id} className={`flex flex-wrap items-center gap-3 px-5 py-3.5 ${t.active ? '' : 'opacity-60'}`}>
              <div className="min-w-[12rem] flex-1">
                <b className="text-[15.5px]">{t.name}</b>{t.nameEn && <span className="ms-2 text-[13px] text-muted" dir="ltr">{t.nameEn}</span>}
                <p className="text-[13px] text-muted">{tr(`${num(t.used)} مخالفة صادرة`, `${num(t.used)} issued`)}{t.allowsNameResolution && ` · ${tr('تقبل التسوية بربط اسم', 'Name settlement allowed')}`}{!t.active && ` · ${tr('موقوف', 'Off')}`}</p>
              </div>
              <span className="num font-extrabold">{t.amount > 0 ? sar(t.amount) : tr('بلا غرامة', 'No fine')}</span>
              <div className="flex gap-1.5">
                <button className="btn-ghost btn-sm" onClick={() => { setEdit({ id: t.id, name: t.name, nameEn: t.nameEn ?? '', amount: String(t.amount), active: t.active, allowsNameResolution: t.allowsNameResolution }); setErr('') }}>{tr('تعديل', 'Edit')}</button>
                <button className="btn-ghost btn-sm" onClick={() => toggle(t)}>{t.active ? tr('إيقاف', 'Turn off') : tr('تفعيل', 'Turn on')}</button>
                {t.used === 0 && <button className="btn-ghost btn-sm text-bad" onClick={() => remove(t)}>{tr('حذف', 'Delete')}</button>}
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="px-5 py-10 text-center text-muted">{tr('لا توجد أنواع مخالفات بعد. أضف نوعًا لتتمكن اللجنة من إصدار المخالفات.', 'No violation types yet. Add one so staff can issue violations.')}</p>}
    </section>
  )
}

/** settings → «المخالفات» → «المهرجانات»: the festivals a violation can be issued at (settings.manage) */
export function FestivalsPanel() {
  const { toast } = useApp()
  const { data, loading, error, reload } = useLoad(() => api.festivals(), [])
  type Draft = { id: string | null; name: string; nameEn: string; year: string; startsOn: string; endsOn: string; active: boolean }
  const [edit, setEdit] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const year = edit?.year.trim() ? Number(edit.year) : undefined
  const valid = !!edit && edit.name.trim().length >= 3 && (year === undefined || (year >= 2000 && year <= 2100)) && !(edit.startsOn && edit.endsOn && edit.endsOn < edit.startsOn)

  async function save() {
    if (!edit) return
    setBusy(true); setErr('')
    try {
      const f = await api.saveFestival(edit.id, { name: edit.name.trim(), nameEn: edit.nameEn.trim() || undefined, year, startsOn: edit.startsOn || undefined, endsOn: edit.endsOn || undefined, active: edit.active })
      toast(tr(`حُفظ المهرجان «${f.name}»`, `Festival “${f.name}” saved`)); setEdit(null); reload()
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  const draftOf = (f: Festival): Draft => ({ id: f.id, name: f.name, nameEn: f.nameEn ?? '', year: f.year ? String(f.year) : '', startsOn: f.startsOn ?? '', endsOn: f.endsOn ?? '', active: f.active })
  async function toggle(f: Festival) {
    try { await api.saveFestival(f.id, { name: f.name, nameEn: f.nameEn, year: f.year, startsOn: f.startsOn, endsOn: f.endsOn, active: !f.active }); reload() } catch (e) { toast((e as Error).message, 'bad') }
  }
  async function remove(f: Festival) {
    try { await api.deleteFestival(f.id); toast(tr(`حُذف المهرجان «${f.name}»`, `Festival “${f.name}” deleted`)); reload() } catch (e) { toast((e as Error).message, 'bad') }
  }

  return (
    <section className="panel overflow-hidden">
      <header className="flex flex-wrap items-start gap-3 border-b border-line/70 px-5 py-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gold-soft text-gold-deep"><Icon name="trophy" className="h-[18px] w-[18px]" /></span>
        <div className="flex-1"><h2 className="text-[17px]">{tr('المهرجانات', 'Festivals')}</h2><p className="mt-0.5 text-[14px] leading-6 text-muted">{tr('يختار الموظف المهرجان عند إصدار المخالفة، ويختاره المالك عند طلب استثناء المشاركة بدون اسم. المهرجان الموقوف أو المنتهي لا يظهر في النماذج.', 'Staff choose the festival when issuing a violation, and owners choose it when asking for an exemption to race without a name. A switched-off or finished festival is not offered.')}</p></div>
        {!edit && <button className="btn-primary btn-sm" onClick={() => { setEdit({ id: null, name: '', nameEn: '', year: String(new Date().getFullYear()), startsOn: '', endsOn: '', active: true }); setErr('') }}><Icon name="plus" className="h-4 w-4" />{tr('مهرجان جديد', 'New festival')}</button>}
      </header>
      {edit && (
        <div className="space-y-3 border-b border-line bg-stone/40 px-5 py-4">
          {err && <ErrorBox text={err} />}
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="label" htmlFor="fs-name">{tr('اسم المهرجان', 'Festival name')}</label><input id="fs-name" className="field" maxLength={150} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} autoFocus /></div>
            <div><label className="label" htmlFor="fs-en">{tr('الاسم بالإنجليزية (اختياري)', 'English name (optional)')}</label><input id="fs-en" className="field" dir="ltr" maxLength={150} value={edit.nameEn} onChange={(e) => setEdit({ ...edit, nameEn: e.target.value })} /></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div><label className="label" htmlFor="fs-year">{tr('السنة', 'Year')}</label><input id="fs-year" className="field num" dir="ltr" inputMode="numeric" maxLength={4} value={edit.year} onChange={(e) => setEdit({ ...edit, year: e.target.value.replace(/\D/g, '') })} /></div>
            <div><label className="label" htmlFor="fs-from">{tr('يبدأ', 'Starts')}</label><input id="fs-from" type="date" className="field" value={edit.startsOn} onChange={(e) => setEdit({ ...edit, startsOn: e.target.value })} /></div>
            <div><label className="label" htmlFor="fs-to">{tr('ينتهي', 'Ends')}</label><input id="fs-to" type="date" className="field" value={edit.endsOn} min={edit.startsOn || undefined} onChange={(e) => setEdit({ ...edit, endsOn: e.target.value })} /></div>
          </div>
          <label className="flex items-center gap-2 text-[14.5px]"><input type="checkbox" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} />{tr('مفعّل (يظهر عند إصدار مخالفة)', 'Active (offered when issuing a violation)')}</label>
          <div className="flex gap-2">
            <button className="btn-primary btn-sm" disabled={!valid || busy} onClick={save}>{busy ? tr('جارٍ الحفظ…', 'Saving…') : tr('حفظ', 'Save')}</button>
            <button className="btn-ghost btn-sm" onClick={() => setEdit(null)}>{tr('إلغاء', 'Cancel')}</button>
          </div>
        </div>
      )}
      {error ? <div className="p-5"><ErrorBox text={error} /></div> : loading && !data ? <Loading /> : data?.length ? (
        <ul className="divide-y divide-line/70">
          {data.map((f) => (
            <li key={f.id} className={`flex flex-wrap items-center gap-3 px-5 py-3.5 ${f.active ? '' : 'opacity-60'}`}>
              <div className="min-w-[12rem] flex-1">
                <b className="text-[15.5px]">{f.name}</b>{f.nameEn && <span className="ms-2 text-[13px] text-muted" dir="ltr">{f.nameEn}</span>}
                <p className="text-[13px] text-muted">
                  {f.startsOn ? <span className="num" dir="ltr">{f.startsOn}{f.endsOn && ` → ${f.endsOn}`}</span> : f.year ? <span className="num">{f.year}</span> : null}
                  {(f.startsOn || f.year) && ' · '}{tr(`${num(f.used)} مخالفة`, `${num(f.used)} violations`)}{!f.active && ` · ${tr('موقوف', 'Off')}`}
                </p>
              </div>
              <div className="flex gap-1.5">
                <button className="btn-ghost btn-sm" onClick={() => { setEdit(draftOf(f)); setErr('') }}>{tr('تعديل', 'Edit')}</button>
                <button className="btn-ghost btn-sm" onClick={() => toggle(f)}>{f.active ? tr('إيقاف', 'Turn off') : tr('تفعيل', 'Turn on')}</button>
                {f.used === 0 && <button className="btn-ghost btn-sm text-bad" onClick={() => remove(f)}>{tr('حذف', 'Delete')}</button>}
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="px-5 py-10 text-center text-muted">{tr('لا توجد مهرجانات بعد.', 'No festivals yet.')}</p>}
    </section>
  )
}

/** settings → «المخالفات»: festivals above the violation types */
export function ViolationSettingsPanel() {
  return <div className="space-y-6"><FestivalsPanel /><ViolationTypesPanel /></div>
}
