import { tr } from '../lib/i18n'
import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { countryName } from '../lib/countries'
import { can } from '../lib/permissions'
import { api, useApp } from '../lib/store'
import type { OwnerCrm } from '../lib/types'

/** owners by id, for showing ID, nationality and phone next to an owner's name; empty without «owners.view» */
const Ctx = createContext<Map<string, OwnerCrm>>(new Map())

let cache: { at: number; p: Promise<OwnerCrm[]> } | null = null
function loadOwners() {
  if (!cache || Date.now() - cache.at > 60_000) cache = { at: Date.now(), p: api.listOwners().catch(() => { cache = null; return [] }) }
  return cache.p
}
/** call after an owner's details change, so tables reload them */
export const refreshOwners = () => { cache = null }

export function OwnerDirectory({ children }: { children: ReactNode }) {
  const { user } = useApp()
  const allowed = can(user, 'owners.view')
  const [map, setMap] = useState<Map<string, OwnerCrm>>(new Map())
  useEffect(() => {
    if (!allowed) { setMap(new Map()); return }
    let on = true
    loadOwners().then((l) => { if (on) setMap(new Map(l.map((o) => [o.id, o]))) })
    return () => { on = false }
  }, [allowed])
  return <Ctx.Provider value={map}>{children}</Ctx.Provider>
}

export const useOwner = (id?: string) => {
  const m = useContext(Ctx)
  return id ? m.get(id) : undefined
}
export const useOwners = () => useContext(Ctx)

/** ID, nationality and phone of an owner, for CSV exports */
export function ownerColumns(o?: OwnerCrm): [string, string, string] {
  return [o?.nationalId ?? '', o ? countryName(o.nationality) : '', o?.phone ?? '']
}
const OWNER_COLUMNS_EN = ['ID number', 'Nationality', 'Mobile number']
/** CSV headers for ownerColumns(); read lazily so they follow the current language */
export const OWNER_COLUMNS: string[] = new Proxy(['رقم الهوية', 'الجنسية', 'رقم الجوال'], {
  get(target, key, receiver) {
    const v = Reflect.get(target, key, receiver)
    return typeof key === 'string' && /^\d+$/.test(key) ? tr(v as string, OWNER_COLUMNS_EN[Number(key)]) : v
  },
})

/** an owner's name with their ID, nationality and phone under it */
export function OwnerCell({ id, name, note, hidePhone }: { id?: string; name: string; note?: ReactNode; hidePhone?: boolean }) {
  const o = useOwner(id)
  return (
    <span className="block min-w-[9rem]">
      <span className="font-semibold">{name}</span>
      {note}
      {o && (
        <span className="mt-0.5 block text-[12px] leading-5 text-muted">
          <span className="num" dir="ltr">{o.nationalId || '—'}</span>
          {o.nationality && <> · {countryName(o.nationality)}</>}
          {!hidePhone && <span className="block num" dir="ltr" style={{ textAlign: 'right' }}>{o.phone}</span>}
        </span>
      )}
    </span>
  )
}
