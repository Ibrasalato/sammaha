import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { DEFAULT_FOLLOW, liveAvailable, liveSupported, setFollow, useFollow } from '../lib/follow'
import type { FollowPrefs } from '../lib/follow'
import { tr } from '../lib/i18n'
import { useApp } from '../lib/store'
import type { Auction } from '../lib/types'
import { Sheet } from './AppChrome'

export function BellIcon({ on, className = 'h-5 w-5' }: { on?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 003.4 0" />
      {on && <><path d="M19.5 2.5a8 8 0 012 4.5" fill="none" /><path d="M4.5 2.5a8 8 0 00-2 4.5" fill="none" /></>}
    </svg>
  )
}

const ROWS = (): [keyof FollowPrefs, string, string, string][] => [
  ['outbid', tr('تنبيه فوري عند تجاوز مزايدتك', 'Instant alert when you are outbid'), tr('نخبرك لحظة ما يزايد أحد فوقك.', 'The moment someone bids above you.'), 'M3 17l6-6 4 4 8-8M14 7h7v7'],
  ['ending', tr('تنبيه باقتراب انتهاء المزاد', 'Alert before the auction closes'), tr('قبل 10 دقائق من النهاية.', '10 minutes before it ends.'), 'M12 7v5l3 2M12 21a9 9 0 100-18 9 9 0 000 18z'],
  ['result', tr('إشعار بنتيجة المزاد', 'Auction result'), tr('فوز أو عدم فوز، فور انتهاء المزاد.', 'Won or not, as soon as it ends.'), 'M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4zM17 5h3v2a3 3 0 01-3 3M7 5H4v2a3 3 0 003 3'],
  ['live', tr('متابعة مباشرة على شاشة القفل', 'Live on the lock screen'), tr('السعر والوقت المتبقي على شاشة القفل وفي Dynamic Island.', 'Price and time left on the lock screen and Dynamic Island.'), 'M8 2h8a2 2 0 012 2v16a2 2 0 01-2 2H8a2 2 0 01-2-2V4a2 2 0 012-2zM11 18h2'],
]

function Toggle({ on }: { on: boolean }) {
  return <span className={`relative inline-block h-7 w-12 shrink-0 rounded-full transition ${on ? 'bg-pine' : 'bg-line'}`}><span className={`absolute top-0.5 h-6 w-6 rounded-full bg-paper shadow transition-all ${on ? 'start-[22px]' : 'start-0.5'}`} /></span>
}

/** «متابعة المزاد»: pick the alerts, save, or stop following */
export function FollowSheet({ a, open, onClose, myBid }: { a: Auction; open: boolean; onClose: () => void; myBid?: number }) {
  const { toast } = useApp()
  const cur = useFollow(a.id)
  const [p, setP] = useState<FollowPrefs>(cur ?? DEFAULT_FOLLOW)
  const [liveOk, setLiveOk] = useState(liveSupported())
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (open) { setP(cur ? { outbid: cur.outbid, ending: cur.ending, result: cur.result, live: cur.live } : { ...DEFAULT_FOLLOW, live: liveSupported() }); void liveAvailable().then(setLiveOk) } }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const rows = ROWS().filter(([k]) => k !== 'live' || liveSupported())
  async function save(prefs: FollowPrefs | null) {
    setBusy(true)
    try {
      const r = await setFollow(a, prefs, myBid)
      if (!prefs) toast(tr('أُلغيت متابعة المزاد', 'Stopped following'))
      else if (prefs.live && !r.live) toast(tr('فُعّلت المتابعة. المتابعة على شاشة القفل غير متاحة: فعّل «الأنشطة المباشرة» لسمّها من الإعدادات.', 'Following on. Live Activities are off for Sammha in Settings.'), 'bad')
      else toast(tr(`تتابع الآن مزاد «${a.name}»`, `Now following «${a.name}»`))
      onClose()
    } finally { setBusy(false) }
  }
  return (
    <Sheet open={open} onClose={onClose} title={tr('متابعة المزاد', 'Follow this auction')}>
      <p className="-mt-1 mb-3 text-[13.5px] leading-6 text-muted">{tr(`اختر التنبيهات التي تصلك عن مزاد «${a.name}».`, `Choose the alerts you get for «${a.name}».`)}</p>
      <ul className="app-list mb-3">
        {rows.map(([k, title, hint, d]) => {
          const disabled = k === 'live' && !liveOk
          return (
            <li key={k}>
              <button type="button" disabled={disabled} onClick={() => setP({ ...p, [k]: !p[k] })} aria-pressed={p[k]} className={`flex w-full items-center gap-3 px-4 py-3 text-start ${disabled ? 'opacity-50' : ''}`}>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-pine-soft text-pine"><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg></span>
                <span className="min-w-0 flex-1"><b className="block text-[14.5px]">{title}</b><span className="block text-[12.5px] text-muted">{disabled ? tr('فعّل «الأنشطة المباشرة» لسمّها من إعدادات الجوال.', 'Turn on Live Activities for Sammha in Settings.') : hint}</span></span>
                <Toggle on={p[k] && !disabled} />
              </button>
            </li>
          )
        })}
      </ul>
      <button className="btn-primary w-full" disabled={busy || !Object.values(p).some(Boolean)} onClick={() => save({ ...p, live: p.live && liveOk })}>{cur ? tr('حفظ التنبيهات', 'Save alerts') : tr('تفعيل المتابعة', 'Start following')}</button>
      {cur && <button className="mt-2 w-full py-2.5 text-[14.5px] font-bold text-bad" disabled={busy} onClick={() => save(null)}>{tr('إلغاء المتابعة', 'Stop following')}</button>}
    </Sheet>
  )
}

/** the bell on an auction card / page: filled green while following */
export function FollowBell({ a, myBid, size = 'md', tone = 'box' }: { a: Auction; myBid?: number; size?: 'md' | 'lg'; tone?: 'box' | 'gold' }) {
  const { user } = useApp()
  const cur = useFollow(a.id)
  const [open, setOpen] = useState(false)
  if (user?.role !== 'owner') return null
  const box = size === 'lg' ? 'h-11 w-11' : 'h-9 w-9'
  return (
    <>
      <button type="button" aria-pressed={!!cur} aria-label={cur ? tr('أنت تتابع هذا المزاد', 'Following') : tr('تابع المزاد بالتنبيهات', 'Follow with alerts')}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true) }}
        className={`grid ${tone === 'gold' ? 'h-8 w-8' : box} shrink-0 place-items-center rounded-xl transition ${cur ? (tone === 'gold' ? 'text-[#F2A900]' : 'bg-pine-soft text-pine ring-1 ring-pine/25') : 'text-ink/70'}`}>
        <BellIcon on={!!cur} className={size === 'lg' ? 'h-6 w-6' : 'h-5 w-5'} />
      </button>
      {open && createPortal(<span onClick={(e) => { e.stopPropagation() }}><FollowSheet a={a} open onClose={() => setOpen(false)} myBid={myBid} /></span>, document.body)}
    </>
  )
}
