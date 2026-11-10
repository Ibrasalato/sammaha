import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { LangSwitch, tr } from '../lib/i18n'
import { api, useApp, useLoad } from '../lib/store'
import { Avatar } from './Avatar'
import { NotificationBell } from './NotificationBell'
import { Icon } from './dash'
import type { IconName } from './dash'
import { Logo, type NavItem } from './Layout'
import { SiteBanner } from './SettingsUi'
import { useStaffIdle } from './StaffIdle'
import { Countdown } from './ui'
import { num } from '../lib/format'
import { followed, watchTick } from '../lib/follow'
import type { Auction } from '../lib/types'

/** while the app runs: checks followed auctions and the owner's bids, raises outbid/result alerts and refreshes the live activity */
function useFollowMonitor(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    let stop = false
    const tick = async () => {
      try {
        const bids = await api.myBids()
        const items: { a: Auction; myBid?: number }[] = bids.map((b) => ({ a: b.auction, myBid: b.amount }))
        const have = new Set(bids.map((b) => b.auctionId))
        for (const id of Object.keys(followed()).filter((x) => !have.has(x))) {
          try { items.push({ a: (await api.getAuction(id)).auction }) } catch { /* gone */ }
        }
        if (!stop) watchTick(items)
      } catch { /* signed out or offline */ }
    }
    void tick()
    const t = setInterval(tick, 15_000)
    return () => { stop = true; clearInterval(t) }
  }, [enabled])
}

/* ───────── the mobile app's own chrome (used only inside the Capacitor app) ───────── */

/** Tables become stacked cards: each cell gets its column title as a label. */
export function useCardTables() {
  const { pathname } = useLocation()
  useEffect(() => {
    const label = () => {
      document.querySelectorAll<HTMLTableElement>('table.tbl').forEach((t) => {
        if (t.closest('.invoice, .certificate, .certificate-issued')) return
        const heads = Array.from(t.querySelectorAll('thead th')).map((h) => (h.textContent || '').trim())
        t.querySelectorAll('tbody tr').forEach((r) => {
          Array.from(r.children).forEach((c, i) => { if (!c.hasAttribute('data-label') && heads[i]) c.setAttribute('data-label', heads[i]) })
        })
        t.classList.add('as-cards')
      })
    }
    label()
    const mo = new MutationObserver(label)
    mo.observe(document.body, { childList: true, subtree: true })
    return () => mo.disconnect()
  }, [pathname])
}

function Tab({ to, label, icon, end, also }: { to: string; label: string; icon: IconName; end?: boolean; also?: string[] }) {
  const { pathname } = useLocation()
  const extra = !!also?.some((p) => pathname === p || pathname.startsWith(p + '/'))
  return (
    <NavLink to={to} end={end} className={({ isActive }) => `app-tab ${isActive || extra ? 'on' : ''}`}>
      <span className="app-tab-ic"><Icon name={icon} className="h-[22px] w-[22px]" /></span>
      <span className="max-w-full truncate">{label}</span>
    </NavLink>
  )
}

/** A bottom sheet that lists everything else. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[60] flex items-end bg-ink/45" onClick={onClose} role="dialog" aria-modal aria-label={title}>
      <div className="app-sheet w-full overflow-y-auto rounded-t-2xl bg-paper pb-[calc(env(safe-area-inset-bottom)+16px)]" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 bg-paper px-5 pb-2 pt-3">
          <span className="mx-auto mb-3 block h-1.5 w-10 rounded-full bg-line" aria-hidden />
          <div className="flex items-center justify-between"><h2 className="text-[18px]">{title}</h2><button className="btn-ghost btn-sm" onClick={onClose}>{tr('إغلاق', 'Close')}</button></div>
        </div>
        <div className="px-4 pt-1">{children}</div>
      </div>
    </div>
  )
}

function TopBar({ title, back, start, children }: { title: string; back?: boolean; start?: ReactNode; children?: ReactNode }) {
  const nav = useNavigate()
  return (
    <header className="app-top">
      <div className="flex h-14 items-center gap-2 px-3.5">
        <span className="flex shrink-0 items-center">{start}</span>
        <span className="min-w-0 flex-1 truncate text-center text-[19px] font-extrabold" aria-label={title}>{back ? title : ''}</span>
        {back
          ? <button className="app-iconbtn" onClick={() => nav(-1)} aria-label={tr('رجوع', 'Back')}><Icon name="arrow" className="h-5 w-5 rtl:rotate-180" /></button>
          : <span className="flex items-center gap-2">{children}</span>}
      </div>
    </header>
  )
}

/** the owner's four tabs, the same on every screen of the app */
function OwnerTabs() {
  return (
    <>
      <Tab to="/dashboard" label={tr('الرئيسية', 'Home')} icon="home" end />
      <Tab to="/auctions" label={tr('المزادات', 'Auctions')} icon="gavel" />
      <Tab to="/dashboard/services" label={tr('الخدمات', 'Services')} icon="grid" also={['/dashboard/requests', '/dashboard/invest', '/dashboard/sell', '/dashboard/transfers', '/dashboard/exemptions']} />
      <Tab to="/dashboard/account" label={tr('حسابي', 'Account')} icon="user" also={['/dashboard/profile', '/dashboard/wallet', '/dashboard/invoices', '/dashboard/violations', '/dashboard/tickets', '/dashboard/names', '/dashboard/camels', '/dashboard/certificates', '/dashboard/settings', '/dashboard/watchlist', '/dashboard/bids']} />
    </>
  )
}

const DEPTH_ROOTS = new Set(['/', '/auctions', '/names', '/services', '/events', '/dashboard', '/dashboard/services', '/dashboard/bids', '/dashboard/account', '/admin', '/login', '/signup'])

const SUB_TITLES = (): [RegExp, string][] => [
  [/^\/dashboard\/requests\/new/, tr('طلب شعار جديد', 'New name request')], [/^\/dashboard\/requests\/[^/]+/, tr('تفاصيل الطلب', 'Request details')], [/^\/dashboard\/requests/, tr('طلباتي', 'My requests')],
  [/^\/dashboard\/invoices\/[^/]+/, tr('الفاتورة', 'Invoice')], [/^\/dashboard\/certificates\/[^/]+/, tr('الشهادة', 'Certificate')], [/^\/dashboard\/exemptions/, tr('استثناء المشاركة', 'Exemption')],
  [/^\/dashboard\/account/, tr('حسابي', 'My account')], [/^\/dashboard\/profile/, tr('الملف الشخصي', 'Profile')], [/^\/dashboard\/invest/, tr('استثمار الاسم', 'Name investment')], [/^\/dashboard\/sell/, tr('إعادة بيع', 'Resell a name')],
  [/^\/dashboard\/transfers/, tr('نقل ملكية', 'Ownership transfer')], [/^\/dashboard\/watchlist/, tr('المتابعة', 'Watchlist')], [/^\/dashboard\/bids/, tr('مزايداتي', 'My bids')],
  [/^\/dashboard\/names$/, tr('أسمائي المسجلة', 'My registered names')], [/^\/dashboard\/wallet/, tr('المحفظة', 'Wallet')],
  [/^\/dashboard\/names\/[^/]+\/certificate/, tr('شهادة الاسم', 'Name certificate')],
]
function pageTitle(pathname: string, nav: NavItem[], fallback: string) {
  const sub = SUB_TITLES().find(([re]) => re.test(pathname))
  if (sub) return sub[1]
  const hit = [...nav].sort((a, b) => b.to.length - a.to.length).find((n) => pathname === n.to || pathname.startsWith(n.to + '/'))
  return hit?.label ?? fallback
}

/** Owner / staff area: compact bar, five tabs, everything else in the "More" sheet. */
export function NativeShell({ nav, title }: { nav: NavItem[]; title: string }) {
  const { user, setUser } = useApp()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [more, setMore] = useState(false)
  const scroller = useRef<HTMLElement>(null)
  useStaffIdle()
  useFollowMonitor(user?.role === 'owner')
  useCardTables()
  useEffect(() => { setMore(false); window.scrollTo({ top: 0 }) }, [pathname])
  const tabs = nav.slice(0, 4)
  const deep = !DEPTH_ROOTS.has(pathname)
  const roleLabel = user?.role === 'owner' ? tr('مالك إبل', 'Camel owner') : user?.role === 'committee' ? tr('لجنة الاعتماد', 'Accreditation Committee') : tr('مدير المنصة', 'Platform administrator')
  const home = user?.role === 'owner' ? '/dashboard/account' : '/admin/account'
  return (
    <div className="app-root">
      <TopBar title={pageTitle(pathname, nav, title)} back={deep} start={user && <Link to={home} aria-label={tr('حسابي', 'My account')}><Avatar name={user.fullName} src={user.avatarUrl} size={40} ring /></Link>}>
        <NotificationBell />
      </TopBar>
      <SiteBanner dashboard />
      {user?.acting && (
        <div className="border-b border-gold/40 bg-gold-soft px-4 py-2 text-[13.5px]" role="status">
          {tr('تدير حساب', 'Managing')} <b>{user.fullName}</b> {tr('بالتفويض.', 'by delegation.')}{' '}
          <button className="font-bold text-pine underline" onClick={async () => { try { setUser(await api.stopActing()); navigate('/dashboard/settings?tab=delegation') } catch { setUser(null); navigate('/') } }}>{tr('العودة إلى حسابي', 'Back to my account')}</button>
        </div>
      )}
      <main ref={scroller} className="app-main"><Outlet /></main>
      <nav className="app-tabs" aria-label={tr('التنقل السريع', 'Quick navigation')}>
        {user?.role === 'owner' ? <OwnerTabs /> : <>
          {tabs.map((n) => <Tab key={n.to} to={n.to} label={n.short ?? n.label} icon={n.icon} end={n.end} also={n.also} />)}
          <button className="app-tab" onClick={() => setMore(true)}><span className="app-tab-ic"><Icon name="list" className="h-[22px] w-[22px]" /></span>{tr('المزيد', 'More')}</button>
        </>}
      </nav>
      <Sheet open={more} onClose={() => setMore(false)} title={user?.fullName ?? title}>
        <p className="-mt-1 mb-3 text-[13px] text-muted">{user?.acting ? `${tr('مفوَّض', 'Delegate')}: ${user.acting.actorName}` : roleLabel}</p>
        <div className="grid grid-cols-3 gap-2.5">
          {nav.slice(4).map((n) => (
            <Link key={n.to} to={n.to} className="app-tile"><Icon name={n.icon} className="h-6 w-6 text-pine" /><span>{n.short ?? n.label}</span></Link>
          ))}
          <Link to="/auctions" className="app-tile"><Icon name="gavel" className="h-6 w-6 text-gold-deep" /><span>{tr('المزادات المفتوحة', 'Open auctions')}</span></Link>
          <Link to="/names" className="app-tile"><Icon name="tag" className="h-6 w-6 text-gold-deep" /><span>{tr('سجل الأسماء', 'Names registry')}</span></Link>
          <Link to="/verify" className="app-tile"><Icon name="check" className="h-6 w-6 text-gold-deep" /><span>{tr('التحقق من شهادة', 'Verify a certificate')}</span></Link>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <LangSwitch className="btn-ghost btn-sm flex-1" />
          <button className="btn-primary btn-sm flex-1" onClick={async () => { await api.signOut(); setUser(null); navigate('/') }}>{tr('تسجيل الخروج', 'Sign out')}</button>
        </div>
      </Sheet>
    </div>
  )
}

/** Public screens in the app: auctions, registry, services, account. */
async function shareLink(path: string) {
  const site = ((import.meta.env.VITE_SITE_URL as string | undefined) ?? 'https://sammha.ico.org.sa/').replace(/\/?$/, '/')
  const url = `${site}#${path}`
  try { if (navigator.share) { await navigator.share({ title: tr('مزاد على سمّها', 'An auction on Sammha'), url }); return } } catch { return }
  try { await navigator.clipboard.writeText(url) } catch { /* no clipboard */ }
}

export function NativePublicLayout() {
  const { user } = useApp()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  useFollowMonitor(user?.role === 'owner')
  useCardTables()
  useEffect(() => { window.scrollTo({ top: 0 }) }, [pathname])
  const deep = !DEPTH_ROOTS.has(pathname)
  const titles: [RegExp, string][] = [
    [/^\/auctions\/[^/]+/, tr('تفاصيل المزاد', 'Auction details')], [/^\/auctions/, tr('المزادات', 'Auctions')], [/^\/names/, tr('سجل الأسماء', 'Registry')], [/^\/services/, tr('الخدمات', 'Services')], [/^\/events/, tr('المواعيد', 'Calendar')],
    [/^\/verify/, tr('التحقق من شهادة', 'Verify a certificate')], [/^\/login/, tr('تسجيل الدخول', 'Sign in')], [/^\/signup/, tr('حساب جديد', 'Create account')], [/^\/market/, tr('سوق الأسماء', 'Name market')],
    [/^\/(faq|terms|privacy|refund|contact|about|invest)/, tr('سمّها', 'Sammha')],
  ]
  const title = titles.find(([re]) => re.test(pathname))?.[1] ?? tr('سمّها', 'Sammha')
  const acct = user ? (user.role === 'owner' ? '/dashboard' : '/admin') : '/login'
  return (
    <div className="app-root">
      {/^\/auctions\/[^/]+$/.test(pathname) ? (
        <header className="app-top">
          <div className="flex h-14 items-center gap-2 px-3.5">
            <button className="app-iconbtn" onClick={() => navigate(-1)} aria-label={tr('رجوع', 'Back')}><Icon name="arrow" className="h-5 w-5 ltr:rotate-180" /></button>
            <span className="min-w-0 flex-1 truncate text-center text-[19px] font-extrabold">{title}</span>
            <button className="app-iconbtn" aria-label={tr('مشاركة', 'Share')} onClick={() => void shareLink(pathname)}><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v13M7 8l5-5 5 5M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6" /></svg></button>
          </div>
        </header>
      ) : <TopBar title={title} back={deep} start={user ? <Link to={user.role === 'owner' ? '/dashboard/account' : '/admin/account'} aria-label={tr('حسابي', 'My account')}><Avatar name={user.fullName} src={user.avatarUrl} size={40} ring /></Link> : <Link to="/" aria-label={tr('الرئيسية', 'Home')}><Logo className="h-9" /></Link>}>{user ? <NotificationBell /> : <LangSwitch className="app-pill" />}</TopBar>}
      <SiteBanner />
      <main className="app-main"><Outlet /></main>
      <nav className="app-tabs" aria-label={tr('التنقل السريع', 'Quick navigation')}>
        {user?.role === 'owner' ? <OwnerTabs /> : <>
          <Tab to="/" label={tr('الرئيسية', 'Home')} icon="home" end />
          <Tab to="/auctions" label={tr('المزادات', 'Auctions')} icon="gavel" />
          <Tab to="/names" label={tr('السجل', 'Registry')} icon="tag" />
          <Tab to="/services" label={tr('الخدمات', 'Services')} icon="list" />
          <Tab to={acct} label={user ? tr('حسابي', 'Account') : tr('دخول', 'Sign in')} icon={user ? 'users' : 'lock'} also={['/login', '/signup']} />
        </>}
      </nav>
    </div>
  )
}

/** The app's first screen: signed-in people go straight to their dashboard. */
export function NativeHome() {
  const { user, ready } = useApp()
  const live = useLoad(() => api.listAuctions({ phase: 'live' }), [], 15000)
  if (ready && user) return <Navigate to={user.role === 'owner' ? '/dashboard' : '/admin'} replace />
  const top = [...(live.data ?? [])].sort((a, b) => b.currentPrice - a.currentPrice).slice(0, 5)
  return (
    <div className="px-4 pb-6 pt-4">
      <section className="rounded-2xl bg-pine px-5 pb-6 pt-7 text-center text-paper">
        <Logo light className="mx-auto h-16" />
        <h1 className="mt-4 text-[22px] font-extrabold leading-snug text-paper">{tr('السجل الدولي لأسماء الإبل وشعاراتها', 'The international registry of camel names and marks')}</h1>
        <p className="mt-2 text-[14.5px] leading-7 text-paper/75">{tr('اطلب اسمًا لمنقياتك وفردياتك، وتابع مزاده، وسجّله باسمك.', 'Request a name, follow its auction, and have it registered to you.')}</p>
        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <Link to="/login" className="btn-gold">{tr('تسجيل الدخول', 'Sign in')}</Link>
          <Link to="/signup" className="btn-on-dark">{tr('حساب جديد', 'Create account')}</Link>
        </div>
      </section>

      <div className="mt-4 grid grid-cols-3 gap-2.5">
        <Link to="/auctions" className="app-tile"><Icon name="gavel" className="h-6 w-6 text-pine" /><span>{tr('المزادات', 'Auctions')}</span></Link>
        <Link to="/events" className="app-tile"><Icon name="calendar" className="h-6 w-6 text-pine" /><span>{tr('المواعيد', 'Calendar')}</span></Link>
        <Link to="/verify" className="app-tile"><Icon name="check" className="h-6 w-6 text-pine" /><span>{tr('التحقق من شهادة', 'Verify')}</span></Link>
      </div>

      <div className="mb-2 mt-6 flex items-center justify-between">
        <h2 className="text-[18px]">{tr('مزادات مباشرة الآن', 'Live now')}</h2>
        <Link to="/auctions" className="text-[14px] font-bold text-pine">{tr('عرض الكل', 'See all')}</Link>
      </div>
      {top.length ? (
        <ul className="space-y-2.5">
          {top.map((a) => (
            <li key={a.id}>
              <Link to={`/auctions/${a.id}`} className="app-row">
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-[16px]">{a.name}</b>
                  <span className="text-[13px] text-muted">{num(a.bidCount)} {tr('مزايدة', 'bids')} · <Countdown to={a.endsAt} className="font-bold" /></span>
                </span>
                <span className="text-end"><span className="num block text-[17px] font-extrabold">{num(a.currentPrice)}</span><span className="text-[12px] text-muted">{tr('أعلى مزايدة', 'top bid')}</span></span>
              </Link>
            </li>
          ))}
        </ul>
      ) : <p className="rounded-xl border border-line bg-paper p-5 text-center text-muted">{tr('لا توجد مزادات مباشرة الآن.', 'No live auctions right now.')}</p>}

      <nav className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[13px] text-muted" aria-label={tr('روابط قانونية', 'Legal')}>
        <Link to="/terms">{tr('الشروط والأحكام', 'Terms')}</Link><Link to="/privacy">{tr('سياسة الخصوصية', 'Privacy')}</Link><Link to="/refund">{tr('سياسة الاسترداد', 'Refunds')}</Link><Link to="/contact">{tr('تواصل معنا', 'Contact')}</Link><Link to="/faq">{tr('الأسئلة الشائعة', 'FAQ')}</Link>
      </nav>
    </div>
  )
}
