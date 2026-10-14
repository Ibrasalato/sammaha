import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon, SectionCard } from '../../components/dash'
import { PhoneField, Req } from '../../components/ProfileFields'
import { ErrorBox, Loading, Modal } from '../../components/ui'
import { date, dateTime } from '../../lib/format'
import { api, useApp, useLoad } from '../../lib/store'
import type { Delegation, DelegationCapacity, DelegationInput, DelegationScope } from '../../lib/types'
import { tr } from '../../lib/i18n'

/** same catalogue as the API (Domain/Delegation.cs) */
// label/description are getters, so they follow the current language
const scope = (key: DelegationScope, ar: [string, string], en: [string, string]) => ({ key, get label() { return tr(ar[0], en[0]) }, get description() { return tr(ar[1], en[1]) } })
export const SCOPES: { key: DelegationScope; label: string; description: string }[] = [
  scope('requests', ['طلبات الشعارات', 'تقديم طلبات الشعارات والأسماء المركبة، ودفع ضمانها، وسحب اسم أو إلغاء الطلب'], ['Name requests', 'Submit name and compound name requests, pay their guarantee, and withdraw a name or cancel a request']),
  scope('invest', ['استثمار الاسم', 'تقديم طلبات استثمار الاسم ودفع رسوم الدراسة'], ['Name investment', 'Submit name investment requests and pay the review fee']),
  scope('bids', ['المزايدة والشراء', 'المزايدة والمزايدة الآلية والمتابعة، وضمان دخول المزاد، وشراء الأسماء المعروضة'], ['Bidding and buying', 'Bid, auto-bid and watch, pay the participation guarantee, and buy listed names']),
  scope('payments', ['المحفظة والفواتير', 'شحن المحفظة وسداد الفواتير والمخالفات'], ['Wallet and invoices', 'Top up the wallet and pay invoices and violation fines']),
  scope('sales', ['بيع الأسماء', 'عرض أسمائك للبيع بالمزاد أو بسعر ثابت وإلغاء العرض'], ['Selling names', 'List your names for sale by auction or at a fixed price, and cancel listings']),
  scope('tickets', ['الشكاوى والاستفسارات', 'تقديم الشكاوى والاستفسارات ومتابعتها'], ['Complaints & inquiries', 'Submit and follow up on complaints and inquiries']),
]
export const scopeLabel = (k: string) => SCOPES.find((s) => s.key === k)?.label ?? k
const capacities = (): [DelegationCapacity, string][] => [['agent', tr('وكيل شرعي', 'Legal agent')], ['family', tr('فرد من العائلة', 'Family member')], ['employee', tr('موظف أو مدير أعمال', 'Employee or business manager')], ['partner', tr('شريك', 'Partner')], ['other', tr('أخرى', 'Other')]]
const statusMap = (): Record<Delegation['status'], [string, string]> => ({
  active: [tr('ساري', 'Active'), 'bg-[#E2F0E8] text-ok'], scheduled: [tr('يبدأ لاحقًا', 'Starts later'), 'bg-info-soft text-info-deep'], expired: [tr('منتهٍ', 'Expired'), 'bg-stone-deep text-muted'],
  revoked: [tr('ملغى', 'Revoked'), 'bg-bad/10 text-bad'], awaiting_account: [tr('بانتظار حساب المفوض', 'Awaiting delegate account'), 'bg-gold-soft text-gold-deep'],
})
const toDate = (iso?: string) => (iso ? new Date(Date.parse(iso) + 3 * 3600_000).toISOString().slice(0, 10) : '')
const fromDate = (d: string, end = false) => new Date(`${d}T${end ? '23:59:59' : '00:00:00'}+03:00`).toISOString()

function Period({ d }: { d: Delegation }) {
  return <span>{d.permanent ? tr('تفويض دائم', 'Permanent delegation') : tr(`من ${date(d.startsAt)} إلى ${d.endsAt ? date(d.endsAt) : '—'}`, `From ${date(d.startsAt)} to ${d.endsAt ? date(d.endsAt) : '—'}`)}</span>
}

function DelegationForm({ current, onClose, onSaved }: { current: Delegation | null; onClose: () => void; onSaved: (d: Delegation) => void }) {
  const today = toDate(new Date().toISOString())
  const [f, setF] = useState<DelegationInput>(() => current ? {
    fullName: current.fullName, nationalId: current.nationalId, phoneCountry: current.phone.startsWith('+') ? '' : '966', phone: current.phone, email: current.email,
    capacity: current.capacity, capacityNote: current.capacityNote, scopes: current.scopes, permanent: current.permanent, startsAt: current.startsAt, endsAt: current.endsAt,
  } : { fullName: '', nationalId: '', phoneCountry: '966', phone: '', email: '', capacity: '', scopes: [], permanent: false })
  const [start, setStart] = useState(toDate(current?.startsAt) || today)
  const [end, setEnd] = useState(toDate(current?.endsAt) || toDate(new Date(Date.now() + 30 * 864e5).toISOString()))
  const [agree, setAgree] = useState(!!current)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const put = <K extends keyof DelegationInput>(k: K, v: DelegationInput[K]) => setF((x) => ({ ...x, [k]: v }))
  const toggle = (k: DelegationScope) => put('scopes', f.scopes.includes(k) ? f.scopes.filter((x) => x !== k) : [...f.scopes, k])
  const preset = (days: number) => setEnd(toDate(new Date(Date.parse(fromDate(start)) + days * 864e5).toISOString()))

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setErr('')
    try {
      onSaved(await api.saveDelegation(current?.id ?? null, { ...f, startsAt: fromDate(start), endsAt: f.permanent ? undefined : fromDate(end, true) }))
    } catch (x) { setErr((x as Error).message) } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title={current ? tr(`تعديل تفويض ${current.fullName}`, `Edit delegation for ${current.fullName}`) : tr('إضافة مفوض', 'Add delegate')} wide>
      <form onSubmit={submit} className="space-y-5">
        {err && <ErrorBox text={err} />}
        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-2 font-bold text-pine">{tr('بيانات المفوض', 'Delegate details')}</legend>
          <div className="sm:col-span-2"><Req htmlFor="dn">{tr('الاسم الرباعي', 'Full name')}</Req><input id="dn" className="field" value={f.fullName} onChange={(e) => put('fullName', e.target.value)} required /></div>
          <div><Req htmlFor="did">{tr('رقم الهوية / الإقامة', 'National ID / Iqama')}</Req><input id="did" className="field num" dir="ltr" value={f.nationalId} onChange={(e) => put('nationalId', e.target.value)} required /><p className="hint">{tr('يرتبط التفويض بحساب المفوض عندما تطابق هويته وجواله.', 'The delegation links to the delegate’s account when their ID and mobile match.')}</p></div>
          <div><Req htmlFor="dph">{tr('رقم الجوال', 'Mobile number')}</Req><PhoneField id="dph" dial={f.phoneCountry || '966'} onDial={(v) => put('phoneCountry', v)} value={f.phone} onChange={(v) => put('phone', v)} /></div>
          <div className="sm:col-span-2"><Req htmlFor="dem">{tr('البريد الإلكتروني', 'Email')}</Req><input id="dem" type="email" className="field" dir="ltr" value={f.email} onChange={(e) => put('email', e.target.value)} required /></div>
          <div><Req htmlFor="dcap">{tr('صفة المفوض', 'Delegate capacity')}</Req>
            <select id="dcap" className="field" value={f.capacity} onChange={(e) => put('capacity', e.target.value as DelegationCapacity)} required>
              <option value="">{tr('اختر', 'Choose')}</option>{capacities().map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select></div>
          {f.capacity === 'other' && <div><Req htmlFor="dnote">{tr('اكتب الصفة', 'Specify the capacity')}</Req><input id="dnote" className="field" value={f.capacityNote ?? ''} onChange={(e) => put('capacityNote', e.target.value)} required maxLength={100} /></div>}
        </fieldset>

        <fieldset>
          <legend className="mb-1 font-bold text-pine">{tr('صلاحيات إدارة الحساب', 'Account management permissions')}</legend>
          <p className="mb-2 text-[13px] text-muted">{tr('يستطيع المفوض دائمًا عرض حسابك. تبقى لك وحدك: كلمة المرور والجوال والبريد، والحساب البنكي والاسترداد، وبياناتك الشخصية، وإدارة التفويض.', 'A delegate can always view your account. Only you keep: password, mobile and email, bank account and refunds, your personal details, and delegation management.')}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {SCOPES.map((s) => (
              <label key={s.key} className={`flex cursor-pointer items-start gap-2.5 rounded-lg border-2 p-3 ${f.scopes.includes(s.key) ? 'border-pine bg-pine-soft/50' : 'border-line'}`}>
                <input type="checkbox" className="mt-1" checked={f.scopes.includes(s.key)} onChange={() => toggle(s.key)} />
                <span><b className="block text-[14.5px]">{s.label}</b><span className="text-[12.5px] text-muted">{s.description}</span></span>
              </label>
            ))}
          </div>
          {!f.scopes.length && <p className="hint">{tr('بدون صلاحيات يكون التفويض للاطلاع فقط.', 'Without permissions, the delegation is view-only.')}</p>}
        </fieldset>

        <fieldset>
          <legend className="mb-2 font-bold text-pine">{tr('مدة التفويض', 'Delegation period')}</legend>
          <div className="flex gap-2">
            {([[false, tr('مؤقت', 'Temporary')], [true, tr('دائم', 'Permanent')]] as const).map(([p, l]) => (
              <button key={l} type="button" aria-pressed={f.permanent === p} onClick={() => put('permanent', p)}
                className={`btn-sm flex-1 rounded-lg border-2 py-2.5 font-bold ${f.permanent === p ? 'border-pine bg-pine text-paper' : 'border-line'}`}>{l}</button>
            ))}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div><Req htmlFor="ds">{tr('يبدأ من', 'Starts on')}</Req><input id="ds" type="date" className="field" dir="ltr" min={current ? undefined : today} value={start} onChange={(e) => setStart(e.target.value)} required /></div>
            {!f.permanent && <div><Req htmlFor="de">{tr('ينتهي في', 'Ends on')}</Req><input id="de" type="date" className="field" dir="ltr" min={start} value={end} onChange={(e) => setEnd(e.target.value)} required /></div>}
          </div>
          {!f.permanent && <div className="mt-2 flex flex-wrap gap-1.5">{([[7, tr('أسبوع', '1 week')], [30, tr('شهر', '1 month')], [90, tr('3 أشهر', '3 months')], [180, tr('6 أشهر', '6 months')], [365, tr('سنة', '1 year')]] as const).map(([d, l]) => <button key={d} type="button" className="btn-ghost btn-sm" onClick={() => preset(d)}>{l}</button>)}</div>}
          {f.permanent && <p className="hint">{tr('يبقى ساريًا حتى تلغيه.', 'Stays active until you revoke it.')}</p>}
        </fieldset>

        {!current && <label className="flex items-start gap-2 text-[14px]"><input type="checkbox" className="mt-1" checked={agree} onChange={(e) => setAgree(e.target.checked)} required /><span>{tr('أقرّ بأن ما يجريه المفوض ضمن الصلاحيات المحددة يُعد صادرًا عني، ويُسجَّل كل إجراء باسمه في سجل النشاط.', 'I acknowledge that actions the delegate takes within the granted permissions are considered mine, and each action is recorded under their name in the activity log.')}</span></label>}
        <div className="flex gap-2">
          <button className="btn-primary flex-1" disabled={busy || !agree}>{busy ? tr('جارٍ الحفظ…', 'Saving…') : current ? tr('حفظ التعديل', 'Save changes') : tr('إضافة المفوض', 'Add delegate')}</button>
          <button type="button" className="btn-ghost" onClick={onClose}>{tr('إلغاء', 'Cancel')}</button>
        </div>
      </form>
    </Modal>
  )
}

export function DelegationPanel() {
  const { setUser, toast } = useApp()
  const nav = useNavigate()
  const mine = useLoad(() => api.myDelegations(), [])
  const toMe = useLoad(() => api.delegatedToMe(), [])
  const [edit, setEdit] = useState<Delegation | 'new' | null>(null)
  const [revoking, setRevoking] = useState<Delegation | null>(null)
  const [busy, setBusy] = useState('')
  const STATUS = statusMap()

  async function enter(d: Delegation) {
    setBusy(d.id)
    try { setUser(await api.actAs(d.id)); toast(tr(`أنت الآن في حساب ${d.ownerName}`, `You are now in ${d.ownerName}’s account`)); nav('/dashboard') } catch (e) { toast((e as Error).message, 'bad') } finally { setBusy('') }
  }

  return (
    <div className="space-y-6">
      <SectionCard title={tr('المفوضون على حسابي', 'Delegates on my account')} icon="users" action={<button className="btn-primary btn-sm" onClick={() => setEdit('new')}><Icon name="plus" className="h-4 w-4" />{tr('إضافة مفوض', 'Add delegate')}</button>}>
        <div className="p-5">
          {mine.error ? <ErrorBox text={mine.error} /> : mine.loading && !mine.data ? <Loading /> : mine.data?.length ? (
            <ul className="space-y-3">
              {mine.data.map((d) => (
                <li key={d.id} className={`rounded-xl border border-line p-4 ${d.status === 'revoked' || d.status === 'expired' ? 'opacity-60' : ''}`}>
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-[12rem] flex-1">
                      <b className="text-[16px]">{d.fullName}</b> <span className={`pill ms-1 ${STATUS[d.status][1]}`}>{STATUS[d.status][0]}</span>
                      <p className="mt-0.5 text-[13px] text-muted">{d.capacity === 'other' ? d.capacityNote : d.capacityLabel} · {tr('هوية', 'ID')} <span className="num" dir="ltr">{d.nationalId}</span> · <span className="num" dir="ltr">{d.phone}</span> · {d.email}</p>
                      <p className="mt-0.5 text-[13px] text-muted"><Period d={d} />{d.lastUsedAt ? tr(` · آخر دخول ${dateTime(d.lastUsedAt)}`, ` · Last access ${dateTime(d.lastUsedAt)}`) : ''}</p>
                    </div>
                    {d.status !== 'revoked' && d.status !== 'expired' && <div className="flex gap-1.5">
                      <button className="btn-ghost btn-sm" onClick={() => setEdit(d)}>{tr('تعديل', 'Edit')}</button>
                      <button className="btn-danger btn-sm" onClick={() => setRevoking(d)}>{tr('إلغاء التفويض', 'Revoke delegation')}</button>
                    </div>}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">{d.scopes.length ? d.scopes.map((s) => <span key={s} className="rounded-md bg-pine-soft px-2 py-0.5 text-[12.5px] text-pine">{scopeLabel(s)}</span>) : <span className="rounded-md bg-stone px-2 py-0.5 text-[12.5px] text-muted">{tr('اطلاع فقط', 'View only')}</span>}</div>
                  {d.status === 'awaiting_account' && <p className="mt-2 text-[12.5px] text-gold-deep">{tr('يُفعَّل التفويض عندما ينشئ المفوض حسابه في سمّها بنفس رقم الهوية والجوال.', 'The delegation activates when the delegate creates a Sammha account with the same ID and mobile number.')}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-6 text-center">
              <p className="font-semibold">{tr('لا يوجد مفوضون على حسابك', 'No delegates on your account')}</p>
              <p className="mt-1 text-[14px] text-muted">{tr('فوّض شخصًا تثق به ليقدّم الطلبات أو يزايد أو يسدد نيابة عنك، بصلاحيات ومدة تحددها.', 'Delegate someone you trust to submit requests, bid or pay on your behalf, with permissions and a period you set.')}</p>
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard title={tr('حسابات فُوِّضتُ لإدارتها', 'Accounts delegated to me')} icon="shield">
        <div className="p-5">
          {toMe.loading && !toMe.data ? <Loading /> : toMe.data?.length ? (
            <ul className="space-y-3">
              {toMe.data.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-4">
                  <div className="min-w-[12rem] flex-1">
                    <b className="text-[16px]">{d.ownerName}</b> <span className={`pill ms-1 ${STATUS[d.status][1]}`}>{STATUS[d.status][0]}</span>
                    <p className="mt-0.5 text-[13px] text-muted">{tr('بصفتك', 'As')} {d.capacity === 'other' ? d.capacityNote : d.capacityLabel} · <Period d={d} /></p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">{d.scopes.length ? d.scopes.map((s) => <span key={s} className="rounded-md bg-pine-soft px-2 py-0.5 text-[12.5px] text-pine">{scopeLabel(s)}</span>) : <span className="rounded-md bg-stone px-2 py-0.5 text-[12.5px] text-muted">{tr('اطلاع فقط', 'View only')}</span>}</div>
                  </div>
                  {d.status === 'active' && <button className="btn-gold" disabled={busy === d.id} onClick={() => enter(d)}>{busy === d.id ? '…' : tr('الدخول إلى الحساب', 'Enter account')}</button>}
                </li>
              ))}
            </ul>
          ) : <p className="py-4 text-center text-[14px] text-muted">{tr('لا توجد حسابات فوّضك أصحابها.', 'No account owners have delegated to you.')}</p>}
        </div>
      </SectionCard>

      {edit && <DelegationForm current={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onSaved={(d) => { setEdit(null); mine.reload(); toast(d.linked ? tr('حُفظ التفويض ووصل إشعار للمفوض', 'Delegation saved and the delegate was notified') : tr('حُفظ التفويض، ويُفعَّل عند تسجيل المفوض في سمّها', 'Delegation saved; it activates when the delegate signs up to Sammha')) }} />}
      <Modal open={!!revoking} onClose={() => setRevoking(null)} title={tr('إلغاء التفويض', 'Revoke delegation')}>
        {revoking && (
          <div className="space-y-4">
            <p className="text-[15px] leading-7">{tr('إلغاء تفويض', 'Revoke the delegation for')} <b>{revoking.fullName}</b>{tr('؟ يخرج فورًا من حسابك إن كان داخله، ولا يمكنه الدخول مجددًا.', '? They are signed out of your account immediately if inside it, and cannot enter again.')}</p>
            <div className="flex gap-2">
              <button className="btn-danger flex-1" onClick={async () => { try { await api.revokeDelegation(revoking.id); toast(tr('أُلغي التفويض', 'Delegation revoked')); mine.reload() } catch (e) { toast((e as Error).message, 'bad') } finally { setRevoking(null) } }}>{tr('إلغاء التفويض', 'Revoke delegation')}</button>
              <button className="btn-ghost" onClick={() => setRevoking(null)}>{tr('رجوع', 'Back')}</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
