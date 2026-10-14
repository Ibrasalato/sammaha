import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { SELLER } from '../lib/config'
import { closedMessage } from '../lib/demoSettings'
import type { Intake } from '../lib/demoSettings'
import { useApp } from '../lib/store'
import { Icon } from './dash'

/** message to show when the super admin has closed this service, or null while it is open */
export function useClosed(intake: Intake): string | null {
  const { settings } = useApp()
  return closedMessage(intake, settings)
}

/** Banner on a form whose service is closed: says why and keeps the form from being sent. */
export function ClosedNotice({ intake, className = '' }: { intake: Intake; className?: string }) {
  const msg = useClosed(intake)
  if (!msg) return null
  return (
    <div role="status" className={`flex items-start gap-3 rounded-xl border border-gold/50 bg-gold-soft p-4 text-[15px] leading-7 text-gold-deep ${className}`}>
      <Icon name="lock" className="mt-1 h-5 w-5 shrink-0" />
      <div><b className="block text-ink">الخدمة متوقفة مؤقتًا</b>{msg}</div>
    </div>
  )
}

/** Full-page state for a closed service. */
export function ClosedPage({ intake, title, back = '/dashboard' }: { intake: Intake; title: string; back?: string }) {
  return (
    <>
      <h1 className="mb-5 text-2xl">{title}</h1>
      <ClosedNotice intake={intake} />
      <Link to={back} className="btn-ghost mt-5">رجوع للوحة التحكم</Link>
    </>
  )
}

/** Site-wide banners set by the super admin: maintenance first, then the announcement. */
export function SiteBanner({ dashboard = false }: { dashboard?: boolean }) {
  const { settings: s } = useApp()
  const tones = { info: 'bg-info-soft text-info-deep border-info/20', warn: 'bg-gold-soft text-gold-deep border-gold/40', ok: 'bg-[#E2F0E8] text-ok border-ok/20' }
  return (
    <>
      {s.maintenance && (
        <div role="status" className="border-b border-bad/20 bg-bad/10 text-bad">
          <div className={`${dashboard ? 'px-4 lg:px-6' : 'wrap'} flex items-center gap-2 py-2.5 text-[14.5px] font-bold`}>
            <Icon name="alert" className="h-4 w-4 shrink-0" />
            <span>{s.maintenanceNote || 'المنصة في صيانة قصيرة: التصفح متاح، والطلبات والمزايدة والدفع متوقفة مؤقتًا.'}</span>
          </div>
        </div>
      )}
      {s.announcement && (
        <div role="note" className={`border-b ${tones[s.announcementTone] ?? tones.info}`}>
          <div className={`${dashboard ? 'px-4 lg:px-6' : 'wrap'} flex items-center gap-2 py-2.5 text-[14.5px] font-semibold`}>
            <Icon name="megaphone" className="h-4 w-4 shrink-0" /><span>{s.announcement}</span>
          </div>
        </div>
      )}
    </>
  )
}

/** Accessible on/off switch. */
export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pine disabled:opacity-50 ${checked ? 'bg-ok' : 'bg-ink/25'}`}>
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-paper shadow transition-all ${checked ? 'start-6' : 'start-1'}`} />
    </button>
  )
}

/** One row: title, description and a control on the side. */
export function SettingRow({ title, desc, control, children }: { title: ReactNode; desc?: ReactNode; control: ReactNode; children?: ReactNode }) {
  return (
    <div className="px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0"><div className="font-bold">{title}</div>{desc && <p className="mt-0.5 text-[14px] leading-6 text-muted">{desc}</p>}</div>
        <div className="shrink-0 pt-0.5">{control}</div>
      </div>
      {children}
    </div>
  )
}

/** contact details: the super admin's settings when filled, otherwise the defaults in config */
export function useContact() {
  const { settings: s } = useApp()
  const wa = (s.whatsApp || '').replace(/\D/g, '')
  return {
    email: s.supportEmail || SELLER.email,
    whatsapp: wa ? (wa.startsWith('0') ? `966${wa.slice(1)}` : wa) : SELLER.whatsapp,
    phone: s.supportPhone || '',
  }
}
