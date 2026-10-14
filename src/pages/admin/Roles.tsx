import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../../components/dash'
import { ErrorBox, Loading, Modal, PageHead } from '../../components/ui'
import { ALL_PERMISSIONS, PERMISSIONS, can, permissionLabel } from '../../lib/permissions'
import type { Permission } from '../../lib/permissions'
import { num } from '../../lib/format'
import { api, useApp, useLoad } from '../../lib/store'
import type { StaffRole } from '../../lib/types'

const GROUPS = [...new Set(PERMISSIONS.map((p) => p.group))]

/** ready-made starting points so the admin rarely ticks boxes one by one */
const PRESETS: { name: string; perms: Permission[] }[] = [
  { name: 'مراجع طلبات', perms: ['overview.view', 'requests.view', 'requests.review'] },
  { name: 'مسؤول مزادات', perms: ['overview.view', 'requests.view', 'auctions.schedule', 'auctions.manage', 'auctions.cancel'] },
  { name: 'خدمة العملاء', perms: ['overview.view', 'tickets.view', 'tickets.reply', 'tickets.manage'] },
  { name: 'المالية', perms: ['overview.view', 'invoices.view', 'invoices.mark_paid'] },
]

function RoleEditor({ role, onClose, onSaved }: { role: StaffRole | 'new'; onClose: () => void; onSaved: (r: StaffRole) => void }) {
  const { user } = useApp()
  const isNew = role === 'new'
  const [name, setName] = useState(isNew ? '' : role.name)
  const [description, setDescription] = useState(isNew ? '' : role.description ?? '')
  const [perms, setPerms] = useState<Set<string>>(new Set(isNew ? ['overview.view'] : role.permissions))
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const grantable = (p: Permission) => can(user, p)
  const toggle = (p: string) => setPerms((s) => { const n = new Set(s); if (n.has(p)) n.delete(p); else n.add(p); return n })
  const toggleGroup = (g: string, on: boolean) => setPerms((s) => {
    const n = new Set(s)
    for (const p of PERMISSIONS) if (p.group === g && grantable(p.key)) { if (on) n.add(p.key); else n.delete(p.key) }
    return n
  })

  async function save() {
    setBusy(true); setErr('')
    try { onSaved(await api.saveRole(isNew ? null : role.id, { name, description, permissions: [...perms] })) } catch (x) { setErr((x as Error).message) } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title={isNew ? 'دور جديد' : `تعديل دور «${role.name}»`}>
      <div className="space-y-5">
        {err && <ErrorBox text={err} />}
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label" htmlFor="rn">اسم الدور</label><input id="rn" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: مسؤول مزادات" maxLength={60} disabled={!isNew && role.isSystem} /></div>
          <div><label className="label" htmlFor="rd">وصف مختصر <span className="text-xs font-normal text-muted">(اختياري)</span></label><input id="rd" className="field" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} /></div>
        </div>
        {isNew && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">ابدأ من قالب:</span>
            {PRESETS.map((p) => <button key={p.name} type="button" className="btn-ghost btn-sm" onClick={() => { setPerms(new Set(p.perms.filter(grantable))); if (!name) setName(p.name) }}>{p.name}</button>)}
          </div>
        )}
        <div className="flex items-center justify-between text-sm">
          <b>الصلاحيات <span className="num text-muted">({num(perms.size)} من {num(ALL_PERMISSIONS.length)})</span></b>
          <span className="flex gap-2">
            <button type="button" className="text-gold-deep underline" onClick={() => setPerms(new Set(ALL_PERMISSIONS.filter(grantable)))}>تحديد الكل</button>
            <button type="button" className="text-muted underline" onClick={() => setPerms(new Set())}>إلغاء الكل</button>
          </span>
        </div>
        <div className="max-h-[52vh] space-y-3 overflow-y-auto pe-1">
          {GROUPS.map((g) => {
            const items = PERMISSIONS.filter((p) => p.group === g)
            const on = items.filter((p) => perms.has(p.key)).length
            return (
              <fieldset key={g} className="rounded-lg border border-line">
                <legend className="sr-only">{g}</legend>
                <label className="flex cursor-pointer items-center gap-2 border-b border-line bg-stone/60 px-4 py-2.5 font-bold">
                  <input type="checkbox" checked={on === items.length} ref={(el) => { if (el) el.indeterminate = on > 0 && on < items.length }} onChange={(e) => toggleGroup(g, e.target.checked)} />
                  {g}<span className="num ms-auto text-xs font-normal text-muted">{num(on)}/{num(items.length)}</span>
                </label>
                <div className="divide-y divide-line/60">
                  {items.map((p) => {
                    const ok = grantable(p.key)
                    return (
                      <label key={p.key} className={`flex items-start gap-3 px-4 py-2.5 ${ok ? 'cursor-pointer hover:bg-stone/40' : 'opacity-50'}`} title={ok ? '' : 'لا يمكنك منح صلاحية لا تملكها'}>
                        <input type="checkbox" className="mt-1" checked={perms.has(p.key)} disabled={!ok} onChange={() => toggle(p.key)} />
                        <span><b className="block text-[14.5px]">{p.label}</b><span className="text-[13px] text-muted">{p.description}</span></span>
                      </label>
                    )
                  })}
                </div>
              </fieldset>
            )
          })}
        </div>
        <div className="flex gap-2">
          <button className="btn-primary flex-1" disabled={busy || !perms.size || name.trim().length < 2} onClick={save}>{busy ? 'جارٍ الحفظ…' : 'حفظ الدور'}</button>
          <button className="btn-ghost" onClick={onClose}>إلغاء</button>
        </div>
      </div>
    </Modal>
  )
}

export function AdminRoles() {
  const { toast } = useApp()
  const { data, loading, setData, error } = useLoad(() => api.listRoles(), [])
  const [editing, setEditing] = useState<StaffRole | 'new' | null>(null)
  const [deleting, setDeleting] = useState<StaffRole | null>(null)
  const roles = useMemo(() => [...(data ?? [])].sort((a, b) => Number(b.isSystem) - Number(a.isSystem) || a.name.localeCompare(b.name, 'ar')), [data])

  async function remove(r: StaffRole) {
    try { await api.deleteRole(r.id); setData((data ?? []).filter((x) => x.id !== r.id)); toast('حُذف الدور') } catch (e) { toast((e as Error).message) } finally { setDeleting(null) }
  }

  return (
    <>
      <PageHead title="الأدوار والصلاحيات" sub="أنشئ دورًا لكل وظيفة وحدّد ما يقدر يعمله، ثم أسند الدور للموظف من صفحة المستخدمين. مدير النظام يملك كل الصلاحيات دائمًا."
        action={<button className="btn-primary" onClick={() => setEditing('new')}><Icon name="plus" className="h-4 w-4" />دور جديد</button>} />
      {error && <ErrorBox text={error} />}
      {loading && !data ? <Loading /> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {roles.map((r) => (
            <article key={r.id} className="panel flex flex-col p-5">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-bold">{r.name}{r.isSystem && <span className="pill ms-2 bg-info-soft text-info-deep">أساسي</span>}</h2>
                  {r.description && <p className="mt-1 text-sm text-muted">{r.description}</p>}
                </div>
                <Link to="/admin/users" className="pill shrink-0 bg-stone text-muted hover:text-ink">{num(r.members)} موظف</Link>
              </div>
              <ul className="mt-4 flex flex-1 flex-wrap content-start gap-1.5">
                {r.permissions.map((p) => <li key={p} className="rounded-md bg-pine-soft px-2 py-1 text-[12.5px] text-pine">{permissionLabel(p)}</li>)}
              </ul>
              <div className="mt-4 flex gap-2 border-t border-line pt-4">
                <button className="btn-ghost btn-sm" onClick={() => setEditing(r)}>تعديل الصلاحيات</button>
                {!r.isSystem && <button className="btn-danger btn-sm" onClick={() => setDeleting(r)}>حذف</button>}
              </div>
            </article>
          ))}
          <article className="panel flex flex-col justify-center border-dashed p-5 text-center">
            <p className="font-bold">مدير النظام</p>
            <p className="mt-1 text-sm text-muted">كل الصلاحيات، ولا يُعدّل. يُضاف من «المستخدمون ← إضافة موظف».</p>
          </article>
        </div>
      )}
      {editing && <RoleEditor role={editing} onClose={() => setEditing(null)} onSaved={(r) => {
        setData(editing === 'new' ? [...(data ?? []), r] : (data ?? []).map((x) => (x.id === r.id ? r : x)))
        setEditing(null); toast('حُفظ الدور')
      }} />}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="حذف الدور">
        {deleting && (
          <div className="space-y-4">
            <p>حذف دور «<b>{deleting.name}</b>»؟ {deleting.members ? `عليه ${num(deleting.members)} موظف؛ انقلهم لدور آخر أولًا.` : ''}</p>
            <div className="flex gap-2"><button className="btn-danger flex-1" onClick={() => remove(deleting)}>حذف</button><button className="btn-ghost" onClick={() => setDeleting(null)}>إلغاء</button></div>
          </div>
        )}
      </Modal>
    </>
  )
}
