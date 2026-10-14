import { CITIES, COUNTRIES, DIAL_CODES } from '../lib/countries'
import { tr } from '../lib/i18n'

/** a required-field label with a red asterisk */
export function Req({ htmlFor, children, optional }: { htmlFor: string; children: React.ReactNode; optional?: boolean }) {
  return (
    <label className="label" htmlFor={htmlFor}>
      {children}{optional ? <span className="ms-1 text-xs font-normal text-muted">({tr('اختياري', 'optional')})</span> : <span className="ms-0.5 text-bad" aria-hidden>*</span>}
    </label>
  )
}

export function CountrySelect({ id, value, onChange, required = true, placeholder }: { id: string; value: string; onChange: (v: string) => void; required?: boolean; placeholder?: string }) {
  return (
    <select id={id} className="field" value={value} onChange={(e) => onChange(e.target.value)} required={required}>
      <option value="">{placeholder ?? tr('اختر', 'Choose')}</option>
      {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
    </select>
  )
}

/** a list of cities for Gulf countries, free text for the rest */
export function CityField({ id, country, value, onChange, required = true }: { id: string; country: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  const list = CITIES[country]
  if (!list) return <input id={id} className="field" value={value} onChange={(e) => onChange(e.target.value)} required={required} disabled={!country} placeholder={country ? '' : tr('اختر البلد أولًا', 'Choose the country first')} />
  return (
    <select id={id} className="field" value={value} onChange={(e) => onChange(e.target.value)} required={required}>
      <option value="">{tr('اختر المدينة', 'Choose the city')}</option>
      {list.map((c) => <option key={c} value={c}>{c}</option>)}
      {value && !list.includes(value) && <option value={value}>{value}</option>}
    </select>
  )
}

/** dialling code + number, laid out left-to-right like a phone number */
export function PhoneField({ id, dial, onDial, value, onChange, required = true }: { id: string; dial: string; onDial: (v: string) => void; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <div className="flex gap-2" dir="ltr">
      <select aria-label={tr('كود البلد', 'Country code')} className="field w-[7.5rem] shrink-0" value={dial} onChange={(e) => onDial(e.target.value)} required={required}>
        {DIAL_CODES.map((c) => <option key={c.dial} value={c.dial}>+{c.dial} {c.code}</option>)}
      </select>
      <input id={id} className="field min-w-0 flex-1" inputMode="tel" autoComplete="tel-national" placeholder={dial === '966' ? '05xxxxxxxx' : ''} value={value} onChange={(e) => onChange(e.target.value)} required={required} />
    </div>
  )
}

export function GenderField({ value, onChange }: { value: string; onChange: (v: 'male' | 'female') => void }) {
  return (
    <div className="flex gap-2" role="radiogroup">
      {([['male', 'ذكر', 'Male'], ['female', 'أنثى', 'Female']] as const).map(([k, a, e]) => (
        <label key={k} className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold transition ${value === k ? 'border-pine bg-pine text-paper' : 'border-line bg-paper hover:border-pine/40'}`}>
          <input type="radio" name="gender" className="sr-only" checked={value === k} onChange={() => onChange(k)} required />{tr(a, e)}
        </label>
      ))}
    </div>
  )
}

export function FormSection({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="mb-3 w-full border-b border-line pb-2 text-[15px] font-bold text-pine">{title}{hint && <span className="ms-2 text-xs font-normal text-muted">{hint}</span>}</legend>
      {children}
    </fieldset>
  )
}

/** ISO date 18 years ago, the latest allowed birth date */
export const maxBirthDate = () => { const d = new Date(); d.setFullYear(d.getFullYear() - 18); return d.toISOString().slice(0, 10) }
