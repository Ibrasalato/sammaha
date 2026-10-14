import { ApiError } from './api'
import { RULES } from './config'
import { tr } from './i18n'
import type { AdminSettings, PublicSettings, SettingsChange, SettingsPatch } from './types'

/** Demo platform settings, kept in this browser (the real ones live in the Sammha API database). */
const KEY = 'sammha-demo-settings'
const LOG = 'sammha-demo-settings-log'

export const DEFAULT_SETTINGS: Omit<AdminSettings, 'rules'> = {
  requestsOpen: true, compoundOpen: true, resaleAuctionOpen: true, instantSaleOpen: true, investmentOpen: true,
  signupOpen: true, supportEmail: '', supportPhone: '', whatsApp: '',
  announcementOn: false, announcement: '', announcementTone: 'info', maintenance: false, maintenanceNote: '',
  passwordMinLength: 8, maxLoginAttempts: 5, lockoutMinutes: 15, staffIdleMinutes: 30,
  depositAmount: RULES.depositAmount, paymentDeadlineHours: 72,
}

export function demoRules(): AdminSettings['rules'] {
  return {
    depositAmount: readSettings().depositAmount, namesPerRequest: RULES.namesPerRequest, openingPrice: RULES.openingPrice, minIncrement: RULES.minIncrement,
    extendMinutes: RULES.extendMinutes, vatRate: RULES.vatRate, investFee: RULES.investFee, investOwnerShare: RULES.investOwnerShare,
    investMaxNames: RULES.investMaxNames, resaleNoticeHours: RULES.resaleNoticeHours, resaleAuctionDays: RULES.resaleAuctionDays,
    resaleCommission: RULES.resaleCommission, resaleBidDeposit: RULES.resaleBidDeposit, instantSaleHours: RULES.instantSaleHours, instantCommission: RULES.instantCommission,
  }
}

export function readSettings(): Omit<AdminSettings, 'rules'> {
  try { return { ...DEFAULT_SETTINGS, ...(JSON.parse(localStorage.getItem(KEY) || '{}') as object) } } catch { return { ...DEFAULT_SETTINGS } }
}

export function publicOf(s: Omit<AdminSettings, 'rules'>): PublicSettings {
  const { announcementOn, maxLoginAttempts: _a, lockoutMinutes: _b, updatedAt: _c, updatedBy: _d, ...rest } = s
  return { ...rest, announcement: announcementOn && s.announcement ? s.announcement : undefined }
}

export function readLog(): SettingsChange[] {
  try { return JSON.parse(localStorage.getItem(LOG) || '[]') as SettingsChange[] } catch { return [] }
}

const show = (v: unknown) => (typeof v === 'boolean' ? (v ? tr('مفعّل', 'On') : tr('متوقف', 'Off')) : v == null ? undefined : String(v))

export function writeSettings(patch: SettingsPatch, by: string): Omit<AdminSettings, 'rules'> {
  const range = (v: number | undefined, min: number, max: number, label: string) => { if (v != null && (v < min || v > max || !Number.isInteger(v))) throw new ApiError(tr(`${label} بين ${min} و${max}`, `${label} must be between ${min} and ${max}`)) }
  range(patch.passwordMinLength, 8, 32, tr('طول كلمة المرور', 'Password length'))
  range(patch.maxLoginAttempts, 3, 20, tr('محاولات الدخول', 'Sign-in attempts'))
  range(patch.lockoutMinutes, 1, 1440, tr('مدة القفل بالدقائق', 'Lockout duration (minutes)'))
  range(patch.staffIdleMinutes, 0, 480, tr('مهلة الخمول بالدقائق', 'Idle timeout (minutes)'))
  range(patch.paymentDeadlineHours, 1, 720, tr('مهلة سداد قيمة الشعار بالساعات', 'Payment deadline (hours)'))
  if (patch.depositAmount != null && !(patch.depositAmount >= 0 && patch.depositAmount <= 1_000_000)) throw new ApiError(tr('مبلغ الضمان بين 0 و1,000,000 ريال', 'The guarantee must be between 0 and 1,000,000 riyals'))
  if (patch.supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patch.supportEmail.trim())) throw new ApiError(tr('بريد الدعم غير صحيح', 'The support email is not valid'))
  const cur = readSettings()
  const log = readLog()
  const next = { ...cur }
  const at = new Date().toISOString()
  for (const [k, raw] of Object.entries(patch) as [keyof typeof cur, unknown][]) {
    if (raw === undefined) continue
    const v = typeof raw === 'string' ? raw.trim() : raw
    if ((cur[k] ?? '') === v) continue
    log.unshift({ id: Date.now() + log.length, at, userName: by, field: k.charAt(0).toUpperCase() + k.slice(1), oldValue: show(cur[k]), newValue: show(v) })
    ;(next as Record<string, unknown>)[k] = v
  }
  next.updatedAt = at
  next.updatedBy = by
  try { localStorage.setItem(KEY, JSON.stringify(next)); localStorage.setItem(LOG, JSON.stringify(log.slice(0, 300))) } catch { /* ignore */ }
  return next
}

export function logAction(field: string, by: string, value?: string) {
  const log = readLog()
  log.unshift({ id: Date.now(), at: new Date().toISOString(), userName: by, field, newValue: value })
  try { localStorage.setItem(LOG, JSON.stringify(log.slice(0, 300))) } catch { /* ignore */ }
}

const LABEL = {
  requests: ['requestsOpen', 'requestsClosedNote', 'استقبال طلبات الشعارات', 'Accepting mark requests'],
  compound: ['compoundOpen', 'compoundClosedNote', 'استقبال طلبات الأسماء المركبة', 'Accepting compound name requests'],
  resale: ['resaleAuctionOpen', 'saleClosedNote', 'عرض الأسماء في مزاد إعادة البيع', 'Listing names in resale auctions'],
  instant: ['instantSaleOpen', 'saleClosedNote', 'البيع الفوري للأسماء', 'Instant sale of names'],
  investment: ['investmentOpen', 'investmentClosedNote', 'استقبال طلبات استثمار الاسم', 'Accepting name investment requests'],
} as const
export type Intake = keyof typeof LABEL

/** the message owners see when an intake is closed (same wording as the API) */
export function closedMessage(intake: Intake, s: PublicSettings): string | null {
  const [flag, noteKey, label, labelEn] = LABEL[intake]
  if (s[flag]) return null
  const note = s[noteKey]
  return note ? tr(`${label} متوقف مؤقتًا: ${note}`, `${labelEn} is temporarily paused: ${note}`) : tr(`${label} متوقف مؤقتًا، تابعنا لمعرفة موعد الفتح`, `${labelEn} is temporarily paused. Follow us to know when it reopens`)
}

export function ensureOpen(intake: Intake) {
  const m = closedMessage(intake, publicOf(readSettings()))
  if (m) throw new ApiError(m)
}

export function ensureWritable(role: string) {
  const s = readSettings()
  if (s.maintenance && role === 'owner') throw new ApiError(s.maintenanceNote || tr('المنصة في صيانة قصيرة، حاول بعد قليل', 'The platform is under brief maintenance. Please try again shortly'))
}

// ───── who handles complaints, reports, enquiries and suggestions (demo) ─────
const ROUTING = 'sammha-demo-ticket-routing'
export interface DemoRouting { restrictToHandlers: boolean; handlers: Record<string, string[]>; emails: Record<string, string> }
export function readRouting(): DemoRouting {
  const blank: DemoRouting = { restrictToHandlers: false, handlers: { complaint: [], report: [], inquiry: [], suggestion: [] }, emails: { complaint: '', report: '', inquiry: '', suggestion: '' } }
  try { const v = JSON.parse(localStorage.getItem(ROUTING) || 'null') as DemoRouting | null; return v ? { ...blank, ...v, handlers: { ...blank.handlers, ...v.handlers }, emails: { ...blank.emails, ...v.emails } } : blank } catch { return blank }
}
export function writeRouting(r: DemoRouting) { try { localStorage.setItem(ROUTING, JSON.stringify(r)) } catch { /* ignore */ } }
