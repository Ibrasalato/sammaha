import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { IS_DEMO, SELLER } from '../lib/config'
import { resetDemo } from '../lib/demoApi'
import { api, useApp } from '../lib/store'

const PUBLIC_NAV: [string, string][] = [
  ['/', 'الرئيسية'],
  ['/auctions', 'المزادات'],
  ['/names', 'سجل الأسماء'],
  ['/about', 'عن المنصة'],
]

export function Logo({ light, className = 'h-12' }: { light?: boolean; className?: string }) {
  return <img src={light ? './sammha-logo-light.png' : './sammha-logo.png'} alt="سمّها لأسماء الإبل الدولية" className={`${className} w-auto`} />
}

function UtilityBar() {
  return (
    <div className="bg-navy text-[13px] text-paper/75">
      <div className="wrap flex h-9 items-center gap-4">
        <span className="hidden sm:inline">منصة تابعة للمنظمة الدولية للإبل</span>
        {IS_DEMO && (
          <span className="flex items-center gap-2">
            <span className="rounded bg-gold/20 px-1.5 py-px font-bold text-gold-light">نسخة تجريبية</span>
            <button className="underline underline-offset-2 hover:text-paper" onClick={() => { resetDemo(); location.reload() }}>إعادة ضبط البيانات</button>
          </span>
        )}
        <span className="ms-auto flex items-center gap-4">
          <a className="hover:text-paper" href={`mailto:${SELLER.email}`}>{SELLER.email}</a>
          <a className="hidden hover:text-paper sm:inline" href={`https://wa.me/${SELLER.whatsapp}`} target="_blank" rel="noreferrer" dir="ltr">{SELLER.whatsapp.replace(/^966/, '0')}</a>
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
        <Link to="/login" className="btn-ghost btn-sm">تسجيل الدخول</Link>
        <Link to="/signup" className="btn-primary btn-sm">حساب جديد</Link>
      </div>
    )
  }
  const home = user.role === 'owner' ? '/dashboard' : '/admin'
  return (
    <div className={cls}>
      <Link to={home} className="btn-primary btn-sm">{user.role === 'owner' ? 'لوحة التحكم' : 'لوحة اللجنة'}</Link>
      <button className="btn-ghost btn-sm" onClick={async () => { await api.signOut(); setUser(null); nav('/') }}>خروج</button>
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
          <Link to="/" aria-label="الرئيسية" className="shrink-0"><Logo className="h-14" /></Link>
          <nav className="hidden h-full items-stretch gap-1 md:flex" aria-label="القائمة الرئيسية">
            {PUBLIC_NAV.map(([to, label]) => (
              <NavLink key={to} to={to} end={to === '/'}
                className={({ isActive }) => `relative flex items-center px-3.5 text-[15.5px] font-bold transition-colors ${isActive ? 'text-navy after:absolute after:inset-x-3.5 after:bottom-0 after:h-[3px] after:rounded-t after:bg-gold' : 'text-muted hover:text-navy'}`}>
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="ms-auto hidden md:block"><AuthButtons /></div>
          <button className="btn-ghost btn-sm ms-auto md:hidden" onClick={() => setOpen(!open)} aria-expanded={open}>القائمة</button>
        </div>
        {open && (
          <div className="border-t border-line bg-paper px-4 py-4 md:hidden" onClick={() => setOpen(false)}>
            <nav className="mb-4 flex flex-col">
              {PUBLIC_NAV.map(([to, label]) => (
                <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `border-b border-line/70 py-3 font-bold ${isActive ? 'text-navy' : 'text-muted'}`}>{label}</NavLink>
              ))}
            </nav>
            <AuthButtons stacked />
          </div>
        )}
      </header>
      <main className="flex-1"><Outlet /></main>
      <Footer />
    </div>
  )
}

export function Footer() {
  return (
    <footer className="mt-auto bg-navy text-paper/70">
      <div className="sadu" aria-hidden />
      <div className="wrap grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo light className="h-20" />
          <p className="mt-5 max-w-sm text-[14.5px] leading-7">
            منصة إلكترونية عالمية تابعة للمنظمة الدولية للإبل، تُعنى بتنظيم أسماء الشعارات لمنقيات وفرديات الإبل، وإقامة مزاداتها وتسجيلها لأصحابها محليًا ودوليًا.
          </p>
        </div>
        <FooterCol title="المنصة" links={[['/auctions', 'المزادات'], ['/names', 'سجل الأسماء'], ['/about', 'عن المنصة']]} />
        <FooterCol title="للملاك" links={[['/signup', 'إنشاء حساب'], ['/dashboard/requests/new', 'طلب اسم شعار'], ['/about', 'شروط المزاد وضوابط الربط']]} />
        <div>
          <h3 className="text-[15px] font-extrabold text-paper">تواصل معنا</h3>
          <ul className="mt-4 space-y-2.5 text-[14.5px]">
            <li><a className="hover:text-paper" href={`mailto:${SELLER.email}`}>{SELLER.email}</a></li>
            <li><a className="hover:text-paper" href={`https://wa.me/${SELLER.whatsapp}`} target="_blank" rel="noreferrer">واتساب <span dir="ltr">{SELLER.whatsapp.replace(/^966/, '0')}</span></a></li>
            <li><a className="hover:text-paper" href={SELLER.x} target="_blank" rel="noreferrer">منصة X: samha_ico@</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-paper/10">
        <div className="wrap flex flex-wrap items-center justify-between gap-2 py-5 text-[13px] text-paper/50">
          <span>© {new Date().getFullYear()} المنظمة الدولية للإبل. جميع الحقوق محفوظة.</span>
          <span>الرياض، المملكة العربية السعودية</span>
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

export function Shell({ nav, title, children }: { nav: [string, string, boolean?][]; title: string; children?: ReactNode }) {
  const { user, setUser } = useApp()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const roleLabel = user?.role === 'owner' ? 'مالك إبل' : user?.role === 'committee' ? 'لجنة الاعتماد' : 'مدير المنصة'
  return (
    <div className="flex min-h-screen flex-col bg-stone">
      <header className="bg-navy text-paper">
        <div className="flex h-16 items-center gap-4 px-4 lg:px-6">
          <button className="rounded-md border border-paper/25 px-2.5 py-1 text-sm font-bold lg:hidden" onClick={() => setOpen(!open)} aria-expanded={open}>القائمة</button>
          <Link to="/" aria-label="الرئيسية"><Logo light className="h-10" /></Link>
          <span className="hidden border-s border-paper/20 ps-4 text-[17px] font-extrabold sm:inline">{title}</span>
          {IS_DEMO && <span className="hidden rounded bg-gold/20 px-1.5 py-px text-[12px] font-bold text-gold-light md:inline">نسخة تجريبية</span>}
          <div className="ms-auto flex items-center gap-3">
            <div className="hidden text-end leading-tight sm:block">
              <div className="text-[14px] font-bold">{user?.fullName}</div>
              <div className="text-[12px] text-paper/60">{roleLabel}</div>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gold text-[15px] font-extrabold text-paper">{user?.fullName.trim()[0]}</span>
            <button className="btn-on-dark btn-sm" onClick={async () => { await api.signOut(); setUser(null); navigate('/') }}>خروج</button>
          </div>
        </div>
        <div className="sadu sadu-thin" aria-hidden />
      </header>
      <div className="flex flex-1">
        <aside className={`${open ? 'fixed inset-0 z-30 block bg-navy/40' : 'hidden'} lg:static lg:block lg:bg-transparent`} onClick={() => setOpen(false)}>
          <nav className="h-full w-64 shrink-0 border-e border-line bg-paper px-3 py-5" onClick={(e) => e.stopPropagation()} aria-label={title}>
            <p className="mb-2 px-3 text-[12.5px] font-bold text-muted">{title}</p>
            <ul className="flex flex-col gap-0.5">
              {nav.map(([to, label, end]) => (
                <li key={to}>
                  <NavLink to={to} end={end} onClick={() => setOpen(false)}
                    className={({ isActive }) => `relative block rounded-md px-3 py-2.5 text-[15px] font-bold transition-colors ${isActive ? 'bg-navy-soft text-navy before:absolute before:inset-y-2 before:start-0 before:w-[3px] before:rounded-full before:bg-gold' : 'text-muted hover:bg-stone hover:text-navy'}`}>
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
            <p className="mb-2 mt-6 px-3 text-[12.5px] font-bold text-muted">المنصة</p>
            <ul className="flex flex-col gap-0.5">
              <li><Link to="/auctions" className="block rounded-md px-3 py-2.5 text-[15px] font-bold text-muted hover:bg-stone hover:text-navy">المزادات المفتوحة</Link></li>
              <li><Link to="/names" className="block rounded-md px-3 py-2.5 text-[15px] font-bold text-muted hover:bg-stone hover:text-navy">سجل الأسماء</Link></li>
              <li><Link to="/" className="block rounded-md px-3 py-2.5 text-[15px] font-bold text-muted hover:bg-stone hover:text-navy">الصفحة الرئيسية</Link></li>
            </ul>
          </nav>
        </aside>
        <main className="min-w-0 flex-1 px-4 py-7 lg:px-8">
          <div className="mx-auto max-w-6xl">{children ?? <Outlet />}</div>
        </main>
      </div>
    </div>
  )
}
