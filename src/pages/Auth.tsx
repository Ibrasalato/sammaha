import { tr } from '../lib/i18n'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Logo } from '../components/Layout'
import { ErrorBox } from '../components/ui'
import { OtpForm } from '../components/OtpForm'
import type { OtpChallenge } from '../lib/api'
import { IS_DEMO, SUPER_ADMIN_EMAIL } from '../lib/config'
import { api, useApp } from '../lib/store'
import type { User } from '../lib/types'

function useAfterAuth() {
  const nav = useNavigate()
  const loc = useLocation()
  const from = (loc.state as { from?: string } | null)?.from
  return (u: User) => nav(from || (u.role === 'owner' ? '/dashboard' : '/admin'), { replace: true })
}

function AuthFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="wrap py-12 lg:py-16">
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-xl border border-line bg-paper shadow-card lg:grid-cols-[1fr_1.1fr]">
        <div className="relative hidden flex-col overflow-hidden bg-pine p-10 text-paper lg:flex">
          <img src="./hero/auth-camels.webp" alt="" className="absolute inset-0 h-full w-full object-cover object-bottom" />
          {/* the blue sky becomes brand green; the camels stay in natural colour at the bottom */}
          <div className="absolute inset-0 bg-gradient-to-b from-pine via-pine/90 via-55% to-pine/5" aria-hidden />
          <div className="absolute inset-x-0 bottom-0 h-1 bg-gold" aria-hidden />
          <div className="relative"><Logo light className="h-24" /></div>
          <div className="relative mt-10">
            <h2 className="text-[28px] font-extrabold leading-snug text-paper">{tr('السجل الدولي لأسماء الإبل وشعاراتها', 'The international registry of camel names and marks')}</h2>
            <p className="mt-3 text-paper/70">{tr('اطلب أسماء إبلك، وتابع مزاداتها، واحصل على فواتيرك الإلكترونية من مكان واحد.', 'Request names for your camels, follow their auctions and get your e-invoices in one place.')}</p>
          </div>
        </div>
        <div className="p-6 sm:p-10">
          <div className="mb-6 lg:hidden"><Logo className="h-14" /></div>
          <h1 className="mb-6 text-[26px]">{title}</h1>
          {children}
        </div>
      </div>
    </div>
  )
}

export function Login() {
  const { setUser } = useApp()
  const done = useAfterAuth()
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const [otp, setOtp] = useState<OtpChallenge | null>(null)

  async function submit(e?: FormEvent, l = login, p = password) {
    e?.preventDefault()
    setBusy(true); setErr('')
    try { setOtp(await api.startSignIn(l, p, 'owner')) } catch (x) { setErr((x as Error).message) } finally { setBusy(false) }
  }

  if (otp) return (
    <AuthFrame title={tr('تسجيل الدخول', 'Sign in')}>
      <OtpForm c={otp} onBack={() => setOtp(null)}
        onResend={async () => { const n = await api.resendOtp(otp.challenge); setOtp(n); return n }}
        onVerify={async (code) => { const u = await api.completeSignIn(otp.challenge, code); setUser(u); done(u) }} />
    </AuthFrame>
  )

  return (
    <AuthFrame title={tr('تسجيل الدخول', 'Sign in')}>
      <form onSubmit={submit} className="space-y-4">
        {err && <ErrorBox text={err} />}
        <div><label className="label" htmlFor="l">{tr('رقم الجوال أو البريد الإلكتروني', 'Mobile number or email')}</label><input id="l" className="field" dir="ltr" autoComplete="username" value={login} onChange={(e) => setLogin(e.target.value)} required /></div>
        <div><label className="label" htmlFor="p">{tr('كلمة المرور', 'Password')}</label><input id="p" type="password" className="field" dir="ltr" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
        <button className="btn-primary w-full" disabled={busy}>{tr('دخول', 'Sign in')}</button>
      </form>
      <p className="mt-5 text-center text-sm text-muted">{tr('ليس لديك حساب؟', 'No account yet?')} <Link to="/signup" className="font-semibold text-gold-deep underline underline-offset-4">{tr('أنشئ حسابًا', 'Create one')}</Link></p>
      {IS_DEMO && (
        <div className="mt-6 border-t border-line pt-5">
          <p className="mb-3 text-sm text-muted">{tr('حسابات تجريبية:', 'Demo accounts:')}</p>
          <button className="btn-ghost btn-sm w-full" disabled={busy} onClick={() => submit(undefined, '0500000001', '123456')}>{tr('دخول بحساب مالك إبل تجريبي', 'Try a demo camel-owner account')}</button>
        </div>
      )}
    </AuthFrame>
  )
}

/** Unlisted staff portal: approval committee and super admin. Owners can't sign in here. */
export function StaffLogin() {
  const { user, setUser } = useApp()
  const nav = useNavigate()
  const loc = useLocation()
  const from = (loc.state as { from?: string } | null)?.from
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [otp, setOtp] = useState<OtpChallenge | null>(null)
  if (user && user.role !== 'owner') return <Navigate to="/admin" replace />
  const firstSuper = IS_DEMO && login.trim().toLowerCase() === SUPER_ADMIN_EMAIL

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setErr('')
    try { setOtp(await api.startSignIn(login, password, 'staff')) } catch (x) { setErr((x as Error).message) } finally { setBusy(false) }
  }

  return (
    <div className="hero-field flex min-h-[calc(100vh-0px)] items-center justify-center px-4 py-16">
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-paper shadow-lift">
        <div className="sadu sadu-thin" aria-hidden />
        <div className="p-7 sm:p-9">
          <div className="flex items-center justify-between">
            <Logo className="h-14" />
            <span className="rounded bg-pine-soft px-2.5 py-1 text-[12.5px] font-bold text-pine">بوابة الموظفين</span>
          </div>
          {otp ? (
            <div className="mt-6">
              <OtpForm c={otp} onBack={() => setOtp(null)}
                onResend={async () => { const n = await api.resendOtp(otp.challenge); setOtp(n); return n }}
                onVerify={async (code) => { const u = await api.completeSignIn(otp.challenge, code); setUser(u); nav(from?.startsWith('/admin') ? from : '/admin', { replace: true }) }} />
            </div>
          ) : <>
          <h1 className="mt-6 text-[24px]">دخول لجنة الاعتماد والإدارة</h1>
          <p className="mt-1 text-[14.5px] text-muted">للموظفين المصرّح لهم فقط. الحسابات ينشئها مدير النظام.</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            {err && <ErrorBox text={err} />}
            <div><label className="label" htmlFor="sl">البريد الإلكتروني أو رقم الجوال</label><input id="sl" className="field" dir="ltr" autoComplete="username" value={login} onChange={(e) => setLogin(e.target.value)} required /></div>
            <div>
              <label className="label" htmlFor="sp">كلمة المرور</label>
              <input id="sp" type="password" className="field" dir="ltr" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              {firstSuper && <p className="hint">في النسخة التجريبية: أول دخول لحساب مدير النظام يحفظ كلمة المرور التي تكتبها الآن (8 أحرف على الأقل).</p>}
            </div>
            <button className="btn-primary w-full" disabled={busy}>دخول</button>
          </form>
          </>}
          <p className="mt-6 border-t border-line pt-4 text-center text-[13px] text-muted">نسيت كلمة المرور؟ تواصل مع مدير النظام. <Link to="/" className="font-bold text-pine underline">الصفحة الرئيسية</Link></p>
        </div>
      </div>
    </div>
  )
}

export function Signup() {
  const { setUser } = useApp()
  const done = useAfterAuth()
  const [f, setF] = useState({ fullName: '', phone: '', email: '', nationalId: '', password: '' })
  const [agree, setAgree] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setErr('')
    try { const u = await api.signUp(f); setUser(u); done(u) } catch (x) { setErr((x as Error).message) } finally { setBusy(false) }
  }

  return (
    <AuthFrame title={tr('حساب مالك إبل جديد', 'New camel owner account')}>
      <form onSubmit={submit} className="space-y-4">
        {err && <ErrorBox text={err} />}
        <div><label className="label" htmlFor="n">{tr('الاسم الرباعي', 'Full name')}</label><input id="n" className="field" autoComplete="name" value={f.fullName} onChange={set('fullName')} required minLength={6} /></div>
        <div><label className="label" htmlFor="ph">{tr('رقم الجوال', 'Mobile number')}</label><input id="ph" className="field" dir="ltr" inputMode="tel" placeholder="05xxxxxxxx" value={f.phone} onChange={set('phone')} required /></div>
        <div><label className="label" htmlFor="em">{tr('البريد الإلكتروني', 'Email')}</label><input id="em" type="email" className="field" dir="ltr" value={f.email} onChange={set('email')} required /><p className="hint">{tr('تصلك عليه الفواتير الإلكترونية.', 'Your e-invoices are sent here.')}</p></div>
        <div><label className="label" htmlFor="id">{tr('رقم الهوية أو الإقامة (اختياري)', 'National ID or Iqama (optional)')}</label><input id="id" className="field" dir="ltr" inputMode="numeric" value={f.nationalId} onChange={set('nationalId')} /></div>
        <div><label className="label" htmlFor="pw">{tr('كلمة المرور', 'Password')}</label><input id="pw" type="password" className="field" dir="ltr" autoComplete="new-password" value={f.password} onChange={set('password')} required minLength={6} /></div>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1.5" checked={agree} onChange={(e) => setAgree(e.target.checked)} required /><span>{tr('أوافق على', 'I agree to the')} <Link to="/terms" className="underline">{tr('شروط المزاد وضوابط ربط الأسماء', 'auction terms and name-linking rules')}</Link></span></label>
        <button className="btn-primary w-full" disabled={busy || !agree}>{tr('إنشاء الحساب', 'Create account')}</button>
      </form>
      <p className="mt-5 text-center text-sm text-muted">{tr('لديك حساب؟', 'Have an account?')} <Link to="/login" className="font-semibold text-gold-deep underline underline-offset-4">{tr('سجّل الدخول', 'Sign in')}</Link></p>
    </AuthFrame>
  )
}
