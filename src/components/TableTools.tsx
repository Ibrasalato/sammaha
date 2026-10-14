import { tr } from '../lib/i18n'
import { useMemo, useState } from 'react'
import { num } from '../lib/format'

/** Arabic-tolerant search key: ignores diacritics, tatweel, hamza forms, taa marbuta and alef maqsura. */
export function searchKey(s: string) {
  return (s || '').toLowerCase()
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/\s+/g, ' ').trim()
}

export interface FilterDef<T> {
  key: string
  label: string
  /** [value, label]; the first option should be the "all" choice with value '' */
  options: [string, string][]
  test: (row: T, value: string) => boolean
}

/** Search + dropdown filters over rows already in memory. Used by every table in the system. */
export function useTableFilter<T>(rows: T[] | null | undefined, opts: { fields: (row: T) => (string | number | undefined | null)[]; filters?: FilterDef<T>[]; initial?: Record<string, string> }) {
  const [query, setQuery] = useState('')
  const [values, setValues] = useState<Record<string, string>>(opts.initial ?? {})
  const all = rows ?? []
  const list = useMemo(() => {
    const words = searchKey(query).split(' ').filter(Boolean)
    return all.filter((r) => {
      for (const f of opts.filters ?? []) { const v = values[f.key]; if (v && !f.test(r, v)) return false }
      if (!words.length) return true
      const hay = searchKey(opts.fields(r).filter((x) => x !== undefined && x !== null).join(' '))
      return words.every((w) => hay.includes(w))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, query, values])
  const active = !!query.trim() || Object.values(values).some(Boolean)
  return {
    list, total: all.length, query, setQuery, values, active, filters: opts.filters ?? [],
    setValue: (k: string, v: string) => setValues((s) => ({ ...s, [k]: v })),
    reset: () => { setQuery(''); setValues({}) },
  }
}
export type TableFilter<T> = ReturnType<typeof useTableFilter<T>>

export function TableTools<T>({ t, placeholder = tr('بحث', 'Search'), className = '', children }: { t: TableFilter<T>; placeholder?: string; className?: string; children?: React.ReactNode }) {
  return (
    <div className={`mb-4 flex flex-wrap items-center gap-2.5 ${className}`}>
      <div className="relative w-full sm:w-72">
        <svg viewBox="0 0 24 24" className="pointer-events-none absolute start-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
        <input type="search" className="field py-2 ps-10" placeholder={placeholder} value={t.query} onChange={(e) => t.setQuery(e.target.value)} aria-label={placeholder} />
      </div>
      {t.filters.map((f) => (
        <select key={f.key} className={`field w-auto py-2 text-[15px] ${t.values[f.key] ? 'border-pine bg-pine-soft font-bold text-pine' : ''}`} value={t.values[f.key] ?? ''} onChange={(e) => t.setValue(f.key, e.target.value)} aria-label={f.label}>
          {f.options.map(([v, l]) => <option key={v} value={v}>{v ? l : `${f.label}: ${l}`}</option>)}
        </select>
      ))}
      {children}
      <span className="ms-auto text-[13.5px] text-muted" aria-live="polite">
        {t.active ? `${num(t.list.length)} ${tr('من', 'of')} ${num(t.total)}` : `${num(t.total)} ${tr('سجل', 'records')}`}
      </span>
      {t.active && <button type="button" className="text-[13.5px] font-bold text-gold-deep hover:underline" onClick={t.reset}>{tr('مسح التصفية', 'Clear filters')}</button>}
    </div>
  )
}

/** Row shown inside a table body when the filters hide everything. */
export function NoResults({ cols, onReset }: { cols: number; onReset: () => void }) {
  return (
    <tr><td colSpan={cols} className="py-10 text-center text-muted">
      {tr('لا توجد نتائج مطابقة.', 'No matching results.')} <button type="button" className="font-bold text-pine underline" onClick={onReset}>{tr('مسح التصفية', 'Clear filters')}</button>
    </td></tr>
  )
}
