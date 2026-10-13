import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { IS_DEMO, SELLER } from '../lib/config'
import { resetDemo } from '../lib/demoApi'
import { api, useApp } from '../lib/store'

const PUBLIC_NAV: [string, string][] = [
  ['/', 'الرئيسية'],
  ['/auctions', 'المزادات'],
  ['/names', 'الأسماء المحجوزة'],
  ['/about', 'عن المنصة'],
]

function navCls({ isActive }: { isActive: boolean }) {
  return `rounded-md px-3 py-2 text-[15px] font-semibold transition-colors ${isActive ? 'text-ink bg-stone-deep' : 'text-muted hover:text-ink'}`
}

export function Logo({ light, className = 'h-12' }: { light?: boolean; className?: string }) {
  return <img src={light ? './sammha-logo-light.png' : './sammha-logo.png'} alt="سمّها لأسماء الإبل الدولية" className={`${className} w-auto`} />
}

export function DemoBar() {
  if (!IS_DEMO) return null
  return (
    <div className="bg-ink px-4 py-1.5 text-center text-[13px] text-paper/80">
      نسخة تجريبية: البيانات محفوظة في متصفحك فقط.{' '}
      <button className="underline underline-offset-2 hover:text-paper" onClick={() => { resetDemo(); location.reload() }}>إعادة ضبط البيانات</button>
    </div>
  )
}

export function UserMenu() {
  const { user, setUser } = useApp()
  const nav = useNavigate()
  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link to="/login" className="btn-ghost btn-sm">دخول</Link>
        <Link to="/signup" className="btn-primary btn-sm">حساب جديد</Link>
      </div>
    )
  }
  const home = user.role === 'owner' ? '/dashboard' : '/admin'
  return (
    <div className="flex items-center gap-2">
      <Link to={home} className="btn-primary btn-sm">{user.role === 'owner' ? 'لوحة التحكم' : 'لوحة اللجنة'}</Link>
      <button className="btn-ghost btn-sm" onClick={async () => { await api.signOut(); setUser(null); nav('/') }}>خروج</button>
    </div>
  )
}

export function PublicLayout() {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex min-h-screen flex-col">
      <DemoBar />
      <header className="border-b border-line bg-paper">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Link to="/" aria-label="الرئيسية"><Logo className="h-11" /></Link>
          <nav className="ms-4 hidden items-center gap-1 md:flex">
            {PUBLIC_NAV.map(([to, label]) => <NavLink key={to} to={to} end={to === '/'} className={navCls}>{label}</NavLink>)}
          </nav>
          <div className="ms-auto hidden md:block"><UserMenu /></div>
          <button className="btn-ghost btn-sm ms-auto md:hidden" onClick={() => setOpen(!open)} aria-expanded={open}>القائمة</button>
        </div>
        {open && (
          <div className="border-t border-line px-4 py-3 md:hidden" onClick={() => setOpen(false)}>
            <nav className="flex flex-col gap-1">
              {PUBLIC_NAV.map(([to, label]) => <NavLink key={to} to={to} end={to === '/'} className={navCls}>{label}</NavLink>)}
            </nav>
            <div className="mt-3"><UserMenu /></div>
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
    <footer className="bg-ink text-paper/75">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-[auto_1fr_auto] sm:items-center">
        <Logo light className="h-16" />
        <p className="max-w-md text-sm leading-7">
          منصة إلكترونية تابعة للمنظمة الدولية للإبل، تنظّم أسماء الشعارات لمنقيات وفرديات الإبل، وتقيم مزاداتها وتسجّلها لأصحابها.
        </p>
        <div className="flex flex-col gap-1.5 text-sm">
          <a className="hover:text-paper" href={`https://wa.me/${SELLER.whatsapp}`} target="_blank" rel="noreferrer">واتساب {SELLER.whatsapp.replace(/^966/, '0')}</a>
          <a className="hover:text-paper" href={`mailto:${SELLER.email}`}>{SELLER.email}</a>
          <a className="hover:text-paper" href={SELLER.x} target="_blank" rel="noreferrer">@samha_ico</a>
        </div>
      </div>
      <div className="border-t border-paper/10 px-4 py-4 text-center text-[13px] text-paper/50">© {new Date().getFullYear()} المنظمة الدولية للإبل</div>
    </footer>
  )
}

export function Shell({ nav, title, children }: { nav: [string, string, boolean?][]; title: string; children?: ReactNode }) {
  const { user } = useApp()
  const [open, setOpen] = useState(false)
  return (
    <div className="flex min-h-screen flex-col">
      <DemoBar />
      <header className="border-b border-line bg-paper">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5">
          <Link to="/" aria-label="الرئيسية"><Logo className="h-10" /></Link>
          <span className="hidden border-s border-line ps-3 font-kufi text-lg sm:inline">{title}</span>
          <div className="ms-auto hidden text-sm text-muted sm:block">{user?.fullName}</div>
          <UserMenuCompact />
          <button className="btn-ghost btn-sm lg:hidden" onClick={() => setOpen(!open)} aria-expanded={open}>القائمة</button>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-4 py-6">
        <aside className={`${open ? 'fixed inset-0 z-30 block bg-ink/40' : 'hidden'} lg:static lg:block lg:bg-transparent`} onClick={() => setOpen(false)}>
          <nav className="h-full w-64 shrink-0 bg-paper p-3 lg:sticky lg:top-6 lg:h-auto lg:rounded-xl lg:border lg:border-line" onClick={(e) => e.stopPropagation()}>
            <ul className="flex flex-col gap-0.5">
              {nav.map(([to, label, end]) => (
                <li key={to}>
                  <NavLink to={to} end={end} onClick={() => setOpen(false)}
                    className={({ isActive }) => `block rounded-md px-3 py-2 text-[15px] font-semibold ${isActive ? 'bg-ink text-paper' : 'text-muted hover:bg-stone hover:text-ink'}`}>
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
            <div className="mt-3 border-t border-line pt-3">
              <Link to="/auctions" className="block rounded-md px-3 py-2 text-[15px] font-semibold text-muted hover:bg-stone hover:text-ink">المزادات المفتوحة</Link>
              <Link to="/names" className="block rounded-md px-3 py-2 text-[15px] font-semibold text-muted hover:bg-stone hover:text-ink">سجل الأسماء</Link>
            </div>
          </nav>
        </aside>
        <main className="min-w-0 flex-1">{children ?? <Outlet />}</main>
      </div>
    </div>
  )
}

function UserMenuCompact() {
  const { setUser } = useApp()
  const nav = useNavigate()
  return <button className="btn-ghost btn-sm" onClick={async () => { await api.signOut(); setUser(null); nav('/') }}>خروج</button>
}
