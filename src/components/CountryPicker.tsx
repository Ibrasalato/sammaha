import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { COUNTRIES } from '../lib/countries'
import { getLang, tr } from '../lib/i18n'
import { Flag } from './Flag'

/** Arabic search folding: hamza forms, ta marbuta, alef maqsura and diacritics don't block a match */
const fold = (s: string) => s.toLowerCase().replace(/[ً-ٰٟ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[^\p{L}\p{N}+]/gu, '')
let en: Intl.DisplayNames | null = null
const englishName = (code: string) => { try { en ??= new Intl.DisplayNames(['en'], { type: 'region' }); return en.of(code) ?? code } catch { return code } }

/**
 * A searchable list of countries with flags. mode="country" picks a country code (nationality, residence, address);
 * mode="dial" picks a dialling code and shows +966 in the button.
 */
export function CountryPicker({ id, value, onChange, mode = 'country', required, placeholder, label }: {
  id?: string; value: string; onChange: (v: string) => void; mode?: 'country' | 'dial'; required?: boolean; placeholder?: string; label?: string
}) {
  const uid = useId()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [hi, setHi] = useState(0)
  // a dialling code can belong to several countries (+1): remember which one was picked for its flag
  const [picked, setPicked] = useState<string | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLUListElement>(null)

  const items = useMemo(() => COUNTRIES.map((c) => ({ ...c, en: c.en || englishName(c.code), key: fold(`${c.name} ${c.en} ${englishName(c.code)} ${c.code} +${c.dial} ${c.dial}`) })), [])
  const shown = useMemo(() => {
    const f = fold(q.trim())
    if (!f) return items
    const digits = f.replace(/\D/g, '')
    return items.filter((c) => c.key.includes(f) || (digits && c.dial.startsWith(digits)))
  }, [items, q])
  const current = mode === 'dial' ? items.find((c) => c.code === picked && c.dial === value) ?? items.find((c) => c.dial === value) : items.find((c) => c.code === value)

  useEffect(() => {
    if (!open) return
    setHi(Math.max(0, shown.findIndex((c) => (mode === 'dial' ? c.dial === value : c.code === value))))
    setTimeout(() => search.current?.focus(), 0)
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setHi(0) }, [q])
  useEffect(() => { list.current?.querySelector<HTMLElement>(`[data-i="${hi}"]`)?.scrollIntoView({ block: 'nearest' }) }, [hi])

  function choose(c: (typeof items)[number]) {
    setPicked(c.code)
    onChange(mode === 'dial' ? c.dial : c.code)
    setOpen(false); setQ('')
  }
  function keys(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(shown.length - 1, h + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(0, h - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (shown[hi]) choose(shown[hi]) }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false) }
  }
  const name = (c: (typeof items)[number]) => (getLang() === 'ar' ? c.name : c.en)

  return (
    <div ref={box} className={`relative ${mode === 'dial' ? 'w-[7.6rem] shrink-0' : ''}`}>
      <button type="button" id={id} aria-haspopup="listbox" aria-expanded={open} aria-controls={`${uid}-list`} aria-label={label}
        className="field flex w-full items-center gap-2 text-start" onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (e.key === 'ArrowDown' || (e.key.length === 1 && /\S/.test(e.key))) { setOpen(true); if (e.key.length === 1) setQ(e.key) } }}>
        {current ? <Flag code={current.code} /> : null}
        <span className={`min-w-0 flex-1 truncate ${current ? '' : 'text-muted'}`} dir={mode === 'dial' ? 'ltr' : undefined}>
          {current ? (mode === 'dial' ? `+${current.dial}` : name(current)) : placeholder ?? tr('اختر', 'Choose')}
        </span>
        <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-muted" aria-hidden><path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>
      </button>
      {/* keeps native "required" validation working */}
      {required && <input tabIndex={-1} aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-0 opacity-0" value={value} onChange={() => {}} required />}
      {open && (
        <div className={`absolute z-40 mt-1 overflow-hidden rounded-xl border border-line bg-paper shadow-lift ${mode === 'dial' ? 'left-0 w-[min(17rem,calc(100vw-2rem))]' : 'inset-x-0'}`} dir="rtl">
          <div className="border-b border-line p-2">
            <input ref={search} className="field py-2 text-[14px]" placeholder={mode === 'dial' ? tr('ابحث بالدولة أو الكود', 'Search country or code') : tr('ابحث عن الدولة', 'Search country')}
              value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={keys} role="combobox" aria-expanded aria-controls={`${uid}-list`}
              aria-activedescendant={shown[hi] ? `${uid}-${shown[hi].code}` : undefined} />
          </div>
          <ul ref={list} id={`${uid}-list`} role="listbox" className="max-h-64 overflow-y-auto py-1">
            {shown.map((c, i) => {
              const sel = mode === 'dial' ? c.dial === value && (!picked || picked === c.code) : c.code === value
              return (
                <li key={c.code} id={`${uid}-${c.code}`} data-i={i} role="option" aria-selected={sel}
                  className={`flex cursor-pointer items-center gap-2.5 px-3 py-2 text-[14.5px] ${i === hi ? 'bg-pine-soft' : ''} ${sel ? 'font-bold text-pine' : ''}`}
                  onMouseEnter={() => setHi(i)} onMouseDown={(e) => { e.preventDefault(); choose(c) }}>
                  <Flag code={c.code} />
                  <span className="min-w-0 flex-1 truncate">{name(c)}</span>
                  {mode === 'dial' && <span className="num text-[13px] text-muted" dir="ltr">+{c.dial}</span>}
                  {sel && <span aria-hidden>✓</span>}
                </li>
              )
            })}
            {!shown.length && <li className="px-3 py-4 text-center text-[14px] text-muted">{tr('لا نتائج', 'No results')}</li>}
          </ul>
        </div>
      )}
    </div>
  )
}
