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
import { canAny } from './lib/permissions'
import { OwnerDirectory } from './components/OwnerCell'
import type { Permission } from './lib/permissions'
import About from './pages/About'
import AuctionDetail from './pages/AuctionDetail'
import Auctions from './pages/Auctions'
import { Login, Signup, StaffLogin } from './pages/Auth'
import { Faq, Privacy, Refund, Terms } from './pages/Content'
import { Contact, TrackTicket } from './pages/Support'
import { ChatWidget } from './components/ChatWidget'
import Events from './pages/Events'
import Home from './pages/Home'
import Invest from './pages/Invest'
import Market from './pages/Market'
import ReservedNames from './pages/ReservedNames'
import Verify from './pages/Verify'
import { OwnerSettings, StaffSettings } from './pages/Settings'
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
const SellPage = pick(() => import('./pages/owner/Sell'), 'SellPage')
const InvestPage = pick(() => import('./pages/owner/Invest'), 'InvestPage')
const MyTickets = pick(() => import('./pages/owner/Tickets'), 'MyTickets')
const AdminHome = pick(adminMod, 'AdminHome'), AdminRequests = pick(() => import('./pages/admin/RequestsBoard'), 'AdminRequestsBoard'), AdminReview = pick(adminMod, 'AdminReview')
const AdminSchedule = pick(adminMod, 'AdminSchedule'), AdminAuctions = pick(adminMod, 'AdminAuctions'), AdminInvoices = pick(adminMod, 'AdminInvoices')
const AdminEvents = pick(adminMod, 'AdminEvents')
const AdminTickets = pick(() => import('./pages/admin/Tickets'), 'AdminTickets'), AdminTicket = pick(() => import('./pages/admin/Tickets'), 'AdminTicket')
const AdminRoles = pick(() => import('./pages/admin/Roles'), 'AdminRoles')
const AdminCustomers = pick(() => import('./pages/admin/Customers'), 'AdminCustomers')
const AdminMarksReport = pick(() => import('./pages/admin/MarksReport'), 'AdminMarksReport')
const AdminWallets = pick(() => import('./pages/admin/Finance'), 'AdminWallets'), AdminDeposits = pick(() => import('./pages/admin/Finance'), 'AdminDeposits')
const AdminUsers = pick(() => import('./pages/admin/Users'), 'AdminUsers'), StaffAccount = pick(() => import('./pages/admin/Users'), 'StaffAccount')

/** Tab titles per page (the auction page sets its own with the name). */
const TITLES: [RegExp, string, string][] = [
  [/^\/$/, '', ''], [/^\/auctions$/, 'المزادات', 'Auctions'], [/^\/names/, 'سجل الأسماء', 'Name registry'], [/^\/events/, 'المواعيد والمهرجانات', 'Events'],
  [/^\/verify/, 'التحقق من شهادة', 'Verify a certificate'], [/^\/faq/, 'الأسئلة الشائعة', 'FAQ'], [/^\/terms/, 'الشروط والأحكام', 'Terms'],
  [/^\/privacy/, 'سياسة الخصوصية', 'Privacy'], [/^\/refund/, 'سياسة الاسترداد', 'Refunds'], [/^\/contact\/track/, 'متابعة طلب', 'Track a request'],
  [/^\/contact/, 'تواصل معنا', 'Contact'], [/^\/about/, 'عن المنصة', 'About'], [/^\/invest/, 'استثمار الاسم', 'Name investment'], [/^\/market/, 'سوق الأسماء', 'Name market'], [/^\/login/, 'تسجيل الدخول', 'Sign in'], [/^\/signup/, 'إنشاء حساب', 'Sign up'],
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
  { to: '/dashboard/invest', label: 'استثمار الاسم', short: 'استثمار', icon: 'coins' },
  { to: '/dashboard/sell', label: 'بيع اسم', icon: 'tag' },
  { to: '/dashboard/bids', label: 'مزايداتي', icon: 'gavel' },
  { to: '/dashboard/watchlist', label: 'قائمة المتابعة', short: 'المتابعة', icon: 'clock' },
  { to: '/dashboard/names', label: 'أسمائي', icon: 'tag' },
  { to: '/dashboard/wallet', label: 'المحفظة', icon: 'wallet' },
  { to: '/dashboard/invoices', label: 'الفواتير', icon: 'receipt' },
  { to: '/dashboard/tickets', label: 'الشكاوى والاستفسارات', icon: 'alert' },
  { to: '/dashboard/profile', label: 'حسابي', icon: 'users' },
  { to: '/dashboard/settings', label: 'الإعدادات', icon: 'settings' },
]

/** each staff page and what opens it: a role sees only the pages its permissions allow */
const ADMIN_NAV: (NavItem & { perms?: Permission[] })[] = [
  { to: '/admin', label: 'نظرة عامة', icon: 'home', end: true },
  { to: '/admin/requests', label: 'مراجعة الطلبات', short: 'المراجعة', icon: 'shield', perms: ['requests.view'] },
  { to: '/admin/schedule', label: 'فتح المزادات', short: 'فتح مزاد', icon: 'calendar', perms: ['auctions.schedule'] },
  { to: '/admin/auctions', label: 'التحكم في المزادات', short: 'المزادات', icon: 'gavel', perms: ['auctions.manage', 'auctions.cancel', 'auctions.schedule'] },
  { to: '/admin/reports/marks', label: 'تقرير الشعارات', short: 'التقرير', icon: 'list', perms: ['reports.marks'] },
  { to: '/admin/customers', label: 'بيانات العملاء', short: 'العملاء', icon: 'users', perms: ['owners.view'] },
  { to: '/admin/invoices', label: 'الفواتير', icon: 'receipt', perms: ['invoices.view'] },
  { to: '/admin/wallets', label: 'المحافظ والاسترداد', short: 'المحافظ', icon: 'wallet', perms: ['wallets.view', 'wallets.refund', 'banks.verify'] },
  { to: '/admin/deposits', label: 'الضمانات', icon: 'lock', perms: ['deposits.view'] },
  { to: '/admin/tickets', label: 'الشكاوى والبلاغات', icon: 'alert', perms: ['tickets.view'] },
  { to: '/admin/events', label: 'المواعيد والفعاليات', icon: 'list', perms: ['events.manage'] },
  { to: '/admin/users', label: 'المستخدمون', icon: 'users', perms: ['users.view'] },
  { to: '/admin/roles', label: 'الأدوار والصلاحيات', short: 'الأدوار', icon: 'shield', perms: ['roles.manage'] },
  { to: '/admin/settings', label: 'الإعدادات', icon: 'settings' },
  { to: '/admin/account', label: 'حسابي', icon: 'shield' },
]

function AdminShell() {
  const { user } = useApp()
  const nav = ADMIN_NAV.filter((n) => !n.perms || canAny(user, n.perms))
  return <OwnerDirectory><Shell nav={nav} title={user?.role === 'admin' ? 'إدارة المنصة' : user?.staffRoleName || 'لجنة الاعتماد'} /></OwnerDirectory>
}

/** a staff page the role cannot open shows a short notice instead of failing on every call */
function Can({ perms, children }: { perms: Permission[]; children: ReactNode }) {
  const { user } = useApp()
  if (canAny(user, perms)) return <>{children}</>
  return (
    <div className="rounded-xl border border-line bg-paper p-8 text-center">
      <p className="text-lg font-bold">ليست لديك صلاحية لهذه الصفحة</p>
      <p className="mt-2 text-muted">اطلب من مدير النظام إضافة الصلاحية إلى دورك.</p>
    </div>
  )
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
            <Route path="invest" element={<Invest />} />
            <Route path="market" element={<Market />} />
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
            <Route path="invest" element={<InvestPage />} />
            <Route path="sell" element={<SellPage />} />
            <Route path="settings" element={<OwnerSettings />} />
          </Route>
          <Route path={STAFF_LOGIN_PATH.slice(1)} element={<StaffLogin />} />
          <Route path="admin" element={<Guard roles={['committee', 'admin']}><AdminShell /></Guard>}>
            <Route index element={<AdminHome />} />
            <Route path="requests" element={<Can perms={['requests.view']}><AdminRequests /></Can>} />
            <Route path="requests/:id" element={<Can perms={['requests.view']}><AdminReview /></Can>} />
            <Route path="schedule" element={<Can perms={['auctions.schedule']}><AdminSchedule /></Can>} />
            <Route path="auctions" element={<Can perms={['auctions.manage', 'auctions.cancel', 'auctions.schedule']}><AdminAuctions /></Can>} />
            <Route path="invoices" element={<Can perms={['invoices.view']}><AdminInvoices /></Can>} />
            <Route path="reports/marks" element={<Can perms={['reports.marks']}><AdminMarksReport /></Can>} />
            <Route path="customers" element={<Can perms={['owners.view']}><AdminCustomers /></Can>} />
            <Route path="wallets" element={<Can perms={['wallets.view', 'wallets.refund', 'banks.verify']}><AdminWallets /></Can>} />
            <Route path="deposits" element={<Can perms={['deposits.view']}><AdminDeposits /></Can>} />
            <Route path="users" element={<Can perms={['users.view']}><AdminUsers /></Can>} />
            <Route path="roles" element={<Can perms={['roles.manage']}><AdminRoles /></Can>} />
            <Route path="account" element={<StaffAccount />} />
            <Route path="settings" element={<StaffSettings />} />
            <Route path="events" element={<Can perms={['events.manage']}><AdminEvents /></Can>} />
            <Route path="tickets" element={<Can perms={['tickets.view']}><AdminTickets /></Can>} />
            <Route path="tickets/:id" element={<Can perms={['tickets.view']}><AdminTicket /></Can>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
  )
}
