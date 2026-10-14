import { useState } from 'react'
import { LangSwitch, tr } from '../lib/i18n'
import type { ReactNode } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { IS_DEMO, SELLER, SLOGAN } from '../lib/config'
import { resetDemo } from '../lib/demoApi'
import { api, useApp } from '../lib/store'
import { Avatar } from './Avatar'
import { NotificationBell } from './NotificationBell'
import { Icon } from './dash'
import { SiteBanner, useContact } from './SettingsUi'
import { useStaffIdle } from './StaffIdle'
import type { IconName } from './dash'

const PUBLIC_NAV = (): [string, string][] => [
  ['/', tr('الرئيسية', 'Home')],
  ['/auctions', tr('المزادات', 'Auctions')],
  ['/events', tr('المواعيد', 'Calendar')],
  ['/names', tr('سجل الأسماء', 'Registry')],
  ['/market', tr('سوق الأسماء', 'Name market')],
  ['/invest', tr('استثمار الاسم', 'Name investment')],
  ['/about', tr('عن المنصة', 'About')],
]

export function Logo({ light, className = 'h-12' }: { light?: boolean; className?: string }) {
  return <img src={light ? './sammha-logo-light.svg' : './sammha-logo.svg'} alt={tr('سمّها لأسماء الإبل الدولية', 'Sammha International Camel Names')} className={`${className} w-auto max-w-none object-contain`} />
}

export function IcoLogo({ light, className = 'h-9' }: { light?: boolean; className?: string }) {
  return <img src={light ? './ico-logo-light.png' : './ico-logo.png'} alt={tr('المنظمة الدولية للإبل', 'International Camel Organization')} className={`${className} w-auto max-w-none object-contain`} />
}

function UtilityBar() {
  const contact = useContact()
  return (
    <div className="bg-pine text-[13px] text-paper/75">
      <div className="wrap flex h-9 items-center gap-4">
        <span className="hidden sm:inline">{tr('منصة تابعة للمنظمة الدولية للإبل', 'A platform of the International Camel Organization')}</span>
        {IS_DEMO && (
          <span className="flex items-center gap-2">
            <span className="rounded bg-gold/20 px-1.5 py-px font-bold text-gold-light">{tr('نسخة تجريبية', 'Demo')}</span>
            <button className="underline underline-offset-2 hover:text-paper" onClick={() => { resetDemo(); location.reload() }}>{tr('إعادة ضبط البيانات', 'Reset data')}</button>
          </span>
        )}
        <span className="ms-auto flex items-center gap-4">
          <LangSwitch className="rounded border border-paper/25 px-2 py-px font-bold text-paper hover:bg-paper hover:text-pine" />
          <a className="hover:text-paper" href={`mailto:${contact.email}`}>{contact.email}</a>
          <a className="hidden hover:text-paper sm:inline" href={`https://wa.me/${contact.whatsapp}`} target="_blank" rel="noreferrer" dir="ltr">{contact.whatsapp.replace(/^966/, '0')}</a>
        </span>
      </div>
    </div>
  )
}

function AuthButtons({ stacked }: { stacked?: boolean }) {
  const { user, setUser } = useApp()
  const nav = useNavigate()
  const cls = stacked ? 'flex flex-col gap-2' : 'flex items-center gap-2'
  if (!user) {
    return (
      <div className={cls}>
        <Link to="/login" className="btn-ghost btn-sm">{tr('تسجيل الدخول', 'Sign in')}</Link>
        <Link to="/signup" className="btn-primary btn-sm">{tr('حساب جديد', 'Create account')}</Link>
      </div>
    )
  }
  const home = user.role === 'owner' ? '/dashboard' : '/admin'
  return (
    <div className={cls}>
      <Link to={home} className="btn-primary btn-sm">{user.role === 'owner' ? tr('لوحة التحكم', 'Dashboard') : tr('لوحة اللجنة', 'Committee panel')}</Link>
      <button className="btn-ghost btn-sm" onClick={async () => { await api.signOut(); setUser(null); nav('/') }}>{tr('خروج', 'Sign out')}</button>
    </div>
  )
}

export function PublicLayout() {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex min-h-screen flex-col bg-stone">
      <UtilityBar />
      <header className="sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur">
        <div className="wrap flex h-[76px] items-center gap-6">
          <Link to="/" aria-label={tr('الرئيسية', 'Home')} className="shrink-0"><Logo className="h-14" /></Link>
          <nav className="hidden h-full items-stretch gap-1 md:flex" aria-label={tr('القائمة الرئيسية', 'Main menu')}>
            {PUBLIC_NAV().map(([to, label]) => (
              <NavLink key={to} to={to} end={to === '/'}
                className={({ isActive }) => `relative flex items-center px-3.5 text-[15.5px] font-bold transition-colors ${isActive ? 'text-pine after:absolute after:inset-x-3.5 after:bottom-0 after:h-[3px] after:rounded-t after:bg-gold' : 'text-muted hover:text-pine'}`}>
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="ms-auto hidden md:block"><AuthButtons /></div>
          <button className="btn-ghost btn-sm ms-auto md:hidden" onClick={() => setOpen(!open)} aria-expanded={open}>{tr('القائمة', 'Menu')}</button>
        </div>
        {open && (
          <div className="border-t border-line bg-paper px-4 py-4 md:hidden" onClick={() => setOpen(false)}>
            <nav className="mb-4 flex flex-col">
              {PUBLIC_NAV().map(([to, label]) => (
                <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `border-b border-line/70 py-3 font-bold ${isActive ? 'text-pine' : 'text-muted'}`}>{label}</NavLink>
              ))}
            </nav>
            <AuthButtons stacked />
          </div>
        )}
      </header>
      <SiteBanner />
      <main className="flex-1"><Outlet /></main>
      <Footer />
    </div>
  )
}

export function Footer() {
  const contact = useContact()
  return (
    <footer className="mt-auto bg-pine text-paper/70">
      <div className="sadu" aria-hidden />
      <div className="wrap grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1.1fr]">
        <div>
          <div className="flex items-center gap-5">
            <Logo light className="h-20" />
            <span className="h-14 w-px bg-paper/20" aria-hidden />
            <IcoLogo light className="h-11" />
          </div>
          <p className="mt-4 text-[17px] font-bold text-gold-light">{tr(SLOGAN.ar, SLOGAN.en)}</p>
          <p className="mt-2 max-w-sm text-[14.5px] leading-7">
            {tr('منصة إلكترونية عالمية تابعة للمنظمة الدولية للإبل، تُعنى بتنظيم أسماء الشعارات لمنقيات وفرديات الإبل، وإقامة مزاداتها وتسجيلها لأصحابها محليًا ودوليًا.', 'A global platform of the International Camel Organization that organises camel names and brand marks, runs their public auctions and registers them to their owners locally and internationally.')}
          </p>
        </div>
        <FooterCol title={tr('المنصة', 'Platform')} links={[['/auctions', tr('المزادات', 'Auctions')], ['/events', tr('مواعيد الإبل', 'Camel calendar')], ['/names', tr('سجل الأسماء', 'Names registry')], ['/verify', tr('التحقق من شهادة', 'Verify a certificate')], ['/about', tr('عن المنصة', 'About')]]} />
        <FooterCol title={tr('المساعدة', 'Help')} links={[['/faq', tr('الأسئلة الشائعة', 'FAQ')], ['/signup', tr('إنشاء حساب', 'Create account')], ['/dashboard/requests/new', tr('طلب اسم شعار', 'Request a name')], ['/invest', tr('استثمار الاسم', 'Name investment')], ['/contact', tr('تواصل معنا', 'Contact us')], ['/contact/track', tr('متابعة شكوى أو بلاغ', 'Track a request')]]} />
        <div>
          <h3 className="text-[15px] font-extrabold text-paper">{tr('تواصل معنا', 'Contact')}</h3>
          <ul className="mt-4 space-y-2.5 text-[14.5px]">
            <li><a className="hover:text-paper" href={`mailto:${contact.email}`}>{contact.email}</a></li>
            <li><a className="hover:text-paper" href={`https://wa.me/${contact.whatsapp}`} target="_blank" rel="noreferrer">{tr('واتساب', 'WhatsApp')} <span dir="ltr">{contact.whatsapp.replace(/^966/, '0')}</span></a></li>
            <li><a className="hover:text-paper" href={SELLER.x} target="_blank" rel="noreferrer">X: @samha_ico</a></li>
          </ul>
          <h3 className="mt-6 text-[13px] font-bold text-paper/60">{tr('وسائل الدفع', 'Payment methods')}</h3>
          <div className="mt-2 flex flex-wrap gap-1.5" aria-label="وسائل الدفع المقبولة">
            {[tr('مدى', 'mada'), 'Visa', 'Mastercard', 'Apple Pay'].map((m) => <span key={m} className="rounded border border-paper/20 bg-paper/5 px-2 py-0.5 text-[12px] font-bold text-paper/85">{m}</span>)}
          </div>
        </div>
      </div>
      <div className="border-t border-paper/10">
        <div className="wrap flex flex-wrap items-center justify-between gap-2 py-5 text-[13px] text-paper/50">
          <span>© {new Date().getFullYear()} {tr('المنظمة الدولية للإبل. جميع الحقوق محفوظة. الرقم الضريبي', 'International Camel Organization. All rights reserved. VAT No.')} <span className="num">{SELLER.vatNumber}</span></span>
          <nav className="flex flex-wrap gap-4" aria-label={tr('روابط قانونية', 'Legal')}>
            <Link to="/terms" className="hover:text-paper">{tr('الشروط والأحكام', 'Terms')}</Link>
            <Link to="/privacy" className="hover:text-paper">{tr('سياسة الخصوصية', 'Privacy')}</Link>
            <Link to="/refund" className="hover:text-paper">{tr('سياسة الاسترداد', 'Refunds')}</Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h3 className="text-[15px] font-extrabold text-paper">{title}</h3>
      <ul className="mt-4 space-y-2.5 text-[14.5px]">
        {links.map(([to, label]) => <li key={label}><Link to={to} className="hover:text-paper">{label}</Link></li>)}
      </ul>
    </div>
  )
}

export interface NavItem { to: string; label: string; icon: IconName; end?: boolean; short?: string }

export function Shell({ nav, title, children }: { nav: NavItem[]; title: string; children?: ReactNode }) {
  const { user, setUser } = useApp()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  useStaffIdle()
  const roleLabel = user?.role === 'owner' ? 'مالك إبل' : user?.role === 'committee' ? 'لجنة الاعتماد' : 'مدير المنصة'
  return (
    <div className="flex min-h-screen flex-col bg-stone">
      <header className="bg-pine text-paper">
        <div className="flex h-16 items-center gap-4 px-4 lg:px-6">
          <button className="rounded-md border border-paper/25 px-2.5 py-1 text-sm font-bold lg:hidden" onClick={() => setOpen(!open)} aria-expanded={open}>القائمة</button>
          <Link to="/" aria-label="الرئيسية"><Logo light className="h-10" /></Link>
          <span className="hidden border-s border-paper/20 ps-4 text-[17px] font-extrabold sm:inline">{title}</span>
          {IS_DEMO && <span className="hidden rounded bg-gold/20 px-1.5 py-px text-[12px] font-bold text-gold-light md:inline">نسخة تجريبية</span>}
          <div className="ms-auto flex items-center gap-3">
            <div className="hidden text-end leading-tight sm:block">
              <div className="text-[14px] font-bold">{user?.fullName}</div>
              <div className="text-[12px] text-paper/60">{user?.acting ? `مفوَّض: ${user.acting.actorName}` : roleLabel}</div>
            </div>
            <NotificationBell />
            {user && (user.role === 'owner'
              ? <Link to="/dashboard/profile" aria-label="حسابي"><Avatar name={user.fullName} src={user.avatarUrl} size={36} /></Link>
              : <Link to="/admin/account" aria-label="حسابي"><Avatar name={user.fullName} src={user.avatarUrl} size={36} /></Link>)}
            <button className="btn-on-dark btn-sm" onClick={async () => { await api.signOut(); setUser(null); navigate('/') }}>خروج</button>
          </div>
        </div>
        <div className="h-[3px] bg-gold" aria-hidden />
      </header>
      <SiteBanner dashboard />
      {user?.acting && (
        <div className="border-b border-gold/40 bg-gold-soft px-4 py-2.5 lg:px-6 print:hidden" role="status">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[14px]">
            <Icon name="users" className="h-[18px] w-[18px] text-gold-deep" />
            <span>أنت <b>{user.acting.actorName}</b> تدير حساب <b>{user.fullName}</b> بالتفويض{user.acting.endsAt ? ` حتى ${new Date(user.acting.endsAt).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn')}` : ''}. كل إجراء يُسجَّل باسمك.</span>
            <button className="btn-primary btn-sm ms-auto" onClick={async () => { try { setUser(await api.stopActing()); navigate('/dashboard/settings?tab=delegation') } catch { setUser(null); navigate('/') } }}>العودة إلى حسابي</button>
          </div>
        </div>
      )}
      <div className="flex flex-1">
        <aside className={`${open ? 'fixed inset-0 z-30 block bg-pine/40' : 'hidden'} lg:static lg:block lg:bg-transparent`} onClick={() => setOpen(false)}>
          <nav className="h-full w-64 shrink-0 border-e border-line bg-paper px-3 py-5" onClick={(e) => e.stopPropagation()} aria-label={title}>
            <p className="mb-2 px-3 text-[12.5px] font-medium text-muted">{title}</p>
            <ul className="flex flex-col gap-0.5">
              {nav.map(({ to, label, end, icon }) => (
                <li key={to}>
                  <NavLink to={to} end={end} onClick={() => setOpen(false)}
                    className={({ isActive }) => `relative flex items-center gap-3 rounded-md px-3 py-2.5 text-[15px] font-medium transition-colors ${isActive ? 'bg-pine text-paper' : 'text-ink/75 hover:bg-stone hover:text-pine'}`}>
                    {({ isActive }) => <><Icon name={icon} className={`h-[18px] w-[18px] ${isActive ? 'text-gold-light' : 'text-muted'}`} />{label}</>}
                  </NavLink>
                </li>
              ))}
            </ul>
            <p className="mb-2 mt-6 px-3 text-[12.5px] font-medium text-muted">المنصة</p>
            <ul className="flex flex-col gap-0.5">
              <li><Link to="/auctions" className="flex items-center gap-3 rounded-md px-3 py-2.5 text-[15px] font-medium text-ink/75 hover:bg-stone hover:text-pine"><Icon name="gavel" className="h-[18px] w-[18px] text-muted" />المزادات المفتوحة</Link></li>
              <li><Link to="/names" className="flex items-center gap-3 rounded-md px-3 py-2.5 text-[15px] font-medium text-ink/75 hover:bg-stone hover:text-pine"><Icon name="tag" className="h-[18px] w-[18px] text-muted" />سجل الأسماء</Link></li>
              <li><Link to="/" className="flex items-center gap-3 rounded-md px-3 py-2.5 text-[15px] font-medium text-ink/75 hover:bg-stone hover:text-pine"><Icon name="home" className="h-[18px] w-[18px] text-muted" />الصفحة الرئيسية</Link></li>
            </ul>
          </nav>
        </aside>
        <main className="min-w-0 flex-1 px-4 pb-28 pt-7 lg:px-8 lg:pb-7">
          <div className="mx-auto max-w-6xl">{children ?? <Outlet />}</div>
        </main>
      </div>
      {/* mobile: the main sections stay one tap away */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden print:hidden" aria-label="التنقل السريع">
        <ul className="grid grid-cols-5">
          {nav.slice(0, 4).map(({ to, label, short, end, icon }) => (
            <li key={to}>
              <NavLink to={to} end={end} className={({ isActive }) => `flex flex-col items-center gap-1 px-1 py-2.5 text-[11.5px] font-bold ${isActive ? 'text-pine' : 'text-muted'}`}>
                {({ isActive }) => <><span className={`grid h-7 w-12 place-items-center rounded-full ${isActive ? 'bg-pine-soft' : ''}`}><Icon name={icon} className="h-5 w-5" /></span><span className="max-w-full truncate">{short ?? label}</span></>}
              </NavLink>
            </li>
          ))}
          <li>
            <button onClick={() => setOpen(true)} className="flex w-full flex-col items-center gap-1 px-1 py-2.5 text-[11.5px] font-bold text-muted">
              <span className="grid h-7 w-12 place-items-center rounded-full"><Icon name="list" className="h-5 w-5" /></span>المزيد
            </button>
          </li>
        </ul>
      </nav>
    </div>
  )
}
