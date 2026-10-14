import { RULES } from './config'
import { getLang, locale } from './i18n'
import { differsFromRiyadh, userTz } from './region'

const nf = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })
export const num = (n: number) => nf.format(n)
/** the Saudi riyal sign (U+20C1), drawn by the SammhaRiyal font; it sits to the left of the amount in both languages */
export const RIYAL = '\u20C1'
export const sar = (n: number) => (getLang() === 'ar' ? `${nf.format(n)}\u00A0${RIYAL}` : `${RIYAL}\u00A0${nf.format(n)}`)
export const cur = () => RIYAL

/** shown in the viewer's time zone (Settings → Display); Riyadh by default for viewers in Saudi Arabia */
const fmt = (o: Intl.DateTimeFormatOptions, tz = userTz()) => new Intl.DateTimeFormat(locale(), { timeZone: tz, ...o })
export const dateTime = (s?: string) => (s ? fmt({ day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(s)) : '—')
export const date = (s?: string) => (s ? fmt({ day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(s)) : '—')
export const time = (s?: string) => (s ? fmt({ hour: 'numeric', minute: '2-digit' }).format(new Date(s)) : '—')
/** Riyadh time of the same moment, for viewers elsewhere: "الرياض 9:00 م" — '' when the viewer is on Riyadh time */
export const riyadhRef = (s?: string) => {
  if (!s || !differsFromRiyadh(new Date(s))) return ''
  const t = fmt({ hour: 'numeric', minute: '2-digit', ...(new Date(s).toDateString() !== new Date().toDateString() ? { day: 'numeric', month: 'short' } : {}) }, RULES.timeZone).format(new Date(s))
  return getLang() === 'ar' ? `بتوقيت الرياض ${t}` : `Riyadh time ${t}`
}
/** a date-time with the Riyadh reference appended when the viewer is in another zone */
export const dateTimeRef = (s?: string) => { const r = riyadhRef(s); return r ? `${dateTime(s)} (${r})` : dateTime(s) }

export function remaining(ms: number) {
  if (ms <= 0) return { d: 0, h: 0, m: 0, s: 0, done: true }
  const s = Math.floor(ms / 1000)
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60, done: false }
}

export function remainingText(ms: number) {
  const r = remaining(ms)
  const ar = getLang() === 'ar'
  if (r.done) return ar ? 'انتهى' : 'Ended'
  const pad = (n: number) => String(n).padStart(2, '0')
  if (r.d > 0) return ar ? `${r.d} يوم ${pad(r.h)}:${pad(r.m)}` : `${r.d}d ${pad(r.h)}:${pad(r.m)}`
  return `${pad(r.h)}:${pad(r.m)}:${pad(r.s)}`
}

/** datetime-local value (Riyadh time) <-> ISO */
export function toLocalInput(t: number) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: RULES.timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(t))
  const g = (k: string) => parts.find((p) => p.type === k)?.value
  return `${g('year')}-${g('month')}-${g('day')}T${g('hour')}:${g('minute')}`
}
export function fromLocalInput(v: string) {
  // Riyadh is UTC+3 with no DST
  return v ? new Date(`${v}:00+03:00`).toISOString() : ''
}

/** Arabic count of names: اسم واحد، اسمين، 3 أسماء، 11 اسمًا */
export function namesCount(n: number) {
  if (getLang() === 'en') return n === 1 ? '1 name' : `${n} names`
  if (n === 1) return 'اسم واحد'
  if (n === 2) return 'اسمين'
  if (n >= 3 && n <= 10) return `${n} أسماء`
  return `${n} اسمًا`
}

/** "يومان و5 ساعات" / "2 days 5 hrs" — for times more than a day away */
export function humanLeft(ms: number) {
  const r = remaining(ms)
  const ar = getLang() === 'ar'
  if (r.done) return ar ? 'الآن' : 'now'
  if (!ar) return r.d ? `${r.d} day${r.d > 1 ? 's' : ''}${r.h ? ` ${r.h} hr${r.h > 1 ? 's' : ''}` : ''}` : r.h ? `${r.h} hr${r.h !== 1 ? 's' : ''} ${r.m} min` : `${r.m} min`
  const days = r.d === 1 ? 'يوم' : r.d === 2 ? 'يومان' : r.d <= 10 ? `${r.d} أيام` : `${r.d} يومًا`
  const hours = r.h === 1 ? 'ساعة' : r.h === 2 ? 'ساعتان' : r.h <= 10 ? `${r.h} ساعات` : `${r.h} ساعة`
  if (r.d) return r.h ? `${days} و ${hours}` : days
  const mins = r.m === 1 ? 'دقيقة' : r.m === 2 ? 'دقيقتان' : r.m >= 3 && r.m <= 10 ? `${r.m} دقائق` : `${r.m} دقيقة`
  if (!r.h) return r.m ? mins : 'أقل من دقيقة'
  return r.m ? `${hours} و ${mins}` : hours
}
