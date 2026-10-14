import { sar } from '../lib/format'
import { useEffect, useState } from 'react'
import { tr } from '../lib/i18n'
import { CURRENCIES, TIME_ZONES, approx, deviceTz, getRegion, refreshRates, setRegion, tzOffsetLabel } from '../lib/region'
import { Modal } from './ui'

/** the price in the viewer's currency, as a small guide under/next to the riyal amount */
export function Approx({ v, className = '' }: { v: number; className?: string }) {
  const [, tick] = useState(0)
  useEffect(() => { if (getRegion().currency !== 'SAR') refreshRates().then(() => tick((x) => x + 1)) }, [])
  const s = approx(v)
  if (!s) return null
  return <span className={`num whitespace-nowrap text-[12px] font-medium opacity-75 ${className}`} title={tr('سعر تقريبي للاسترشاد، والدفع بالريال السعودي', 'Approximate, for guidance; payment is in Saudi riyals')}>{s}</span>
}

/** time zone + currency pickers; saving reloads so every time and amount follows the choice */
export function RegionForm({ onDone }: { onDone?: () => void }) {
  const cur = getRegion()
  const [tz, setTz] = useState(cur.tz)
  const [currency, setCurrency] = useState(cur.currency)
  const dev = deviceTz()
  const zones = TIME_ZONES.some((z) => z.id === dev) ? TIME_ZONES : [{ id: dev, ar: dev, en: dev }, ...TIME_ZONES]
  const changed = tz !== cur.tz || currency !== cur.currency
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="rg-tz" className="mb-1 block font-bold">{tr('المنطقة الزمنية', 'Time zone')}</label>
        <select id="rg-tz" className="field" value={tz} onChange={(e) => setTz(e.target.value)}>
          <option value="auto">{tr(`تلقائي حسب جهازك (${dev}، ${tzOffsetLabel(dev)})`, `Automatic, from your device (${dev}, ${tzOffsetLabel(dev)})`)}</option>
          {zones.map((z) => <option key={z.id} value={z.id}>{tr(z.ar, z.en)} ({tzOffsetLabel(z.id)})</option>)}
        </select>
        <p className="hint">{tr('تظهر مواعيد المزادات والإشعارات بتوقيتك، ومعها توقيت الرياض إن اختلف.', 'Auction times and notifications show in your time, with Riyadh time alongside when it differs.')}</p>
      </div>
      <div>
        <label htmlFor="rg-cur" className="mb-1 block font-bold">{tr('عملة العرض التقريبي', 'Currency for approximate prices')}</label>
        <select id="rg-cur" className="field" value={currency} onChange={(e) => setCurrency(e.target.value)}>
          {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{tr(c.ar, c.en)} ({c.code})</option>)}
        </select>
        <p className="hint">{tr('يظهر المبلغ التقريبي بجانب السعر بالريال للاسترشاد فقط. المزايدة والدفع والفواتير بالريال السعودي.', 'An approximate amount appears next to the riyal price, for guidance only. Bids, payments and invoices are in Saudi riyals.')}</p>
        {currency !== 'SAR' && <p className="mt-1 text-[13px] font-semibold text-pine">{tr('مثال:', 'Example:')} {sar(1000)} {approx(1000, currency)}</p>}
      </div>
      <div className="flex gap-2">
        <button className="btn-primary" disabled={!changed} onClick={() => { setRegion({ tz, currency }); onDone?.(); location.reload() }}>{tr('حفظ', 'Save')}</button>
        {onDone && <button className="btn-ghost" onClick={onDone}>{tr('إلغاء', 'Cancel')}</button>}
      </div>
    </div>
  )
}

/** a compact top-bar button for visitors: "SAR · Riyadh" */
export function RegionButton({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false)
  const r = getRegion()
  const tzName = r.tz === 'auto' ? tr('توقيتك', 'Your time') : (() => { const z = TIME_ZONES.find((x) => x.id === r.tz); return z ? tr(z.ar, z.en) : r.tz })()
  return (
    <>
      <button className={className} onClick={() => setOpen(true)} aria-label={tr('العملة والتوقيت', 'Currency and time zone')}>{r.currency} · {tzName}</button>
      <Modal open={open} onClose={() => setOpen(false)} title={tr('العملة والتوقيت', 'Currency and time zone')}>
        <RegionForm onDone={() => setOpen(false)} />
      </Modal>
    </>
  )
}
