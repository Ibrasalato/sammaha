import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { IcoLogo, Logo } from '../components/Layout'
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
          <div className="flex items-center gap-5"><Logo light className="h-16" /><span className="h-12 w-px bg-paper/20" aria-hidden /><IcoLogo light className="h-10" /></div>
          <div>
            <h2 className="text-[28px] font-extrabold leading-snug text-paper">السجل الدولي لأسماء الإبل وشعاراتها</h2>
            <p className="mt-3 text-paper/70">اطلب أسماء إبلك، وتابع مزاداتها، واحصل على فواتيرك الإلكترونية من مكان واحد.</p>
          </div>
          <div className="sadu sadu-thin absolute inset-x-0 bottom-0" aria-hidden />
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
    <AuthFrame title="تسجيل الدخول">
      <form onSubmit={submit} className="space-y-4">
        {err && <ErrorBox text={err} />}
        <div><label className="label" htmlFor="l">رقم الجوال أو البريد الإلكتروني</label><input id="l" className="field" dir="ltr" autoComplete="username" value={login} onChange={(e) => setLogin(e.target.value)} required /></div>
        <div><label className="label" htmlFor="p">كلمة المرور</label><input id="p" type="password" className="field" dir="ltr" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
        <button className="btn-primary w-full" disabled={busy}>دخول</button>
      </form>
      <p className="mt-5 text-center text-sm text-muted">ليس لديك حساب؟ <Link to="/signup" className="font-semibold text-gold-deep underline underline-offset-4">أنشئ حسابًا</Link></p>
      {IS_DEMO && (
        <div className="mt-6 border-t border-line pt-5">
          <p className="mb-3 text-sm text-muted">حسابات تجريبية:</p>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-ghost btn-sm" disabled={busy} onClick={() => submit(undefined, '0500000001', '123456')}>مالك إبل</button>
            <button className="btn-ghost btn-sm" disabled={busy} onClick={() => submit(undefined, '0500000002', '123456')}>لجنة الاعتماد</button>
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
    <AuthFrame title="حساب مالك إبل جديد">
      <form onSubmit={submit} className="space-y-4">
        {err && <ErrorBox text={err} />}
        <div><label className="label" htmlFor="n">الاسم الرباعي</label><input id="n" className="field" autoComplete="name" value={f.fullName} onChange={set('fullName')} required minLength={6} /></div>
        <div><label className="label" htmlFor="ph">رقم الجوال</label><input id="ph" className="field" dir="ltr" inputMode="tel" placeholder="05xxxxxxxx" value={f.phone} onChange={set('phone')} required /></div>
        <div><label className="label" htmlFor="em">البريد الإلكتروني</label><input id="em" type="email" className="field" dir="ltr" value={f.email} onChange={set('email')} required /><p className="hint">تصلك عليه الفواتير الإلكترونية.</p></div>
        <div><label className="label" htmlFor="id">رقم الهوية أو الإقامة (اختياري)</label><input id="id" className="field" dir="ltr" inputMode="numeric" value={f.nationalId} onChange={set('nationalId')} /></div>
        <div><label className="label" htmlFor="pw">كلمة المرور</label><input id="pw" type="password" className="field" dir="ltr" autoComplete="new-password" value={f.password} onChange={set('password')} required minLength={6} /></div>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1.5" checked={agree} onChange={(e) => setAgree(e.target.checked)} required /><span>أوافق على <Link to="/about" className="underline">شروط المزاد وضوابط ربط الأسماء</Link></span></label>
        <button className="btn-primary w-full" disabled={busy || !agree}>إنشاء الحساب</button>
      </form>
      <p className="mt-5 text-center text-sm text-muted">لديك حساب؟ <Link to="/login" className="font-semibold text-gold-deep underline underline-offset-4">سجّل الدخول</Link></p>
    </AuthFrame>
  )
}
