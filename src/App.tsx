import { useEffect } from 'react'
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
import { AdminTicket, AdminTickets } from './pages/admin/Tickets'
import { MyTickets } from './pages/owner/Tickets'
import { ChatWidget } from './components/ChatWidget'
import Events from './pages/Events'
import Home from './pages/Home'
import ReservedNames from './pages/ReservedNames'
import Verify from './pages/Verify'
import { AdminAuctions, AdminEvents, AdminHome, AdminInvoices, AdminRequests, AdminReview, AdminSchedule } from './pages/admin/Admin'
import { AdminUsers, StaffAccount } from './pages/admin/Users'
import { STAFF_LOGIN_PATH } from './lib/config'
import { CertificatePage, DashHome, InvoicePage, MyBids, MyInvoices, MyNames, ProfilePage, WalletPage } from './pages/owner/Owner'
import { MyRequests, NewRequest, RequestDetail } from './pages/owner/Requests'

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
  { to: '/dashboard/requests', label: 'طلبات الشعارات', icon: 'file' },
  { to: '/dashboard/bids', label: 'مزايداتي', icon: 'gavel' },
  { to: '/dashboard/names', label: 'أسمائي', icon: 'tag' },
  { to: '/dashboard/wallet', label: 'المحفظة', icon: 'wallet' },
  { to: '/dashboard/invoices', label: 'الفواتير', icon: 'receipt' },
  { to: '/dashboard/tickets', label: 'الشكاوى والاستفسارات', icon: 'alert' },
  { to: '/dashboard/profile', label: 'حسابي', icon: 'users' },
]

const ADMIN_NAV: NavItem[] = [
  { to: '/admin', label: 'نظرة عامة', icon: 'home', end: true },
  { to: '/admin/requests', label: 'مراجعة الطلبات', icon: 'shield' },
  { to: '/admin/schedule', label: 'فتح المزادات', icon: 'calendar' },
  { to: '/admin/auctions', label: 'متابعة المزادات', icon: 'gavel' },
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
          <AppRoutes />
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
