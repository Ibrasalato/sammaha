import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { Icon } from './dash'
import type { IconName } from './dash'
import { tr } from '../lib/i18n'

export interface MenuAction {
  key: string
  label: string
  icon?: IconName
  /** a route to open, or a handler */
  to?: string
  onClick?: () => void
  /** shown under the label while disabled (e.g. «قريبًا») */
  disabledNote?: string
  /** a longer reason in the tooltip */
  disabledTitle?: string
  disabled?: boolean
  tone?: 'bad' | 'pine' | 'gold'
  /** a divider before this item */
  separated?: boolean
}

/** «⋯» row menu: a fixed popover (not clipped by scrolling tables), keyboard friendly, closes on outside click/scroll/Escape. */
export function ActionMenu({ items, label = tr('الإجراءات', 'Actions'), children, className = '' }: { items: MenuAction[]; label?: string; children?: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const btn = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!open || !btn.current) return
    const place = () => {
      const r = btn.current!.getBoundingClientRect()
      const m = menu.current
      const w = m?.offsetWidth ?? 256
      const h = m?.offsetHeight ?? 300
      const rtl = document.documentElement.dir === 'rtl'
      // align with the button's end edge (left in Arabic), kept inside the viewport
      let left = rtl ? r.left : r.right - w
      left = Math.max(8, Math.min(left, window.innerWidth - w - 8))
      let top = r.bottom + 6
      if (top + h > window.innerHeight - 8 && r.top - h - 6 > 8) top = r.top - h - 6
      setPos({ top, left })
    }
    place()
    const raf = requestAnimationFrame(place)
    return () => cancelAnimationFrame(raf)
  }, [open])

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    const down = (e: MouseEvent) => { if (!menu.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) close() }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { close(); btn.current?.focus(); return }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      e.preventDefault()
      const list = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? [])]
      const i = list.indexOf(document.activeElement as HTMLElement)
      list[(i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length]?.focus()
    }
    const scroll = (e: Event) => { if (!menu.current?.contains(e.target as Node)) close() }
    document.addEventListener('mousedown', down)
    document.addEventListener('keydown', key)
    window.addEventListener('scroll', scroll, true)
    window.addEventListener('resize', close)
    setTimeout(() => menu.current?.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])')?.focus(), 0)
    return () => {
      document.removeEventListener('mousedown', down)
      document.removeEventListener('keydown', key)
      window.removeEventListener('scroll', scroll, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  const tone = (t?: MenuAction['tone']) => (t === 'bad' ? 'text-bad' : t === 'pine' ? 'text-pine' : t === 'gold' ? 'text-gold-deep' : 'text-ink')
  const cls = 'flex w-full items-start gap-2.5 px-3.5 py-2.5 text-start text-[14.5px] font-semibold outline-none'
  return (
    <>
      <button ref={btn} type="button" aria-haspopup="menu" aria-expanded={open} aria-label={label} title={label} onClick={() => setOpen((v) => !v)}
        className={`inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-paper px-2.5 text-[14px] font-bold text-ink/80 hover:border-pine hover:text-pine ${open ? 'border-pine text-pine' : ''} ${className}`}>
        {children ?? <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>}
      </button>
      {open && createPortal(
        <div ref={menu} role="menu" aria-label={label} style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
          className="fixed z-50 w-64 max-w-[calc(100vw-16px)] overflow-hidden rounded-xl border border-line bg-paper py-1.5 shadow-lift">
          {items.map((a) => {
            const body = (
              <>
                {a.icon && <Icon name={a.icon} className={`mt-0.5 h-[18px] w-[18px] shrink-0 ${a.disabled ? 'text-muted' : tone(a.tone)}`} />}
                <span className="min-w-0 flex-1">
                  <span className="block">{a.label}</span>
                  {a.disabled && a.disabledNote && <span className="mt-0.5 inline-flex items-center gap-1 rounded bg-stone px-1.5 py-px text-[12px] font-bold text-muted"><Icon name="lock" className="h-3 w-3" />{a.disabledNote}</span>}
                </span>
              </>
            )
            const sep = a.separated ? <div key={`${a.key}-sep`} className="my-1.5 border-t border-line" role="separator" /> : null
            if (a.disabled) return [sep, <div key={a.key} role="menuitem" aria-disabled="true" tabIndex={-1} title={a.disabledTitle || a.disabledNote} className={`${cls} cursor-not-allowed text-muted`}>{body}</div>]
            if (a.to) return [sep, <Link key={a.key} role="menuitem" to={a.to} onClick={() => setOpen(false)} className={`${cls} ${tone(a.tone)} hover:bg-stone focus:bg-stone`}>{body}</Link>]
            return [sep, <button key={a.key} type="button" role="menuitem" onClick={() => { setOpen(false); a.onClick?.() }} className={`${cls} ${tone(a.tone)} hover:bg-stone focus:bg-stone`}>{body}</button>]
          })}
        </div>,
        document.body,
      )}
    </>
  )
}
