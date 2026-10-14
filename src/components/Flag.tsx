import { SA, AE, KW, QA, BH, OM, YE, JO, EG, SD, IQ, SY, LB, PS, LY, TN, DZ, MA, MR, SO, DJ, KM, TR, PK, IN, BD, ID, MY, PH, NG, ET, KE, TD, NE, ML, IR, AF, KZ, MN, CN, GB, US, FR, DE, AU, CA } from 'country-flag-icons/string/3x2'

/** bundled SVG flags (no outside requests); Windows does not draw flag emoji, so images are used */
const SVG: Record<string, string> = { SA, AE, KW, QA, BH, OM, YE, JO, EG, SD, IQ, SY, LB, PS, LY, TN, DZ, MA, MR, SO, DJ, KM, TR, PK, IN, BD, ID, MY, PH, NG, ET, KE, TD, NE, ML, IR, AF, KZ, MN, CN, GB, US, FR, DE, AU, CA }
const cache = new Map<string, string>()

export function Flag({ code, className = 'h-3.5 w-[21px]' }: { code?: string; className?: string }) {
  const svg = code ? SVG[code] : undefined
  if (!svg) return <span className={`${className} inline-block rounded-[2px] bg-stone-deep`} aria-hidden />
  let url = cache.get(code!)
  if (!url) { url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`; cache.set(code!, url) }
  return <img src={url} alt="" aria-hidden className={`${className} inline-block shrink-0 rounded-[2px] object-cover shadow-[0_0_0_1px_rgba(0,0,0,.08)]`} />
}
