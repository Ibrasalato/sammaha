import { RULES } from './config'

const nf = new Intl.NumberFormat('ar-SA-u-nu-latn', { maximumFractionDigits: 2 })
export const num = (n: number) => nf.format(n)
export const sar = (n: number) => `${nf.format(n)} ر.س`

const dtf = new Intl.DateTimeFormat('ar-SA-u-nu-latn-ca-gregory', {
  timeZone: RULES.timeZone, day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit',
})
const df = new Intl.DateTimeFormat('ar-SA-u-nu-latn-ca-gregory', { timeZone: RULES.timeZone, day: 'numeric', month: 'long', year: 'numeric' })
const tf = new Intl.DateTimeFormat('ar-SA-u-nu-latn', { timeZone: RULES.timeZone, hour: 'numeric', minute: '2-digit' })

export const dateTime = (s?: string) => (s ? dtf.format(new Date(s)) : '—')
export const date = (s?: string) => (s ? df.format(new Date(s)) : '—')
export const time = (s?: string) => (s ? tf.format(new Date(s)) : '—')

export function remaining(ms: number) {
  if (ms <= 0) return { d: 0, h: 0, m: 0, s: 0, done: true }
  const s = Math.floor(ms / 1000)
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60, done: false }
}

export function remainingText(ms: number) {
  const r = remaining(ms)
  if (r.done) return 'انتهى'
  const pad = (n: number) => String(n).padStart(2, '0')
  if (r.d > 0) return `${r.d} يوم ${pad(r.h)}:${pad(r.m)}`
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
