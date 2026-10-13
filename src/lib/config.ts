import { getLang } from './i18n'
import type { NameType } from './types'

/** Business rules — change here, they're mirrored in supabase/migrations (app_settings). */
export const RULES = {
  /** Auction guarantee paid with every logo request (SAR) */
  depositAmount: 50,
  /** Opening price of every name in auction (SAR) */
  openingPrice: 50,
  /** Minimum raise over the current price (SAR) */
  minIncrement: 10,
  /** A bid in the last N minutes extends the auction by N minutes (anti-sniping) */
  extendMinutes: 2,
  /** Names per logo request */
  namesPerRequest: 3,
  /** VAT rate; prices are VAT inclusive */
  vatRate: 0.15,
  timeZone: 'Asia/Riyadh',
}

export const SELLER = {
  name: 'المنظمة الدولية للإبل',
  nameEn: 'International Camel Organization',
  vatNumber: '300000000000003', // TODO: replace with ICO's real VAT registration number
  crNumber: '',
  address: 'الرياض، المملكة العربية السعودية',
  email: 'sammha@ico.org.sa',
  whatsapp: '966541399022',
  x: 'https://x.com/samha_ico',
}

const ar = () => getLang() === 'ar'
export const TYPE_LABEL: Record<NameType, string> = {
  get qaadan() { return ar() ? 'قعدان' : 'Qaadan' },
  get bakkar() { return ar() ? 'بكار' : 'Bakkar' },
  get istithmar() { return ar() ? 'استثمار' : 'Investment' },
}

export const TYPE_HINT: Record<NameType, string> = {
  get qaadan() { return ar() ? 'أسماء الذكور من الإبل' : 'Names for male camels' },
  get bakkar() { return ar() ? 'أسماء الإناث من الإبل' : 'Names for female camels' },
  get istithmar() { return ar() ? 'أسماء مخصصة للاستثمار' : 'Names held as an investment' },
}

/** The platform owner's super admin account: cannot be demoted or suspended. */
export const SUPER_ADMIN_EMAIL = 'ibrasalato@gmail.com'
/** Staff sign-in lives on its own unlisted address, not on the public login page. */
export const STAFF_LOGIN_PATH = '/ico-staff'

/** One-time code: fixed until an SMS provider is connected (then it's random and sent by SMS). */
export const OTP = { fixedCode: '4321', length: 4, ttlMinutes: 5, maxAttempts: 5 }

/** Every name category, in display order */
export const NAME_TYPES: NameType[] = ['qaadan', 'bakkar', 'istithmar']
/** Tailwind classes per category (standard designs: blue, maroon, purple) */
export const TYPE_CLS: Record<NameType, { pill: string; dot: string; card: string; text: string }> = {
  qaadan: { pill: 'bg-qaadan-soft text-qaadan-deep', dot: 'bg-qaadan', card: 'border-qaadan bg-qaadan-soft', text: 'text-qaadan-deep' },
  bakkar: { pill: 'bg-bakkar-soft text-bakkar-deep', dot: 'bg-bakkar', card: 'border-bakkar bg-bakkar-soft', text: 'text-bakkar-deep' },
  istithmar: { pill: 'bg-istithmar-soft text-istithmar-deep', dot: 'bg-istithmar', card: 'border-istithmar bg-istithmar-soft', text: 'text-istithmar-deep' },
}
/** [value, label] options for filters; `all` = the value used for "everything" */
export const typeOptions = <A extends string>(all: A, allLabel: string): [A | NameType, string][] => [[all, allLabel], ...NAME_TYPES.map((t) => [t, TYPE_LABEL[t]] as [NameType, string])]

export const IS_DEMO = !import.meta.env.VITE_SUPABASE_URL
