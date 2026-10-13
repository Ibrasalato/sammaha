import { Suspense, lazy, useEffect } from 'react'
import type { ComponentType } from 'react'
import { PageSkeleton } from './components/Skeleton'
import { usePageTitle } from './lib/usePageTitle'
import type { ReactNode } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { PublicLayout, Shell } from './components/Layout'
import type { NavItem } from './components/Layout'
import { Loading } from './components/ui'
import { LangProvider, useLang } from './lib/i18n'
import { AppProvider, useApp } from './lib/store'
import type { Role } from './lib/types'
import About from './pages/About'
import AuctionDetail from './pages/AuctionDetail'
import Auctions from './pages/Auctions'
import { Login, Signup, StaffLogin } from './pages/Auth'
import { Faq, Privacy, Refund, Terms } from './pages/Content'
import { Contact, TrackTicket } from './pages/Support'
import { ChatWidget } from './components/ChatWidget'
import Events from './pages/Events'
import Home from './pages/Home'
import ReservedNames from './pages/ReservedNames'
import Verify from './pages/Verify'
import { STAFF_LOGIN_PATH } from './lib/config'

// Dashboards load on demand, so the public site stays light on phones.
type Mod = Record<string, ComponentType>
const pick = (load: () => Promise<unknown>, name: string) => lazy(() => load().then((m) => ({ default: (m as Mod)[name] })))
const ownerMod = () => import('./pages/owner/Owner')
const reqMod = () => import('./pages/owner/Requests')
const adminMod = () => import('./pages/admin/Admin')
const DashHome = pick(ownerMod, 'DashHome'), WalletPage = pick(ownerMod, 'WalletPage'), MyInvoices = pick(ownerMod, 'MyInvoices')
const InvoicePage = pick(ownerMod, 'InvoicePage'), MyBids = pick(ownerMod, 'MyBids'), MyNames = pick(ownerMod, 'MyNames')
const CertificatePage = pick(ownerMod, 'CertificatePage'), ProfilePage = pick(ownerMod, 'ProfilePage'), WatchlistPage = pick(ownerMod, 'WatchlistPage')
const MyRequests = pick(reqMod, 'MyRequests'), NewRequest = pick(reqMod, 'NewRequest'), RequestDetail = pick(reqMod, 'RequestDetail')
const MyTickets = pick(() => import('./pages/owner/Tickets'), 'MyTickets')
const AdminHome = pick(adminMod, 'AdminHome'), AdminRequests = pick(adminMod, 'AdminRequests'), AdminReview = pick(adminMod, 'AdminReview')
const AdminSchedule = pick(adminMod, 'AdminSchedule'), AdminAuctions = pick(adminMod, 'AdminAuctions'), AdminInvoices = pick(adminMod, 'AdminInvoices')
const AdminEvents = pick(adminMod, 'AdminEvents')
const AdminTickets = pick(() => import('./pages/admin/Tickets'), 'AdminTickets'), AdminTicket = pick(() => import('./pages/admin/Tickets'), 'AdminTicket')
const AdminUsers = pick(() => import('./pages/admin/Users'), 'AdminUsers'), StaffAccount = pick(() => import('./pages/admin/Users'), 'StaffAccount')

/** Tab titles per page (the auction page sets its own with the name). */
const TITLES: [RegExp, string, string][] = [
  [/^\/$/, '', ''], [/^\/auctions$/, 'المزادات', 'Auctions'], [/^\/names/, 'سجل الأسماء', 'Name registry'], [/^\/events/, 'المواعيد والمهرجانات', 'Events'],
  [/^\/verify/, 'التحقق من شهادة', 'Verify a certificate'], [/^\/faq/, 'الأسئلة الشائعة', 'FAQ'], [/^\/terms/, 'الشروط والأحكام', 'Terms'],
  [/^\/privacy/, 'سياسة الخصوصية', 'Privacy'], [/^\/refund/, 'سياسة الاسترداد', 'Refunds'], [/^\/contact\/track/, 'متابعة طلب', 'Track a request'],
  [/^\/contact/, 'تواصل معنا', 'Contact'], [/^\/about/, 'عن المنصة', 'About'], [/^\/login/, 'تسجيل الدخول', 'Sign in'], [/^\/signup/, 'إنشاء حساب', 'Sign up'],
  [/^\/dashboard/, 'لوحة التحكم', 'Dashboard'], [/^\/admin/, 'لجنة الاعتماد', 'Committee'], [/^\/ico-staff/, 'بوابة الموظفين', 'Staff'],
]
function RouteTitle() {
  const { pathname } = useLocation()
  const { lang } = useLang()
  const hit = /^\/auctions\/[^/]+$/.test(pathname) ? null : TITLES.find(([re]) => re.test(pathname))
  usePageTitle(hit === null ? undefined : hit ? (lang === 'ar' ? hit[1] : hit[2]) || undefined : undefined)
  return null
}

function Guard({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, ready, toast } = useApp()
  const { lang, setLang } = useLang()
  const loc = useLocation()
  // Dashboards are Arabic-only for now; switch rather than show a mixed-language screen
  useEffect(() => {
    if (lang === 'en') { setLang('ar'); toast('لوحة التحكم متاحة بالعربية حاليًا. Dashboards are in Arabic for now.') }
  }, [lang, setLang, toast])
  if (!ready) return <Loading />
  // staff pages send visitors to the unlisted staff portal, not the public login
  if (!user) return <Navigate to={roles.includes('owner') ? '/login' : STAFF_LOGIN_PATH} replace state={{ from: loc.pathname }} />
  if (!roles.includes(user.role)) return <Navigate to={user.role === 'owner' ? '/dashboard' : '/admin'} replace />
  return <>{children}</>
}

const OWNER_NAV: NavItem[] = [
  { to: '/dashboard', label: 'الرئيسية', icon: 'home', end: true },
  { to: '/dashboard/requests', label: 'طلبات الشعارات', short: 'طلباتي', icon: 'file' },
  { to: '/dashboard/bids', label: 'مزايداتي', icon: 'gavel' },
  { to: '/dashboard/watchlist', label: 'قائمة المتابعة', short: 'المتابعة', icon: 'clock' },
  { to: '/dashboard/names', label: 'أسمائي', icon: 'tag' },
  { to: '/dashboard/wallet', label: 'المحفظة', icon: 'wallet' },
  { to: '/dashboard/invoices', label: 'الفواتير', icon: 'receipt' },
  { to: '/dashboard/tickets', label: 'الشكاوى والاستفسارات', icon: 'alert' },
  { to: '/dashboard/profile', label: 'حسابي', icon: 'users' },
]

const ADMIN_NAV: NavItem[] = [
  { to: '/admin', label: 'نظرة عامة', icon: 'home', end: true },
  { to: '/admin/requests', label: 'مراجعة الطلبات', short: 'المراجعة', icon: 'shield' },
  { to: '/admin/schedule', label: 'فتح المزادات', short: 'فتح مزاد', icon: 'calendar' },
  { to: '/admin/auctions', label: 'متابعة المزادات', short: 'المزادات', icon: 'gavel' },
  { to: '/admin/invoices', label: 'الفواتير', icon: 'receipt' },
  { to: '/admin/tickets', label: 'الشكاوى والبلاغات', icon: 'alert' },
  { to: '/admin/events', label: 'المواعيد والفعاليات', icon: 'list' },
  { to: '/admin/users', label: 'المستخدمون والصلاحيات', icon: 'users' },
  { to: '/admin/account', label: 'حسابي', icon: 'shield' },
]

/** The users and permissions page is for the super admin only. */
function AdminShell() {
  const { user } = useApp()
  const nav = user?.role === 'admin' ? ADMIN_NAV : ADMIN_NAV.filter((n) => n.to !== '/admin/users')
  return <Shell nav={nav} title={user?.role === 'admin' ? 'إدارة المنصة' : 'لجنة الاعتماد'} />
}

export default function App() {
  return (
    <LangProvider>
      <AppProvider>
        <HashRouter>
          <RouteTitle />
          <Suspense fallback={<div className="wrap"><PageSkeleton /></div>}>
            <AppRoutes />
          </Suspense>
          <ChatWidget />
        </HashRouter>
      </AppProvider>
    </LangProvider>
  )
}

function AppRoutes() {
  const { lang } = useLang()
  return (
        <Routes key={lang}>
          <Route element={<PublicLayout />}>
            <Route index element={<Home />} />
            <Route path="auctions" element={<Auctions />} />
            <Route path="auctions/:id" element={<AuctionDetail />} />
            <Route path="names" element={<ReservedNames />} />
            <Route path="events" element={<Events />} />
            <Route path="verify" element={<Verify />} />
            <Route path="faq" element={<Faq />} />
            <Route path="terms" element={<Terms />} />
            <Route path="privacy" element={<Privacy />} />
            <Route path="refund" element={<Refund />} />
            <Route path="contact" element={<Contact />} />
            <Route path="contact/track" element={<TrackTicket />} />
            <Route path="contact/track/:number" element={<TrackTicket />} />
            <Route path="verify/:code" element={<Verify />} />
            <Route path="about" element={<About />} />
            <Route path="login" element={<Login />} />
            <Route path="signup" element={<Signup />} />
          </Route>
          <Route path="dashboard" element={<Guard roles={['owner']}><Shell nav={OWNER_NAV} title="لوحة التحكم" /></Guard>}>
            <Route index element={<DashHome />} />
            <Route path="requests" element={<MyRequests />} />
            <Route path="requests/new" element={<NewRequest />} />
            <Route path="requests/:id" element={<RequestDetail />} />
            <Route path="bids" element={<MyBids />} />
            <Route path="names" element={<MyNames />} />
            <Route path="names/:id/certificate" element={<CertificatePage />} />
            <Route path="wallet" element={<WalletPage />} />
            <Route path="invoices" element={<MyInvoices />} />
            <Route path="invoices/:id" element={<InvoicePage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="tickets" element={<MyTickets />} />
            <Route path="watchlist" element={<WatchlistPage />} />
          </Route>
          <Route path={STAFF_LOGIN_PATH.slice(1)} element={<StaffLogin />} />
          <Route path="admin" element={<Guard roles={['committee', 'admin']}><AdminShell /></Guard>}>
            <Route index element={<AdminHome />} />
            <Route path="requests" element={<AdminRequests />} />
            <Route path="requests/:id" element={<AdminReview />} />
            <Route path="schedule" element={<AdminSchedule />} />
            <Route path="auctions" element={<AdminAuctions />} />
            <Route path="invoices" element={<AdminInvoices />} />
            <Route path="users" element={<Guard roles={['admin']}><AdminUsers /></Guard>} />
            <Route path="account" element={<StaffAccount />} />
            <Route path="events" element={<AdminEvents />} />
            <Route path="tickets" element={<AdminTickets />} />
            <Route path="tickets/:id" element={<AdminTicket />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
  )
}
