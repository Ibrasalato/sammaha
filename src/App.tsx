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
import { Login, Signup } from './pages/Auth'
import { Contact, Faq, Privacy, Refund, Terms } from './pages/Content'
import Events from './pages/Events'
import Home from './pages/Home'
import ReservedNames from './pages/ReservedNames'
import Verify from './pages/Verify'
import { AdminAuctions, AdminEvents, AdminHome, AdminInvoices, AdminRequests, AdminReview, AdminSchedule, AdminUsers } from './pages/admin/Admin'
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
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />
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
  { to: '/dashboard/profile', label: 'حسابي', icon: 'users' },
]

const ADMIN_NAV: NavItem[] = [
  { to: '/admin', label: 'نظرة عامة', icon: 'home', end: true },
  { to: '/admin/requests', label: 'مراجعة الطلبات', icon: 'shield' },
  { to: '/admin/schedule', label: 'فتح المزادات', icon: 'calendar' },
  { to: '/admin/auctions', label: 'متابعة المزادات', icon: 'gavel' },
  { to: '/admin/invoices', label: 'الفواتير', icon: 'receipt' },
  { to: '/admin/events', label: 'المواعيد والفعاليات', icon: 'list' },
  { to: '/admin/users', label: 'المستخدمون', icon: 'users' },
]

export default function App() {
  return (
    <LangProvider>
      <AppProvider>
        <HashRouter>
          <AppRoutes />
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
          </Route>
          <Route path="admin" element={<Guard roles={['committee', 'admin']}><Shell nav={ADMIN_NAV} title="لجنة الاعتماد" /></Guard>}>
            <Route index element={<AdminHome />} />
            <Route path="requests" element={<AdminRequests />} />
            <Route path="requests/:id" element={<AdminReview />} />
            <Route path="schedule" element={<AdminSchedule />} />
            <Route path="auctions" element={<AdminAuctions />} />
            <Route path="invoices" element={<AdminInvoices />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="events" element={<AdminEvents />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
  )
}
