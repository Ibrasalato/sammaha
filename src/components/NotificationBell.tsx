import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { dateTime } from '../lib/format'
import { api, useLoad } from '../lib/store'
import type { AppNotification } from '../lib/types'

const DOT: Record<AppNotification['kind'], string> = {
  outbid: 'bg-bad', won: 'bg-ok', lost: 'bg-muted', reviewed: 'bg-qaadan', auction_opened: 'bg-gold', refund: 'bg-ok', ticket: 'bg-pine',
}

export function NotificationBell() {
  const nav = useNavigate()
  const { data, reload } = useLoad(() => api.myNotifications(), [], 15000)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const unread = data?.filter((n) => !n.read).length ?? 0

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  async function toggle() {
    const next = !open
    setOpen(next)
    if (next && unread) { await api.markNotificationsRead(); setTimeout(reload, 400) }
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={toggle} aria-expanded={open} aria-label={unread ? `التنبيهات، ${unread} جديدة` : 'التنبيهات'}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-paper/25 text-paper hover:bg-paper/10">
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        {unread > 0 && <span className="num absolute -end-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-bad px-1 text-[11px] font-extrabold text-paper">{unread}</span>}
      </button>
      {open && (
        <div className="absolute end-0 top-11 z-40 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-line bg-paper text-ink shadow-lift">
          <div className="border-b border-line px-4 py-3 text-[15px] font-extrabold">التنبيهات</div>
          {data?.length ? (
            <ul className="max-h-96 overflow-auto">
              {data.map((n) => (
                <li key={n.id}>
                  <button onClick={() => { setOpen(false); if (n.link) nav(n.link) }}
                    className={`flex w-full gap-3 border-b border-line/60 px-4 py-3 text-start hover:bg-stone ${n.read ? '' : 'bg-gold-soft/40'}`}>
                    <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${DOT[n.kind]}`} />
                    <span className="min-w-0">
                      <span className="block text-[14.5px] font-bold">{n.title}</span>
                      <span className="block text-[13.5px] text-muted">{n.body}</span>
                      <span className="mt-0.5 block text-[12px] text-muted/80">{dateTime(n.createdAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="px-4 py-8 text-center text-[14px] text-muted">لا توجد تنبيهات بعد. ستصلك هنا تنبيهات المزايدة والطلبات.</p>}
        </div>
      )}
    </div>
  )
}
