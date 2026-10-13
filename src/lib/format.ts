import { RULES } from './config'
import { getLang, locale } from './i18n'

const nf = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })
export const num = (n: number) => nf.format(n)
export const sar = (n: number) => (getLang() === 'ar' ? `${nf.format(n)} ر.س` : `SAR ${nf.format(n)}`)
export const cur = () => (getLang() === 'ar' ? 'ر.س' : 'SAR')

const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale(), { timeZone: RULES.timeZone, ...o })
export const dateTime = (s?: string) => (s ? fmt({ day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(s)) : '—')
export const date = (s?: string) => (s ? fmt({ day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(s)) : '—')
export const time = (s?: string) => (s ? fmt({ hour: 'numeric', minute: '2-digit' }).format(new Date(s)) : '—')

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
  if (!ar) return r.d ? `${r.d} day${r.d > 1 ? 's' : ''}${r.h ? ` ${r.h} hr${r.h > 1 ? 's' : ''}` : ''}` : `${r.h} hr${r.h !== 1 ? 's' : ''} ${r.m} min`
  const days = r.d === 1 ? 'يوم' : r.d === 2 ? 'يومان' : r.d <= 10 ? `${r.d} أيام` : `${r.d} يومًا`
  const hours = r.h === 1 ? 'ساعة' : r.h === 2 ? 'ساعتان' : r.h <= 10 ? `${r.h} ساعات` : `${r.h} ساعة`
  if (r.d) return r.h ? `${days} و ${hours}` : days
  return `${hours} و ${r.m} دقيقة`
}
