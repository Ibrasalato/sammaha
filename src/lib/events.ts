import { getLang } from './i18n'
import type { CamelEvent, EventKind } from './types'

export const kindLabel = (k: EventKind) => (getLang() === 'ar' ? EVENT_KIND[k].label : EVENT_KIND[k].en)

export const EVENT_KIND: Record<EventKind, { label: string; en: string; cls: string }> = {
  mazayin: { label: 'مزاين الإبل', en: 'Camel beauty', cls: 'bg-gold-soft text-gold-deep' },
  race: { label: 'سباقات الهجن', en: 'Camel racing', cls: 'bg-info-soft text-info-deep' },
  heritage: { label: 'مهرجان تراثي', en: 'Heritage festival', cls: 'bg-rose-soft text-rose-deep' },
  conference: { label: 'مؤتمر', en: 'Conference', cls: 'bg-pine-soft text-pine' },
  world_day: { label: 'يوم عالمي', en: 'World day', cls: 'bg-[#E2F0E8] text-ok' },
}

/**
 * Seed calendar. Dates marked approx are the expected period based on previous editions
 * and must be confirmed by the committee once officially announced (editable in the admin panel).
 */
export const SEED_EVENTS: CamelEvent[] = [
  {
    id: 'ev-kacf-11', kind: 'mazayin', approx: true,
    title: 'مهرجان الملك عبدالعزيز للإبل', titleEn: 'King Abdulaziz Camel Festival',
    startsOn: '2026-12-01', endsOn: '2027-01-15', city: 'الصياهد، الدهناء', country: 'السعودية',
    description: 'أكبر تجمع ثقافي واقتصادي للإبل في العالم، ويضم مسابقات المزاين بفئات الألوان والطلبية والأشواط، بتنظيم نادي الإبل.',
    url: 'https://camelclub.gov.sa',
    cityEn: 'Al-Sayahid, Al-Dahna', countryEn: 'Saudi Arabia',
    descriptionEn: 'The world\'s largest cultural and economic gathering for camels, with beauty contests by colour category, organised by the Camel Club.',
  },
  {
    id: 'ev-dhafra', kind: 'mazayin', approx: true,
    title: 'مهرجان الظفرة', titleEn: 'Al Dhafra Festival',
    startsOn: '2026-12-15', endsOn: '2027-01-25', city: 'مدينة زايد، الظفرة', country: 'الإمارات',
    description: 'مهرجان تراثي سنوي يضم مزاينة الإبل ومسابقات الحلاب وسباقات الهجن والصناعات التقليدية.',
    cityEn: 'Madinat Zayed, Al Dhafra', countryEn: 'UAE',
    descriptionEn: 'Annual heritage festival with camel beauty contests, milking competitions, races and traditional crafts.',
  },
  {
    id: 'ev-marmoom', kind: 'race', approx: true,
    title: 'مهرجان المرموم التراثي للهجن', titleEn: 'Al Marmoom Heritage Festival',
    startsOn: '2027-03-20', endsOn: '2027-04-05', city: 'ميدان المرموم، دبي', country: 'الإمارات',
    description: 'من أبرز مواسم سباقات الهجن في الخليج، ويختتم موسم السباقات بأشواط الرموز.',
    cityEn: 'Al Marmoom track, Dubai', countryEn: 'UAE',
    descriptionEn: 'One of the Gulf\'s leading camel racing seasons, closing with the flagship races.',
  },
  {
    id: 'ev-camel-day-2027', kind: 'world_day', approx: false,
    title: 'اليوم العالمي للإبل', titleEn: 'World Camel Day',
    startsOn: '2027-06-22', endsOn: '2027-06-22', city: 'حول العالم', country: 'دولي',
    description: 'يوم سنوي للتعريف بمكانة الإبل وقيمتها البيئية والاقتصادية والثقافية.',
    cityEn: 'Worldwide', countryEn: 'International',
    descriptionEn: 'An annual day celebrating the environmental, economic and cultural value of camels.',
  },
  {
    id: 'ev-cpcf', kind: 'race', approx: true,
    title: 'مهرجان ولي العهد للهجن', titleEn: 'Crown Prince Camel Festival',
    startsOn: '2027-08-05', endsOn: '2027-09-05', city: 'ميدان الهجن، الطائف', country: 'السعودية',
    description: 'أكبر مهرجان لسباقات الهجن في المملكة، بأشواط مخصصة للفئات العمرية وجوائز الرموز.',
    cityEn: 'Camel racetrack, Taif', countryEn: 'Saudi Arabia',
    descriptionEn: 'The Kingdom\'s largest camel racing festival, with age-group heats and flagship prizes.',
  },
  {
    id: 'ev-racing-season', kind: 'race', approx: true,
    title: 'موسم سباقات الهجن المحلية', titleEn: 'Local camel racing season',
    startsOn: '2026-10-20', endsOn: '2027-04-30', city: 'ميادين المملكة', country: 'السعودية',
    description: 'سلسلة سباقات الهجن الأسبوعية في ميادين المملكة على مدار الموسم الشتوي.',
    cityEn: 'Racetracks across the Kingdom', countryEn: 'Saudi Arabia',
    descriptionEn: 'Weekly camel races across the Kingdom throughout the winter season.',
  },
]

export const daysUntil = (iso: string, now = Date.now()) => Math.ceil((Date.parse(`${iso}T00:00:00+03:00`) - now) / 86_400_000)

export function eventStatus(e: CamelEvent, now = Date.now()): 'upcoming' | 'ongoing' | 'past' {
  const s = Date.parse(`${e.startsOn}T00:00:00+03:00`)
  const en = Date.parse(`${e.endsOn}T23:59:59+03:00`)
  return now < s ? 'upcoming' : now <= en ? 'ongoing' : 'past'
}
