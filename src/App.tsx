import { Suspense, lazy, useEffect } from 'react'
import type { ComponentType } from 'react'
import { PageSkeleton } from './components/Skeleton'
import { usePageTitle } from './lib/usePageTitle'
import type { ReactNode } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { PublicLayout, Shell } from './components/Layout'
import type { NavItem } from './components/Layout'
import { Loading } from './components/ui'
import { LangProvider, tr, useLang } from './lib/i18n'
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
const AdminHome = pick(adminMod, 'AdminHome'), AdminReview = pick(adminMod, 'AdminReview')
const AdminSchedule = pick(adminMod, 'AdminSchedule'), AdminAuctions = pick(adminMod, 'AdminAuctions'), AdminInvoices = pick(adminMod, 'AdminInvoices')
const AdminEvents = pick(adminMod, 'AdminEvents')
const certMod = () => import('./pages/owner/Certificates')
const CertificatesPage = pick(certMod, 'CertificatesPage'), CertificateView = pick(certMod, 'CertificateView'), StaffCertificateView = pick(certMod, 'StaffCertificateView')
const AdminCertificates = pick(() => import('./pages/admin/Certificates'), 'AdminCertificates')
const AdminIcoNames = pick(() => import('./pages/admin/IcoNames'), 'AdminIcoNames')
const AdminOwnerRequests = pick(() => import('./pages/admin/OwnerRequests'), 'AdminOwnerRequests')
const TransfersPage = pick(() => import('./pages/owner/Transfers'), 'TransfersPage')
const ServicesPage = pick(() => import('./pages/owner/Services'), 'ServicesPage')
const PublicServices = pick(() => import('./pages/owner/Services'), 'PublicServices')
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
  [/^\/contact/, 'تواصل معنا', 'Contact'], [/^\/about/, 'عن المنصة', 'About'], [/^\/invest/, 'استثمار الاسم', 'Name investment'], [/^\/services/, 'الخدمات الإلكترونية', 'E-services'], [/^\/market/, 'سوق الأسماء', 'Name market'], [/^\/login/, 'تسجيل الدخول', 'Sign in'], [/^\/signup/, 'إنشاء حساب', 'Sign up'],
  [/^\/dashboard/, 'لوحة التحكم', 'Dashboard'], [/^\/admin/, 'لجنة الاعتماد', 'Committee'], [/^\/ico-staff/, 'بوابة الموظفين', 'Staff'],
]
function RouteTitle() {
  const { pathname } = useLocation()
  // every page change picks up the latest service switches and prices
  const { reloadSettings, toast } = useApp()
  useEffect(() => { void reloadSettings() }, [pathname, reloadSettings])
  // back from the payment page (HyperPay / Moyasar): say how it went
  const { search } = useLocation()
  useEffect(() => {
    const r = new URLSearchParams(search).get('payment')
    if (r === 'paid') toast(tr('تم الدفع بنجاح', 'Payment successful'))
    else if (r === 'pending') toast(tr('الدفع قيد المعالجة لدى البنك، سيصلك إشعار عند اكتماله', 'The payment is being processed by the bank; you will be notified'), 'bad')
    else if (r === 'failed') toast(tr('لم تكتمل عملية الدفع، حاول مرة أخرى', 'The payment did not go through. Please try again'), 'bad')
  }, [search, toast])
  const { lang } = useLang()
  const hit = /^\/auctions\/[^/]+$/.test(pathname) ? null : TITLES.find(([re]) => re.test(pathname))
  usePageTitle(hit === null ? undefined : hit ? (lang === 'ar' ? hit[1] : hit[2]) || undefined : undefined)
  return null
}

function Guard({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, ready } = useApp()
  const loc = useLocation()
  if (!ready) return <Loading />
  // staff pages send visitors to the unlisted staff portal, not the public login
  if (!user) return <Navigate to={roles.includes('owner') ? '/login' : STAFF_LOGIN_PATH} replace state={{ from: loc.pathname }} />
  if (!roles.includes(user.role)) return <Navigate to={user.role === 'owner' ? '/dashboard' : '/admin'} replace />
  return <>{children}</>
}

const OWNER_NAV: NavItem[] = [
  { to: '/dashboard', get label() { return tr('الرئيسية', 'Home') }, icon: 'home', end: true },
  { to: '/dashboard/services', get label() { return tr('الخدمات الإلكترونية', 'E-services') }, get short() { return tr('الخدمات', 'Services') }, icon: 'list', also: ['/dashboard/requests', '/dashboard/invest', '/dashboard/sell', '/dashboard/transfers'] },
  { to: '/dashboard/bids', get label() { return tr('مزايداتي', 'My bids') }, icon: 'gavel' },
  { to: '/dashboard/watchlist', get label() { return tr('قائمة المتابعة', 'Watchlist') }, get short() { return tr('المتابعة', 'Watchlist') }, icon: 'clock' },
  { to: '/dashboard/names', get label() { return tr('أسمائي', 'My names') }, icon: 'tag' },
  { to: '/dashboard/certificates', get label() { return tr('شهاداتي', 'My certificates') }, icon: 'file' },
  { to: '/dashboard/wallet', get label() { return tr('المحفظة', 'Wallet') }, icon: 'wallet' },
  { to: '/dashboard/invoices', get label() { return tr('الفواتير', 'Invoices') }, icon: 'receipt' },
  { to: '/dashboard/tickets', get label() { return tr('الشكاوى والاستفسارات', 'Complaints & enquiries') }, icon: 'alert' },
  { to: '/dashboard/profile', get label() { return tr('حسابي', 'My account') }, icon: 'users' },
  { to: '/dashboard/settings', get label() { return tr('الإعدادات', 'Settings') }, icon: 'settings' },
]

/** each staff page and what opens it: a role sees only the pages its permissions allow */
const ADMIN_NAV: (NavItem & { perms?: Permission[] })[] = [
  { to: '/admin', get label() { return tr('نظرة عامة', 'Overview') }, icon: 'home', end: true },
  { to: '/admin/requests', get label() { return tr('الطلبات', 'Requests') }, icon: 'shield', perms: ['requests.view', 'names.transfer', 'names.logos'] },
  { to: '/admin/schedule', get label() { return tr('فتح المزادات', 'Open auctions') }, get short() { return tr('فتح مزاد', 'Open auction') }, icon: 'calendar', perms: ['auctions.schedule'] },
  { to: '/admin/auctions', get label() { return tr('التحكم في المزادات', 'Auction control') }, get short() { return tr('المزادات', 'Auctions') }, icon: 'gavel', perms: ['auctions.manage', 'auctions.cancel', 'auctions.schedule'] },
  { to: '/admin/reports/marks', get label() { return tr('تقرير الشعارات', 'Marks report') }, get short() { return tr('التقرير', 'Report') }, icon: 'list', perms: ['reports.marks'] },
  { to: '/admin/certificates', get label() { return tr('الشهادات والسجل', 'Certificates & registry') }, get short() { return tr('الشهادات', 'Certificates') }, icon: 'file', perms: ['certificates.manage', 'names.latin'] },
  { to: '/admin/ico-names', get label() { return tr('أسماء المنظمة الدولية', 'Organization names') }, get short() { return tr('أسماء المنظمة', 'ICO names') }, icon: 'tag', perms: ['names.ico'] },
  { to: '/admin/customers', get label() { return tr('بيانات العملاء', 'Customer data') }, get short() { return tr('العملاء', 'Customers') }, icon: 'users', perms: ['owners.view'] },
  { to: '/admin/invoices', get label() { return tr('الفواتير', 'Invoices') }, icon: 'receipt', perms: ['invoices.view'] },
  { to: '/admin/wallets', get label() { return tr('المحافظ والاسترداد', 'Wallets & refunds') }, get short() { return tr('المحافظ', 'Wallets') }, icon: 'wallet', perms: ['wallets.view', 'wallets.refund', 'banks.verify'] },
  { to: '/admin/deposits', get label() { return tr('الضمانات', 'Guarantees') }, icon: 'lock', perms: ['deposits.view'] },
  { to: '/admin/tickets', get label() { return tr('الشكاوى والبلاغات', 'Complaints & reports') }, icon: 'alert', perms: ['tickets.view'] },
  { to: '/admin/events', get label() { return tr('المواعيد والفعاليات', 'Dates & events') }, icon: 'list', perms: ['events.manage'] },
  { to: '/admin/users', get label() { return tr('المستخدمون', 'Users') }, icon: 'users', perms: ['users.view'] },
  { to: '/admin/roles', get label() { return tr('الأدوار والصلاحيات', 'Roles & permissions') }, get short() { return tr('الأدوار', 'Roles') }, icon: 'shield', perms: ['roles.manage'] },
  { to: '/admin/settings', get label() { return tr('الإعدادات', 'Settings') }, icon: 'settings' },
  { to: '/admin/account', get label() { return tr('حسابي', 'My account') }, icon: 'shield' },
]

function AdminShell() {
  const { user } = useApp()
  const nav = ADMIN_NAV.filter((n) => !n.perms || canAny(user, n.perms))
  return <OwnerDirectory><Shell nav={nav} title={user?.role === 'admin' ? tr('إدارة المنصة', 'Platform administration') : user?.staffRoleName || tr('لجنة الاعتماد', 'Accreditation Committee')} /></OwnerDirectory>
}

/** a staff page the role cannot open shows a short notice instead of failing on every call */
function Can({ perms, children }: { perms: Permission[]; children: ReactNode }) {
  const { user } = useApp()
  if (canAny(user, perms)) return <>{children}</>
  return (
    <div className="rounded-xl border border-line bg-paper p-8 text-center">
      <p className="text-lg font-bold">{tr('ليست لديك صلاحية لهذه الصفحة', 'You do not have permission to view this page')}</p>
      <p className="mt-2 text-muted">{tr('اطلب من مدير النظام إضافة الصلاحية إلى دورك.', 'Ask the system administrator to add this permission to your role.')}</p>
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
            <Route path="services" element={<PublicServices />} />
            <Route path="login" element={<Login />} />
            <Route path="signup" element={<Signup />} />
          </Route>
          <Route path="dashboard" element={<Guard roles={['owner']}><Shell nav={OWNER_NAV} title={tr('لوحة التحكم', 'Dashboard')} /></Guard>}>
            <Route index element={<DashHome />} />
            <Route path="requests" element={<MyRequests />} />
            <Route path="requests/new" element={<NewRequest />} />
            <Route path="requests/:id" element={<RequestDetail />} />
            <Route path="bids" element={<MyBids />} />
            <Route path="names" element={<MyNames />} />
            <Route path="services" element={<ServicesPage />} />
            <Route path="transfers" element={<TransfersPage />} />
            <Route path="names/:id/certificate" element={<CertificatePage />} />
            <Route path="certificates" element={<CertificatesPage />} />
            <Route path="certificates/:number" element={<CertificateView />} />
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
            <Route path="requests" element={<Can perms={['requests.view', 'names.transfer', 'names.logos']}><AdminOwnerRequests /></Can>} />
            <Route path="requests/:id" element={<Can perms={['requests.view']}><AdminReview /></Can>} />
            <Route path="schedule" element={<Can perms={['auctions.schedule']}><AdminSchedule /></Can>} />
            <Route path="auctions" element={<Can perms={['auctions.manage', 'auctions.cancel', 'auctions.schedule']}><AdminAuctions /></Can>} />
            <Route path="invoices" element={<Can perms={['invoices.view']}><AdminInvoices /></Can>} />
            <Route path="reports/marks" element={<Can perms={['reports.marks']}><AdminMarksReport /></Can>} />
            <Route path="customers" element={<Can perms={['owners.view']}><AdminCustomers /></Can>} />
            <Route path="certificates" element={<Can perms={['certificates.manage', 'names.latin']}><AdminCertificates /></Can>} />
            <Route path="ico-names" element={<Can perms={['names.ico']}><AdminIcoNames /></Can>} />
            <Route path="transfers" element={<Navigate to="/admin/requests?tab=transfer" replace />} />
            <Route path="logos" element={<Navigate to="/admin/requests?tab=logo" replace />} />
            <Route path="certificates/:number" element={<Can perms={['certificates.manage']}><StaffCertificateView /></Can>} />
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
