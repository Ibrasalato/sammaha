import { tr } from '../lib/i18n'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Logo } from '../components/Layout'
import { ErrorBox } from '../components/ui'
import { IS_DEMO } from '../lib/config'
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
        <div className="hero-field relative hidden flex-col justify-between p-10 text-paper lg:flex">
          <div><Logo light className="h-24" /></div>
          <div>
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

  async function submit(e?: FormEvent, l = login, p = password) {
    e?.preventDefault()
    setBusy(true); setErr('')
    try { const u = await api.signIn(l, p); setUser(u); done(u) } catch (x) { setErr((x as Error).message) } finally { setBusy(false) }
  }

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
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-ghost btn-sm" disabled={busy} onClick={() => submit(undefined, '0500000001', '123456')}>{tr('مالك إبل', 'Camel owner')}</button>
            <button className="btn-ghost btn-sm" disabled={busy} onClick={() => submit(undefined, '0500000002', '123456')}>{tr('لجنة الاعتماد', 'Approval committee')}</button>
          </div>
        </div>
      )}
    </AuthFrame>
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
