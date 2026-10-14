import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon, SectionCard } from '../../components/dash'
import { PhoneField, Req } from '../../components/ProfileFields'
import { ErrorBox, Loading, Modal } from '../../components/ui'
import { date, dateTime } from '../../lib/format'
import { api, useApp, useLoad } from '../../lib/store'
import type { Delegation, DelegationCapacity, DelegationInput, DelegationScope } from '../../lib/types'

/** same catalogue as the API (Domain/Delegation.cs) */
export const SCOPES: { key: DelegationScope; label: string; description: string }[] = [
  { key: 'requests', label: 'طلبات الشعارات', description: 'تقديم طلبات الشعارات والأسماء المركبة، ودفع ضمانها، وسحب اسم أو إلغاء الطلب' },
  { key: 'invest', label: 'استثمار الاسم', description: 'تقديم طلبات استثمار الاسم ودفع رسوم الدراسة' },
  { key: 'bids', label: 'المزايدة والشراء', description: 'المزايدة والمزايدة الآلية والمتابعة، وضمان دخول المزاد، وشراء الأسماء المعروضة' },
  { key: 'payments', label: 'المحفظة والفواتير', description: 'شحن المحفظة وسداد الفواتير' },
  { key: 'sales', label: 'بيع الأسماء', description: 'عرض أسمائك للبيع بالمزاد أو بسعر ثابت وإلغاء العرض' },
  { key: 'tickets', label: 'الشكاوى والاستفسارات', description: 'تقديم الشكاوى والاستفسارات ومتابعتها' },
]
export const scopeLabel = (k: string) => SCOPES.find((s) => s.key === k)?.label ?? k
const CAPACITIES: [DelegationCapacity, string][] = [['agent', 'وكيل شرعي'], ['family', 'فرد من العائلة'], ['employee', 'موظف أو مدير أعمال'], ['partner', 'شريك'], ['other', 'أخرى']]
const STATUS: Record<Delegation['status'], [string, string]> = {
  active: ['ساري', 'bg-[#E2F0E8] text-ok'], scheduled: ['يبدأ لاحقًا', 'bg-info-soft text-info-deep'], expired: ['منتهٍ', 'bg-stone-deep text-muted'],
  revoked: ['ملغى', 'bg-bad/10 text-bad'], awaiting_account: ['بانتظار حساب المفوض', 'bg-gold-soft text-gold-deep'],
}
const toDate = (iso?: string) => (iso ? new Date(Date.parse(iso) + 3 * 3600_000).toISOString().slice(0, 10) : '')
const fromDate = (d: string, end = false) => new Date(`${d}T${end ? '23:59:59' : '00:00:00'}+03:00`).toISOString()

function Period({ d }: { d: Delegation }) {
  return <span>{d.permanent ? 'تفويض دائم' : `من ${date(d.startsAt)} إلى ${d.endsAt ? date(d.endsAt) : '—'}`}</span>
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
    <Modal open onClose={onClose} title={current ? `تعديل تفويض ${current.fullName}` : 'إضافة مفوض'} wide>
      <form onSubmit={submit} className="space-y-5">
        {err && <ErrorBox text={err} />}
        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-2 font-bold text-pine">بيانات المفوض</legend>
          <div className="sm:col-span-2"><Req htmlFor="dn">الاسم الرباعي</Req><input id="dn" className="field" value={f.fullName} onChange={(e) => put('fullName', e.target.value)} required /></div>
          <div><Req htmlFor="did">رقم الهوية / الإقامة</Req><input id="did" className="field num" dir="ltr" value={f.nationalId} onChange={(e) => put('nationalId', e.target.value)} required /><p className="hint">يرتبط التفويض بحساب المفوض عندما تطابق هويته وجواله.</p></div>
          <div><Req htmlFor="dph">رقم الجوال</Req><PhoneField id="dph" dial={f.phoneCountry || '966'} onDial={(v) => put('phoneCountry', v)} value={f.phone} onChange={(v) => put('phone', v)} /></div>
          <div className="sm:col-span-2"><Req htmlFor="dem">البريد الإلكتروني</Req><input id="dem" type="email" className="field" dir="ltr" value={f.email} onChange={(e) => put('email', e.target.value)} required /></div>
          <div><Req htmlFor="dcap">صفة المفوض</Req>
            <select id="dcap" className="field" value={f.capacity} onChange={(e) => put('capacity', e.target.value as DelegationCapacity)} required>
              <option value="">اختر</option>{CAPACITIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select></div>
          {f.capacity === 'other' && <div><Req htmlFor="dnote">اكتب الصفة</Req><input id="dnote" className="field" value={f.capacityNote ?? ''} onChange={(e) => put('capacityNote', e.target.value)} required maxLength={100} /></div>}
        </fieldset>

        <fieldset>
          <legend className="mb-1 font-bold text-pine">صلاحيات إدارة الحساب</legend>
          <p className="mb-2 text-[13px] text-muted">يستطيع المفوض دائمًا عرض حسابك. تبقى لك وحدك: كلمة المرور والجوال والبريد، والحساب البنكي والاسترداد، وبياناتك الشخصية، وإدارة التفويض.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {SCOPES.map((s) => (
              <label key={s.key} className={`flex cursor-pointer items-start gap-2.5 rounded-lg border-2 p-3 ${f.scopes.includes(s.key) ? 'border-pine bg-pine-soft/50' : 'border-line'}`}>
                <input type="checkbox" className="mt-1" checked={f.scopes.includes(s.key)} onChange={() => toggle(s.key)} />
                <span><b className="block text-[14.5px]">{s.label}</b><span className="text-[12.5px] text-muted">{s.description}</span></span>
              </label>
            ))}
          </div>
          {!f.scopes.length && <p className="hint">بدون صلاحيات يكون التفويض للاطلاع فقط.</p>}
        </fieldset>

        <fieldset>
          <legend className="mb-2 font-bold text-pine">مدة التفويض</legend>
          <div className="flex gap-2">
            {([[false, 'مؤقت'], [true, 'دائم']] as const).map(([p, l]) => (
              <button key={l} type="button" aria-pressed={f.permanent === p} onClick={() => put('permanent', p)}
                className={`btn-sm flex-1 rounded-lg border-2 py-2.5 font-bold ${f.permanent === p ? 'border-pine bg-pine text-paper' : 'border-line'}`}>{l}</button>
            ))}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div><Req htmlFor="ds">يبدأ من</Req><input id="ds" type="date" className="field" dir="ltr" min={current ? undefined : today} value={start} onChange={(e) => setStart(e.target.value)} required /></div>
            {!f.permanent && <div><Req htmlFor="de">ينتهي في</Req><input id="de" type="date" className="field" dir="ltr" min={start} value={end} onChange={(e) => setEnd(e.target.value)} required /></div>}
          </div>
          {!f.permanent && <div className="mt-2 flex flex-wrap gap-1.5">{([[7, 'أسبوع'], [30, 'شهر'], [90, '3 أشهر'], [180, '6 أشهر'], [365, 'سنة']] as const).map(([d, l]) => <button key={d} type="button" className="btn-ghost btn-sm" onClick={() => preset(d)}>{l}</button>)}</div>}
          {f.permanent && <p className="hint">يبقى ساريًا حتى تلغيه.</p>}
        </fieldset>

        {!current && <label className="flex items-start gap-2 text-[14px]"><input type="checkbox" className="mt-1" checked={agree} onChange={(e) => setAgree(e.target.checked)} required /><span>أقرّ بأن ما يجريه المفوض ضمن الصلاحيات المحددة يُعد صادرًا عني، ويُسجَّل كل إجراء باسمه في سجل النشاط.</span></label>}
        <div className="flex gap-2">
          <button className="btn-primary flex-1" disabled={busy || !agree}>{busy ? 'جارٍ الحفظ…' : current ? 'حفظ التعديل' : 'إضافة المفوض'}</button>
          <button type="button" className="btn-ghost" onClick={onClose}>إلغاء</button>
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

  async function enter(d: Delegation) {
    setBusy(d.id)
    try { setUser(await api.actAs(d.id)); toast(`أنت الآن في حساب ${d.ownerName}`); nav('/dashboard') } catch (e) { toast((e as Error).message, 'bad') } finally { setBusy('') }
  }

  return (
    <div className="space-y-6">
      <SectionCard title="المفوضون على حسابي" icon="users" action={<button className="btn-primary btn-sm" onClick={() => setEdit('new')}><Icon name="plus" className="h-4 w-4" />إضافة مفوض</button>}>
        <div className="p-5">
          {mine.error ? <ErrorBox text={mine.error} /> : mine.loading && !mine.data ? <Loading /> : mine.data?.length ? (
            <ul className="space-y-3">
              {mine.data.map((d) => (
                <li key={d.id} className={`rounded-xl border border-line p-4 ${d.status === 'revoked' || d.status === 'expired' ? 'opacity-60' : ''}`}>
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-[12rem] flex-1">
                      <b className="text-[16px]">{d.fullName}</b> <span className={`pill ms-1 ${STATUS[d.status][1]}`}>{STATUS[d.status][0]}</span>
                      <p className="mt-0.5 text-[13px] text-muted">{d.capacity === 'other' ? d.capacityNote : d.capacityLabel} · هوية <span className="num" dir="ltr">{d.nationalId}</span> · <span className="num" dir="ltr">{d.phone}</span> · {d.email}</p>
                      <p className="mt-0.5 text-[13px] text-muted"><Period d={d} />{d.lastUsedAt ? ` · آخر دخول ${dateTime(d.lastUsedAt)}` : ''}</p>
                    </div>
                    {d.status !== 'revoked' && d.status !== 'expired' && <div className="flex gap-1.5">
                      <button className="btn-ghost btn-sm" onClick={() => setEdit(d)}>تعديل</button>
                      <button className="btn-danger btn-sm" onClick={() => setRevoking(d)}>إلغاء التفويض</button>
                    </div>}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">{d.scopes.length ? d.scopes.map((s) => <span key={s} className="rounded-md bg-pine-soft px-2 py-0.5 text-[12.5px] text-pine">{scopeLabel(s)}</span>) : <span className="rounded-md bg-stone px-2 py-0.5 text-[12.5px] text-muted">اطلاع فقط</span>}</div>
                  {d.status === 'awaiting_account' && <p className="mt-2 text-[12.5px] text-gold-deep">يُفعَّل التفويض عندما ينشئ المفوض حسابه في سمّها بنفس رقم الهوية والجوال.</p>}
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-6 text-center">
              <p className="font-semibold">لا يوجد مفوضون على حسابك</p>
              <p className="mt-1 text-[14px] text-muted">فوّض شخصًا تثق به ليقدّم الطلبات أو يزايد أو يسدد نيابة عنك، بصلاحيات ومدة تحددها.</p>
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard title="حسابات فُوِّضتُ لإدارتها" icon="shield">
        <div className="p-5">
          {toMe.loading && !toMe.data ? <Loading /> : toMe.data?.length ? (
            <ul className="space-y-3">
              {toMe.data.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-4">
                  <div className="min-w-[12rem] flex-1">
                    <b className="text-[16px]">{d.ownerName}</b> <span className={`pill ms-1 ${STATUS[d.status][1]}`}>{STATUS[d.status][0]}</span>
                    <p className="mt-0.5 text-[13px] text-muted">بصفتك {d.capacity === 'other' ? d.capacityNote : d.capacityLabel} · <Period d={d} /></p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">{d.scopes.length ? d.scopes.map((s) => <span key={s} className="rounded-md bg-pine-soft px-2 py-0.5 text-[12.5px] text-pine">{scopeLabel(s)}</span>) : <span className="rounded-md bg-stone px-2 py-0.5 text-[12.5px] text-muted">اطلاع فقط</span>}</div>
                  </div>
                  {d.status === 'active' && <button className="btn-gold" disabled={busy === d.id} onClick={() => enter(d)}>{busy === d.id ? '…' : 'الدخول إلى الحساب'}</button>}
                </li>
              ))}
            </ul>
          ) : <p className="py-4 text-center text-[14px] text-muted">لا توجد حسابات فوّضك أصحابها.</p>}
        </div>
      </SectionCard>

      {edit && <DelegationForm current={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onSaved={(d) => { setEdit(null); mine.reload(); toast(d.linked ? 'حُفظ التفويض ووصل إشعار للمفوض' : 'حُفظ التفويض، ويُفعَّل عند تسجيل المفوض في سمّها') }} />}
      <Modal open={!!revoking} onClose={() => setRevoking(null)} title="إلغاء التفويض">
        {revoking && (
          <div className="space-y-4">
            <p className="text-[15px] leading-7">إلغاء تفويض <b>{revoking.fullName}</b>؟ يخرج فورًا من حسابك إن كان داخله، ولا يمكنه الدخول مجددًا.</p>
            <div className="flex gap-2">
              <button className="btn-danger flex-1" onClick={async () => { try { await api.revokeDelegation(revoking.id); toast('أُلغي التفويض'); mine.reload() } catch (e) { toast((e as Error).message, 'bad') } finally { setRevoking(null) } }}>إلغاء التفويض</button>
              <button className="btn-ghost" onClick={() => setRevoking(null)}>رجوع</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
