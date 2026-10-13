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

export const TYPE_LABEL: Record<NameType, string> = {
  qaadan: 'قعدان',
  bakkar: 'بكار',
}

export const TYPE_HINT: Record<NameType, string> = {
  qaadan: 'أسماء الذكور من الإبل',
  bakkar: 'أسماء الإناث من الإبل',
}

export const IS_DEMO = !import.meta.env.VITE_SUPABASE_URL
