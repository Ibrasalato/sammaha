import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Icon, StatTile } from '../../components/dash'
import { Empty, ErrorBox, Loading, Modal, PageHead, Segmented } from '../../components/ui'
import { STAFF_LOGIN_PATH, SUPER_ADMIN_EMAIL } from '../../lib/config'
import { date, num } from '../../lib/format'
import { api, useApp, useLoad } from '../../lib/store'
import type { Role, StaffInput, User } from '../../lib/types'

export const ROLE_LABEL: Record<Role, string> = { owner: 'مالك إبل', committee: 'لجنة الاعتماد', admin: 'مدير النظام' }
const ROLE_TONE: Record<Role, string> = { owner: 'bg-stone-deep text-muted', committee: 'bg-qaadan-soft text-qaadan-deep', admin: 'bg-gold-soft text-gold-deep' }

const ROLE_RIGHTS: [Role, string[]][] = [
  ['admin', ['كل صلاحيات لجنة الاعتماد', 'إضافة الموظفين وتعديل صلاحياتهم', 'إيقاف الحسابات وإعادة تفعيلها']],
  ['committee', ['مراجعة طلبات الشعارات وقبولها أو رفضها', 'فتح المزادات ومتابعتها والفواتير', 'الشكاوى والبلاغات والمواعيد']],
  ['owner', ['طلب الشعارات والمزايدة', 'المحفظة والفواتير والشهادات', 'لا يدخل لوحة اللجنة']],
]

const isSuper = (u: User) => u.email.toLowerCase() === SUPER_ADMIN_EMAIL

function tempPassword() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const a = new Uint32Array(10)
  crypto.getRandomValues(a)
  return [...a].map((n) => abc[n % abc.length]).join('')
}

function AddStaff({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: (u: User, password: string) => void }) {
  const blank = (): StaffInput => ({ fullName: '', phone: '', email: '', password: tempPassword(), role: 'committee' })
  const [f, setF] = useState<StaffInput>(blank)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k: keyof StaffInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })
  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setErr('')
    try { const u = await api.createStaff(f); onDone(u, f.password); setF(blank()) } catch (x) { setErr((x as Error).message) } finally { setBusy(false) }
  }
  return (
    <Modal open={open} onClose={onClose} title="إضافة موظف">
      <form onSubmit={submit} className="space-y-4">
        {err && <ErrorBox text={err} />}
        <div><label className="label" htmlFor="sn">الاسم</label><input id="sn" className="field" value={f.fullName} onChange={set('fullName')} required /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="sph">رقم الجوال</label><input id="sph" className="field" dir="ltr" inputMode="tel" placeholder="05XXXXXXXX" value={f.phone} onChange={set('phone')} required /></div>
          <div><label className="label" htmlFor="sem">البريد الإلكتروني</label><input id="sem" type="email" className="field" dir="ltr" value={f.email} onChange={set('email')} required /></div>
        </div>
        <div>
          <span className="label">الصلاحية</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {(['committee', 'admin'] as const).map((r) => (
              <label key={r} className={`cursor-pointer rounded-lg border-2 p-3 ${f.role === r ? 'border-pine bg-pine-soft' : 'border-line'}`}>
                <input type="radio" name="role" className="sr-only" checked={f.role === r} onChange={() => setF({ ...f, role: r })} />
                <b className="block">{ROLE_LABEL[r]}</b>
                <span className="text-[13px] text-muted">{r === 'committee' ? 'المراجعة والمزادات والفواتير والبلاغات' : 'كل ما سبق مع إدارة الموظفين'}</span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="label" htmlFor="spw">كلمة مرور مؤقتة</label>
          <div className="flex gap-2">
            <input id="spw" className="field num" dir="ltr" value={f.password} onChange={set('password')} minLength={8} required />
            <button type="button" className="btn-ghost btn-sm shrink-0" onClick={() => setF({ ...f, password: tempPassword() })}>توليد</button>
          </div>
          <p className="hint">أرسلها للموظف بنفسك، ويغيّرها من «حسابي» بعد أول دخول.</p>
        </div>
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'جارٍ الإنشاء…' : 'إنشاء الحساب'}</button>
      </form>
    </Modal>
  )
}

export function AdminUsers() {
  const { user: me, toast } = useApp()
  const { data, loading, setData } = useLoad(() => api.listUsers(), [])
  const [tab, setTab] = useState<'staff' | 'owners'>('staff')
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const [created, setCreated] = useState<{ u: User; password: string } | null>(null)
  const [busyId, setBusyId] = useState('')
  const canManage = me?.role === 'admin'
  const all = data ?? []
  const staff = all.filter((u) => u.role !== 'owner')
  const list = useMemo(() => {
    const s = q.trim()
    return (tab === 'staff' ? staff : all.filter((u) => u.role === 'owner'))
      .filter((u) => !s || [u.fullName, u.phone, u.email].some((x) => x.includes(s)))
      .sort((a, b) => Number(isSuper(b)) - Number(isSuper(a)))
  }, [all, staff, tab, q])

  async function change(u: User, p: Promise<User>, msg: string) {
    setBusyId(u.id)
    try { const n = await p; setData(all.map((x) => (x.id === n.id ? n : x))); toast(msg) } catch (e) { toast((e as Error).message) } finally { setBusyId('') }
  }
  const staffUrl = `${location.origin}${location.pathname}#${STAFF_LOGIN_PATH}`

  return (
    <>
      <PageHead title="المستخدمون والصلاحيات" sub={canManage ? 'أضف موظفي لجنة الاعتماد وحدّد صلاحياتهم، وأوقف أي حساب عند الحاجة.' : 'عرض فقط. إدارة الحسابات لمدير النظام.'}
        action={canManage && <button className="btn-primary" onClick={() => setAdding(true)}><Icon name="plus" className="h-4 w-4" />إضافة موظف</button>} />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon="shield" tone="gold" label="مديرو النظام" value={num(all.filter((u) => u.role === 'admin').length)} />
        <StatTile icon="users" tone="blue" label="لجنة الاعتماد" value={num(all.filter((u) => u.role === 'committee').length)} />
        <StatTile icon="tag" tone="pine" label="ملاك الإبل" value={num(all.filter((u) => u.role === 'owner').length)} />
        <StatTile icon="alert" tone="red" label="حسابات موقوفة" value={num(all.filter((u) => u.active === false).length)} />
      </div>

      {canManage && (
        <div className="panel mb-5 flex flex-wrap items-center gap-3 px-5 py-4 text-[14.5px]">
          <Icon name="shield" className="h-5 w-5 text-gold-deep" />
          <span className="flex-1">رابط دخول الموظفين خاص ولا يظهر في الموقع. شاركه مع الموظفين فقط:</span>
          <code className="num rounded bg-stone px-2 py-1 text-[13px]" dir="ltr">{staffUrl}</code>
          <button className="btn-ghost btn-sm" onClick={() => navigator.clipboard?.writeText(staffUrl).then(() => toast('نُسخ الرابط')).catch(() => {})}>نسخ</button>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented value={tab} onChange={setTab} options={[['staff', `الموظفون (${num(staff.length)})`], ['owners', 'ملاك الإبل']]} />
        <input className="field w-full py-2 sm:w-72" placeholder="بحث بالاسم أو الجوال أو البريد" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {loading && !data ? <Loading /> : list.length ? (
        <div className="panel overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>الاسم</th><th>الجوال</th><th>البريد</th><th>الصلاحية</th><th>الحالة</th><th>التسجيل</th></tr></thead>
            <tbody>
              {list.map((u) => {
                const locked = !canManage || isSuper(u) || u.id === me?.id
                return (
                  <tr key={u.id} className={u.active === false ? 'opacity-60' : ''}>
                    <td className="font-semibold">
                      {u.fullName}
                      {isSuper(u) && <span className="pill ms-2 bg-gold text-paper">المدير الرئيسي</span>}
                      {u.id === me?.id && !isSuper(u) && <span className="ms-2 text-[12px] text-muted">(أنت)</span>}
                    </td>
                    <td className="num" dir="ltr" style={{ textAlign: 'right' }}>{u.phone}</td>
                    <td className="text-muted" dir="ltr" style={{ textAlign: 'right' }}>{u.email}</td>
                    <td>
                      {locked ? <span className={`pill ${ROLE_TONE[u.role]}`}>{ROLE_LABEL[u.role]}</span> : (
                        <select className="field w-auto py-1.5 text-[14px]" value={u.role} disabled={busyId === u.id} aria-label={`صلاحية ${u.fullName}`}
                          onChange={(e) => change(u, api.setUserRole(u.id, e.target.value as Role), 'تم تحديث الصلاحية')}>
                          {(['committee', 'admin', 'owner'] as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                        </select>
                      )}
                    </td>
                    <td>
                      {locked ? <span className={`pill ${u.active === false ? 'bg-bad/10 text-bad' : 'bg-[#E2F0E8] text-ok'}`}>{u.active === false ? 'موقوف' : 'نشط'}</span> : (
                        <button className={`btn-sm ${u.active === false ? 'btn-ghost' : 'btn-danger'}`} disabled={busyId === u.id}
                          onClick={() => change(u, api.setUserActive(u.id, u.active === false), u.active === false ? 'أُعيد تفعيل الحساب' : 'أُوقف الحساب')}>
                          {u.active === false ? 'إعادة تفعيل' : 'إيقاف'}
                        </button>
                      )}
                    </td>
                    <td className="whitespace-nowrap text-muted">{date(u.createdAt)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : <Empty title="لا يوجد مستخدمون بهذا البحث" />}

      <section className="mt-8 grid gap-4 lg:grid-cols-3">
        {ROLE_RIGHTS.map(([r, rights]) => (
          <div key={r} className="panel p-5">
            <span className={`pill ${ROLE_TONE[r]}`}>{ROLE_LABEL[r]}</span>
            <ul className="mt-3 space-y-1.5 text-[14.5px]">{rights.map((x) => <li key={x} className="flex gap-2"><span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />{x}</li>)}</ul>
          </div>
        ))}
      </section>

      {canManage && <AddStaff open={adding} onClose={() => setAdding(false)} onDone={(u, password) => { setData([u, ...all]); setAdding(false); setCreated({ u, password }) }} />}
      <Modal open={!!created} onClose={() => setCreated(null)} title="تم إنشاء حساب الموظف">
        {created && (
          <div className="space-y-4">
            <p>أرسل هذه البيانات إلى <b>{created.u.fullName}</b> بطريقة آمنة. كلمة المرور لا تظهر مرة أخرى.</p>
            <dl className="space-y-2 rounded-lg bg-stone p-4 text-[15px]">
              <div className="flex justify-between gap-3"><dt className="text-muted">رابط الدخول</dt><dd className="num break-all" dir="ltr">{staffUrl}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">البريد</dt><dd className="num" dir="ltr">{created.u.email}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">كلمة المرور المؤقتة</dt><dd className="num font-bold" dir="ltr">{created.password}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">الصلاحية</dt><dd>{ROLE_LABEL[created.u.role]}</dd></div>
            </dl>
            <button className="btn-primary w-full" onClick={() => {
              navigator.clipboard?.writeText(`منصة سمّها، دخول الموظفين\n${staffUrl}\nالبريد: ${created.u.email}\nكلمة المرور المؤقتة: ${created.password}`).then(() => toast('نُسخت البيانات')).catch(() => {})
            }}>نسخ البيانات</button>
          </div>
        )}
      </Modal>
    </>
  )
}

export function StaffAccount() {
  const { user, toast } = useApp()
  const [f, setF] = useState({ current: '', next: '', again: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (f.next !== f.again) { setErr('كلمتا المرور غير متطابقتين'); return }
    setBusy(true); setErr('')
    try { await api.changePassword(f.current, f.next); setF({ current: '', next: '', again: '' }); toast('تم تغيير كلمة المرور') } catch (x) { setErr((x as Error).message) } finally { setBusy(false) }
  }
  if (!user) return <Loading />
  return (
    <>
      <PageHead title="حسابي" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="panel divide-y divide-line/70">
          {([['الاسم', user.fullName], ['البريد', user.email], ['الجوال', user.phone], ['الصلاحية', ROLE_LABEL[user.role]]] as [string, string][]).map(([l, v]) => (
            <div key={l} className="flex justify-between gap-3 px-5 py-3.5"><span className="text-muted">{l}</span><b dir="auto">{v}</b></div>
          ))}
        </div>
        <form onSubmit={submit} className="panel space-y-4 p-6">
          <h2 className="text-xl">تغيير كلمة المرور</h2>
          {err && <ErrorBox text={err} />}
          <div><label className="label" htmlFor="pc">كلمة المرور الحالية</label><input id="pc" type="password" className="field" dir="ltr" autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} required /></div>
          <div><label className="label" htmlFor="pn">كلمة المرور الجديدة</label><input id="pn" type="password" className="field" dir="ltr" autoComplete="new-password" minLength={8} value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} required /></div>
          <div><label className="label" htmlFor="pa">تأكيد كلمة المرور</label><input id="pa" type="password" className="field" dir="ltr" autoComplete="new-password" value={f.again} onChange={(e) => setF({ ...f, again: e.target.value })} required /></div>
          <button className="btn-primary" disabled={busy}>حفظ</button>
        </form>
      </div>
    </>
  )
}
