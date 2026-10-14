import { tr } from '../lib/i18n'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Logo } from '../components/Layout'
import { ErrorBox } from '../components/ui'
import { OtpForm } from '../components/OtpForm'
import type { OtpChallenge, SignUpInput } from '../lib/api'
import { CityField, CountrySelect, FormSection, GenderField, PhoneField, Req, maxBirthDate } from '../components/ProfileFields'
import { IS_DEMO, SLOGAN, SUPER_ADMIN_EMAIL } from '../lib/config'
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
            <p className="mb-2 text-[18px] font-bold text-gold-light">{tr(SLOGAN.ar, SLOGAN.en)}</p>
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
        <div><label className="label" htmlFor="l">{tr('رقم الهوية أو الجوال أو البريد الإلكتروني', 'ID, mobile number or email')}</label><input id="l" className="field" dir="ltr" autoComplete="username" value={login} onChange={(e) => setLogin(e.target.value)} required /></div>
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
  const { setUser, settings } = useApp()
  const done = useAfterAuth()
  const [f, setF] = useState<SignUpInput>({
    nationalId: '', firstName: '', fatherName: '', grandfatherName: '', familyName: '', birthDate: '', gender: '',
    nationality: 'SA', residenceCountry: 'SA', residenceCity: '', phoneCountry: '966', phone: '', email: '', password: '',
  })
  const [confirm, setConfirm] = useState('')
  const [agree, setAgree] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const put = <K extends keyof SignUpInput>(k: K, v: SignUpInput[K]) => setF((x) => ({ ...x, [k]: v }))
  const text = (k: keyof SignUpInput) => (e: React.ChangeEvent<HTMLInputElement>) => put(k, e.target.value as never)
  const idHint = f.nationality === 'SA' ? tr('10 أرقام تبدأ بـ 1', '10 digits starting with 1')
    : f.residenceCountry === 'SA' ? tr('رقم الإقامة: 10 أرقام تبدأ بـ 2', 'Iqama: 10 digits starting with 2')
    : tr('رقم الهوية الوطنية أو جواز السفر', 'National ID or passport number')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErr('')
    if (f.password !== confirm) { setErr(tr('كلمتا المرور غير متطابقتين', 'The passwords do not match')); return }
    setBusy(true)
    try { const u = await api.signUp(f); setUser(u); done(u) } catch (x) { setErr((x as Error).message); window.scrollTo({ top: 0, behavior: 'smooth' }) } finally { setBusy(false) }
  }

  if (!settings.signupOpen) return (
    <AuthFrame title={tr('حساب مالك إبل جديد', 'New camel owner account')}>
      <div role="status" className="rounded-xl border border-gold/50 bg-gold-soft p-4 text-[15px] leading-7 text-gold-deep">
        <b className="block text-ink">{tr('التسجيل متوقف مؤقتًا', 'Sign-up is paused')}</b>
        {tr('لا يمكن إنشاء حسابات جديدة حاليًا. إن كان لديك حساب فسجّل الدخول.', 'New accounts cannot be created right now. If you already have one, sign in.')}
      </div>
      <Link to="/login" className="btn-primary mt-5 w-full">{tr('تسجيل الدخول', 'Sign in')}</Link>
    </AuthFrame>
  )

  return (
    <AuthFrame title={tr('حساب مالك إبل جديد', 'New camel owner account')}>
      <form onSubmit={submit} className="space-y-7">
        {err && <ErrorBox text={err} />}
        <FormSection title={tr('البيانات الشخصية', 'Personal details')}>
          <div>
            <Req htmlFor="id">{tr('رقم الهوية / الإقامة', 'National ID / Iqama')}</Req>
            <input id="id" className="field" dir="ltr" autoComplete="off" value={f.nationalId} onChange={text('nationalId')} required minLength={5} maxLength={20} />
            <p className="hint">{tr('سيتم استخدام رقم الهوية للدخول لحسابك', 'Your ID number is used to sign in to your account')} · {idHint}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Req htmlFor="fn">{tr('الاسم الأول', 'First name')}</Req><input id="fn" className="field" autoComplete="given-name" value={f.firstName} onChange={text('firstName')} required /></div>
            <div><Req htmlFor="fa">{tr('اسم الأب', "Father's name")}</Req><input id="fa" className="field" value={f.fatherName} onChange={text('fatherName')} required /></div>
            <div><Req htmlFor="gf">{tr('اسم الجد', "Grandfather's name")}</Req><input id="gf" className="field" value={f.grandfatherName} onChange={text('grandfatherName')} required /></div>
            <div><Req htmlFor="fm">{tr('اسم العائلة', 'Family name')}</Req><input id="fm" className="field" autoComplete="family-name" value={f.familyName} onChange={text('familyName')} required /></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Req htmlFor="bd">{tr('تاريخ الميلاد', 'Date of birth')}</Req><input id="bd" type="date" className="field" dir="ltr" max={maxBirthDate()} value={f.birthDate} onChange={text('birthDate')} required /></div>
            <div><span className="label">{tr('الجنس', 'Gender')}<span className="ms-0.5 text-bad" aria-hidden>*</span></span><GenderField value={f.gender} onChange={(v) => put('gender', v)} /></div>
          </div>
          <div><Req htmlFor="nat">{tr('الجنسية', 'Nationality')}</Req><CountrySelect id="nat" value={f.nationality} onChange={(v) => put('nationality', v)} /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Req htmlFor="rc">{tr('بلد الإقامة', 'Country of residence')}</Req><CountrySelect id="rc" value={f.residenceCountry} onChange={(v) => setF((x) => ({ ...x, residenceCountry: v, residenceCity: '' }))} /></div>
            <div><Req htmlFor="rcity">{tr('مدينة الإقامة', 'City of residence')}</Req><CityField id="rcity" country={f.residenceCountry} value={f.residenceCity} onChange={(v) => put('residenceCity', v)} /></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Req htmlFor="pw">{tr('كلمة المرور', 'Password')}</Req><input id="pw" type="password" className="field" dir="ltr" autoComplete="new-password" value={f.password} onChange={text('password')} required minLength={settings.passwordMinLength} /><p className="hint">{tr(`${settings.passwordMinLength} أحرف على الأقل`, `At least ${settings.passwordMinLength} characters`)}</p></div>
            <div><Req htmlFor="pw2">{tr('تأكيد كلمة المرور', 'Confirm password')}</Req><input id="pw2" type="password" className="field" dir="ltr" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required aria-invalid={!!confirm && confirm !== f.password} />{confirm && confirm !== f.password && <p className="hint text-bad">{tr('غير مطابقة', 'Does not match')}</p>}</div>
          </div>
        </FormSection>

        <FormSection title={tr('بيانات التواصل', 'Contact details')}>
          <div><Req htmlFor="ph">{tr('رقم الجوال', 'Mobile number')}</Req><PhoneField id="ph" dial={f.phoneCountry} onDial={(v) => put('phoneCountry', v)} value={f.phone} onChange={(v) => put('phone', v)} /><p className="hint">{tr('يصلك عليه رمز التحقق عند الدخول.', 'Your sign-in code is sent here.')}</p></div>
          <div><Req htmlFor="em">{tr('البريد الإلكتروني', 'Email')}</Req><input id="em" type="email" className="field" dir="ltr" autoComplete="email" value={f.email} onChange={text('email')} required /><p className="hint">{tr('تصلك عليه الفواتير الإلكترونية، وتوثّقه من لوحة حسابك.', 'Your e-invoices are sent here; verify it from your dashboard.')}</p></div>
        </FormSection>

        <p className="rounded-lg bg-stone px-4 py-3 text-sm leading-6 text-muted">{tr('العنوان الوطني ورقم التواصل الآخر تكملها لاحقًا من لوحة حسابك، ليكون التسجيل سريعًا.', 'You add your national address and a second number later from your dashboard, so sign-up stays quick.')}</p>

        <div className="space-y-4">
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1.5" checked={agree} onChange={(e) => setAgree(e.target.checked)} required /><span>{tr('أوافق على', 'I agree to the')} <Link to="/terms" className="underline">{tr('شروط المزاد وضوابط ربط الأسماء', 'auction terms and name-linking rules')}</Link></span></label>
          <button className="btn-primary w-full" disabled={busy || !agree}>{busy ? tr('جارٍ إنشاء الحساب…', 'Creating…') : tr('إنشاء الحساب', 'Create account')}</button>
        </div>
      </form>
      <p className="mt-5 text-center text-sm text-muted">{tr('لديك حساب؟', 'Have an account?')} <Link to="/login" className="font-semibold text-gold-deep underline underline-offset-4">{tr('سجّل الدخول', 'Sign in')}</Link></p>
    </AuthFrame>
  )
}
