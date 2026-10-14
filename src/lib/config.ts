import { getLang } from './i18n'
import type { NameType } from './types'

/** Business rules — change here, they're mirrored in the API (appsettings.json → Platform). */
export const RULES = {
  /** Auction guarantee paid with every logo request (SAR) */
  depositAmount: 50,
  /** hours an auction winner has to pay (the live value comes from the platform settings) */
  paymentDeadlineHours: 72,
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
  /** «استثمار الاسم»: non-refundable study fee per request (SAR) */
  investFee: 100,
  /** «استثمار الاسم»: the name owner's share of the auction proceeds (the organization keeps the rest) */
  investOwnerShare: 0.3,
  /** «استثمار الاسم»: names allowed in one request */
  investMaxNames: 3,
  /** «بيع اسم»: resale auction — listed 72 h before it opens, runs 3 days, 10% commission */
  resaleNoticeHours: 72,
  resaleAuctionDays: 3,
  resaleCommission: 0.1,
  /** participation guarantee every bidder pays on a resale auction (refunded unless they win) */
  resaleBidDeposit: 50,
  /** «بيع اسم»: fixed-price sale — on the market for 72 h, 15% commission */
  instantSaleHours: 72,
  instantCommission: 0.15,
}

/** the platform's slogan */
export const SLOGAN = { ar: 'لأن الأسماء تصنع المجد', en: 'Because names make glory' }

export const SELLER = {
  name: 'المنظمة الدولية للإبل',
  nameEn: 'International Camel Organization',
  vatNumber: '300000000000003', // TODO: replace with ICO's real VAT registration number
  crNumber: '',
  address: 'الرياض، المملكة العربية السعودية',
  addressEn: 'Riyadh, Saudi Arabia',
  email: 'sammha@ico.org.sa',
  whatsapp: '966541399022',
  x: 'https://x.com/samha_ico',
}

const ar = () => getLang() === 'ar'
export const TYPE_LABEL: Record<NameType, string> = {
  get qaadan() { return ar() ? 'قعدان' : 'Qaadan' },
  get bakkar() { return ar() ? 'بكار' : 'Bakkar' },
  get manqiya() { return ar() ? 'منقية' : 'Manqiya' },
}

export const TYPE_HINT: Record<NameType, string> = {
  get qaadan() { return ar() ? 'فردي: أسماء الذكور من الإبل' : 'Single: names for male camels' },
  get bakkar() { return ar() ? 'فردي: أسماء الإناث من الإبل' : 'Single: names for female camels' },
  get manqiya() { return ar() ? 'اسم لمجموعة إبل (منقية)' : 'A name for a herd (manqiya)' },
}

/** The two families of names: فردي (مفاريد) = qaadan + bakkar, and منقية. */
export const TYPE_GROUPS: { key: 'fardi' | 'manqiya'; types: NameType[]; label: () => string; hint: () => string }[] = [
  { key: 'fardi', types: ['bakkar', 'qaadan'], label: () => (ar() ? 'فردي (مفاريد)' : 'Single (mafareed)'), hint: () => (ar() ? 'اسم لناقة أو جمل بعينه' : 'A name for one camel') },
  { key: 'manqiya', types: ['manqiya'], label: () => (ar() ? 'منقية' : 'Manqiya'), hint: () => (ar() ? 'اسم لمجموعة إبل' : 'A name for a herd') },
]
export const typeGroupOf = (t: NameType) => TYPE_GROUPS.find((g) => g.types.includes(t))!

/** The platform owner's super admin account: cannot be demoted or suspended. */
export const SUPER_ADMIN_EMAIL = 'ibrasalato@gmail.com'
/** Staff sign-in lives on its own unlisted address, not on the public login page. */
export const STAFF_LOGIN_PATH = '/ico-staff'

/** One-time code: fixed until an SMS provider is connected (then it's random and sent by SMS). */
export const OTP = { fixedCode: '4321', length: 4, ttlMinutes: 5, maxAttempts: 5 }

/** Every name category, in display order */
export const NAME_TYPES: NameType[] = ['qaadan', 'bakkar', 'manqiya']
/** Tailwind classes per category: قعدان بنفسجي، بكار أخضر، منقية ذهبي */
export const TYPE_CLS: Record<NameType, { pill: string; dot: string; card: string; text: string }> = {
  qaadan: { pill: 'bg-qaadan-soft text-qaadan-deep', dot: 'bg-qaadan', card: 'border-qaadan bg-qaadan-soft', text: 'text-qaadan-deep' },
  bakkar: { pill: 'bg-bakkar-soft text-bakkar-deep', dot: 'bg-bakkar', card: 'border-bakkar bg-bakkar-soft', text: 'text-bakkar-deep' },
  manqiya: { pill: 'bg-manqiya-soft text-manqiya-deep', dot: 'bg-manqiya', card: 'border-manqiya bg-manqiya-soft', text: 'text-manqiya-deep' },
}
/** Hex values of the category colours, for inline styles (cards, seals, certificates) */
export const TYPE_HEX: Record<NameType, { base: string; deep: string; soft: string }> = {
  qaadan: { base: '#6B4C8F', deep: '#4A2F6B', soft: '#F1ECF7' },
  bakkar: { base: '#1F6B3A', deep: '#134626', soft: '#E6F2EA' },
  manqiya: { base: '#A57A26', deep: '#6E5216', soft: '#F6EEDB' },
}
/** [value, label] options for filters; `all` = the value used for "everything" */
export const typeOptions = <A extends string>(all: A, allLabel: string): [A | NameType, string][] => [[all, allLabel], ...NAME_TYPES.map((t) => [t, TYPE_LABEL[t]] as [NameType, string])]

/** no API address → the in-browser demo backend */
export const IS_DEMO = !import.meta.env.VITE_API_URL
