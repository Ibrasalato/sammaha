import { RULES } from './config'
import { getLang } from './i18n'

/** Per-viewer regional preferences: the time zone times are shown in, and a currency for approximate amounts.
 *  Payments, invoices and the registry stay in Saudi riyals; the other currency is a guide only. */
export interface RegionPrefs { tz: string; currency: string }
const KEY = 'sammha-region'
const RATES_KEY = 'sammha-rates'

export const deviceTz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || RULES.timeZone } catch { return RULES.timeZone } }

let prefs: RegionPrefs = (() => {
  try { const p = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<RegionPrefs> | null; return { tz: p?.tz || 'auto', currency: p?.currency || 'SAR' } } catch { return { tz: 'auto', currency: 'SAR' } }
})()

export const getRegion = () => prefs
export function setRegion(p: RegionPrefs) {
  prefs = p
  try { localStorage.setItem(KEY, JSON.stringify(p)) } catch { /* private mode */ }
}
/** the zone times are shown in: the chosen one, or the device's */
export const userTz = () => {
  const tz = prefs.tz === 'auto' ? deviceTz() : prefs.tz
  try { new Intl.DateTimeFormat('en', { timeZone: tz }); return tz } catch { return RULES.timeZone }
}
const offsetMin = (tz: string, at: Date) => {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(at)
  const g = (k: string) => Number(p.find((x) => x.type === k)?.value)
  return (Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute')) - Math.floor(at.getTime() / 60000) * 60000) / 60000
}
/** true when the viewer's zone differs from Riyadh at that moment */
export const differsFromRiyadh = (at = new Date()) => offsetMin(userTz(), at) !== offsetMin(RULES.timeZone, at)
export const tzOffsetLabel = (tz: string) => {
  const m = offsetMin(tz, new Date()); const s = m < 0 ? '−' : '+'; const a = Math.abs(m)
  return `UTC${s}${Math.floor(a / 60)}${a % 60 ? `:${String(a % 60).padStart(2, '0')}` : ''}`
}

/** the viewer's zone in words: "توقيت لندن (UTC+1)" */
export function userTzLabel() {
  const tz = userTz(); const z = TIME_ZONES.find((x) => x.id === tz)
  const name = z ? (getLang() === 'ar' ? z.ar : z.en) : tz
  return getLang() === 'ar' ? `توقيت ${name} (${tzOffsetLabel(tz)})` : `${name} time (${tzOffsetLabel(tz)})`
}

export const TIME_ZONES: { id: string; ar: string; en: string }[] = [
  { id: 'Asia/Riyadh', ar: 'الرياض', en: 'Riyadh' }, { id: 'Asia/Dubai', ar: 'دبي وأبوظبي', en: 'Dubai, Abu Dhabi' },
  { id: 'Asia/Qatar', ar: 'الدوحة', en: 'Doha' }, { id: 'Asia/Kuwait', ar: 'الكويت', en: 'Kuwait' }, { id: 'Asia/Bahrain', ar: 'المنامة', en: 'Manama' },
  { id: 'Asia/Muscat', ar: 'مسقط', en: 'Muscat' }, { id: 'Asia/Amman', ar: 'عمّان', en: 'Amman' }, { id: 'Africa/Cairo', ar: 'القاهرة', en: 'Cairo' },
  { id: 'Africa/Khartoum', ar: 'الخرطوم', en: 'Khartoum' }, { id: 'Africa/Nouakchott', ar: 'نواكشوط', en: 'Nouakchott' }, { id: 'Africa/Casablanca', ar: 'الدار البيضاء', en: 'Casablanca' },
  { id: 'Asia/Baghdad', ar: 'بغداد', en: 'Baghdad' }, { id: 'Asia/Karachi', ar: 'كراتشي', en: 'Karachi' }, { id: 'Asia/Kolkata', ar: 'الهند', en: 'India' },
  { id: 'Europe/Istanbul', ar: 'إسطنبول', en: 'Istanbul' }, { id: 'Europe/London', ar: 'لندن', en: 'London' }, { id: 'Europe/Paris', ar: 'باريس وأوروبا الوسطى', en: 'Paris, Central Europe' },
  { id: 'America/New_York', ar: 'نيويورك', en: 'New York' }, { id: 'America/Los_Angeles', ar: 'لوس أنجلوس', en: 'Los Angeles' }, { id: 'Australia/Sydney', ar: 'سيدني', en: 'Sydney' },
]

// ───── currencies: GCC and Jordan are pegged to the dollar; the rest are refreshed daily when reachable ─────
export const CURRENCIES: { code: string; ar: string; en: string; symbol: string }[] = [
  { code: 'SAR', ar: 'ريال سعودي', en: 'Saudi riyal', symbol: 'SAR' }, { code: 'AED', ar: 'درهم إماراتي', en: 'UAE dirham', symbol: 'AED' },
  { code: 'QAR', ar: 'ريال قطري', en: 'Qatari riyal', symbol: 'QAR' }, { code: 'KWD', ar: 'دينار كويتي', en: 'Kuwaiti dinar', symbol: 'KWD' },
  { code: 'BHD', ar: 'دينار بحريني', en: 'Bahraini dinar', symbol: 'BHD' }, { code: 'OMR', ar: 'ريال عماني', en: 'Omani rial', symbol: 'OMR' },
  { code: 'JOD', ar: 'دينار أردني', en: 'Jordanian dinar', symbol: 'JOD' }, { code: 'EGP', ar: 'جنيه مصري', en: 'Egyptian pound', symbol: 'EGP' },
  { code: 'USD', ar: 'دولار أمريكي', en: 'US dollar', symbol: '$' }, { code: 'EUR', ar: 'يورو', en: 'Euro', symbol: '€' }, { code: 'GBP', ar: 'جنيه إسترليني', en: 'Pound sterling', symbol: '£' },
]
/** units of each currency per 1 SAR */
const PEGGED: Record<string, number> = { SAR: 1, USD: 1 / 3.75, AED: 3.6725 / 3.75, QAR: 3.64 / 3.75, BHD: 0.376 / 3.75, OMR: 0.3845 / 3.75, JOD: 0.709 / 3.75 }
const FALLBACK: Record<string, number> = { KWD: 0.0818, EGP: 13.0, EUR: 0.229, GBP: 0.198 }
let live: { at: number; rates: Record<string, number> } | null = (() => { try { return JSON.parse(localStorage.getItem(RATES_KEY) ?? 'null') } catch { return null } })()

/** refresh floating rates at most twice a day; silent when offline */
export async function refreshRates() {
  if (live && Date.now() - live.at < 12 * 3600_000) return
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/SAR')
    if (!r.ok) return
    const j = await r.json() as { result?: string; rates?: Record<string, number> }
    if (j.result !== 'success' || !j.rates) return
    live = { at: Date.now(), rates: Object.fromEntries(Object.keys(FALLBACK).filter((k) => j.rates![k]).map((k) => [k, j.rates![k]])) }
    localStorage.setItem(RATES_KEY, JSON.stringify(live))
  } catch { /* keep the fallback */ }
}
export const rateOf = (code: string) => PEGGED[code] ?? live?.rates[code] ?? FALLBACK[code]

/** "≈ $533" in the viewer's chosen currency, or '' when that is SAR */
export function approx(sarAmount: number, code = prefs.currency) {
  if (!code || code === 'SAR' || !Number.isFinite(sarAmount)) return ''
  const r = rateOf(code); if (!r) return ''
  const v = sarAmount * r
  const c = CURRENCIES.find((x) => x.code === code)
  const n = new Intl.NumberFormat('en-US', { maximumFractionDigits: v >= 100 ? 0 : v >= 1 ? 2 : 3 }).format(v)
  if (c?.symbol && c.symbol.length === 1) return `≈ ${c.symbol}${n}`
  return getLang() === 'ar' ? `≈ ${n} ${c?.ar ?? code}` : `≈ ${code} ${n}`
}
