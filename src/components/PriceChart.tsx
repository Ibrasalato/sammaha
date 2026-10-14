import { useMemo, useState } from 'react'
import { date, num, time } from '../lib/format'
import { tr } from '../lib/i18n'
import type { Auction, Bid } from '../lib/types'

/** Step chart of the price over time: opening price, then every bid. */
export function PriceChart({ a, bids }: { a: Auction; bids: Bid[] }) {
  const W = 640, H = 200, P = { l: 14, r: 56, t: 16, b: 26 }
  const [hover, setHover] = useState<number | null>(null)
  const pts = useMemo(() => {
    const list = [...bids].sort((x, y) => Date.parse(x.createdAt) - Date.parse(y.createdAt) || x.amount - y.amount)
    return [{ t: Date.parse(a.startsAt), v: a.openingPrice, label: tr('السعر الافتتاحي', 'Opening'), auto: false }, ...list.map((b) => ({ t: Date.parse(b.createdAt), v: b.amount, label: b.bidderLabel, auto: !!b.auto }))]
  }, [a.startsAt, a.openingPrice, bids])

  if (pts.length < 2) {
    return <div className="grid h-[200px] place-items-center rounded-lg bg-stone text-[14px] text-muted">{tr('يظهر هنا تطور السعر مع أول مزايدة', 'The price history appears with the first bid')}</div>
  }
  const t0 = pts[0].t, t1 = Math.max(pts[pts.length - 1].t, Math.min(Date.now(), Date.parse(a.endsAt)))
  const vMax = Math.max(...pts.map((p) => p.v)), vMin = pts[0].v
  const x = (t: number) => P.l + ((t - t0) / Math.max(1, t1 - t0)) * (W - P.l - P.r)
  const y = (v: number) => H - P.b - ((v - vMin) / Math.max(1, vMax - vMin)) * (H - P.t - P.b)
  let d = `M${x(pts[0].t)},${y(pts[0].v)}`
  for (let i = 1; i < pts.length; i++) d += ` H${x(pts[i].t)} V${y(pts[i].v)}`
  d += ` H${x(t1)}`
  const area = `${d} V${H - P.b} H${x(pts[0].t)} Z`
  const h = hover !== null ? pts[hover] : null
  const ticks = [vMin, Math.round((vMin + vMax) / 2), vMax]
  // short spans show the hour, longer ones the day
  const stamp = (t: number) => (t1 - t0 > 20 * 3600_000 ? date(new Date(t).toISOString()).replace(/\s*\d{4}$/, '') : time(new Date(t).toISOString()))

  return (
    <div className="relative" dir="ltr">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={tr(`تطور السعر من ${num(vMin)} إلى ${num(vMax)} ريال`, `Price rose from ${num(vMin)} to ${num(vMax)} SAR`)}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
          const px = ((e.clientX - r.left) / r.width) * W
          let best = 0
          pts.forEach((p, i) => { if (Math.abs(x(p.t) - px) < Math.abs(x(pts[best].t) - px)) best = i })
          setHover(best)
        }}>
        <defs>
          <linearGradient id="pc-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#C99532" stopOpacity=".28" /><stop offset="1" stopColor="#C99532" stopOpacity="0" /></linearGradient>
        </defs>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} stroke="#E3E6E4" strokeDasharray="3 4" />
            <text x={W - P.r + 8} y={y(v) + 4} fontSize="12" fill="#6B7280" fontFamily="Tajawal">{num(v)}</text>
          </g>
        ))}
        <path d={area} fill="url(#pc-fill)" />
        <path d={d} fill="none" stroke="#C99532" strokeWidth="2.5" strokeLinejoin="round" />
        {pts.map((p, i) => <circle key={i} cx={x(p.t)} cy={y(p.v)} r={hover === i ? 5.5 : 3} fill={p.auto ? '#fff' : '#C99532'} stroke="#C99532" strokeWidth="2" />)}
        <text x={P.l} y={H - 6} fontSize="12" fill="#6B7280" fontFamily="Tajawal">{stamp(t0)}</text>
        <text x={W - P.r} y={H - 6} fontSize="12" fill="#6B7280" fontFamily="Tajawal" textAnchor="end">{stamp(t1)}</text>
      </svg>
      {h && (
        <div className="pointer-events-none absolute top-0 rounded-md border border-line bg-paper px-2.5 py-1.5 text-[12.5px] shadow-card" dir="rtl"
          style={{ left: `${(x(h.t) / W) * 100}%`, transform: 'translateX(-50%)' }}>
          <b className="num">{num(h.v)}</b> · {h.label}{h.auto ? ` · ${tr('تلقائية', 'auto')}` : ''}
        </div>
      )}
    </div>
  )
}
