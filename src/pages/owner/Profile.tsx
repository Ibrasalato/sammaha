import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { CityField, CountrySelect, FormSection, GenderField, PhoneField, Req, maxBirthDate } from '../../components/ProfileFields'
import { Icon, SectionCard } from '../../components/dash'
import { OtpForm } from '../../components/OtpForm'
import { ErrorBox } from '../../components/ui'
import type { OtpChallenge } from '../../lib/api'
import { countryName } from '../../lib/countries'
import { api, useApp } from '../../lib/store'
import type { AddressInput, OwnerProfile, PersonalInput } from '../../lib/types'

const STEP: Record<OwnerProfile['missing'][number], { label: string; hint: string; anchor: string }> = {
  personal: { label: 'البيانات الشخصية', hint: 'الاسم الرباعي وتاريخ الميلاد والجنسية', anchor: 'personal' },
  email: { label: 'توثيق البريد الإلكتروني', hint: 'رمز يصل إلى بريدك', anchor: 'email' },
  address: { label: 'العنوان الوطني', hint: 'البلد والمدينة والحي والرمز البريدي', anchor: 'address' },
}

/** dashboard card: what is left to complete the account */
export function ProfileCompletion() {
  const { user } = useApp()
  const p = user?.profile
  if (!p || p.completion >= 100 || !p.missing.length) return null
  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-wrap items-center gap-4 p-5">
        <div className="relative grid h-16 w-16 shrink-0 place-items-center">
          <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden>
            <circle cx="18" cy="18" r="15.5" fill="none" className="stroke-stone-deep" strokeWidth="3.5" />
            <circle cx="18" cy="18" r="15.5" fill="none" className="stroke-gold" strokeWidth="3.5" strokeLinecap="round" strokeDasharray={`${(p.completion / 100) * 97.4} 97.4`} />
          </svg>
          <b className="num text-[15px]">{p.completion}%</b>
        </div>
        <div className="min-w-[12rem] flex-1">
          <h2 className="text-[17px]">أكمل بيانات حسابك</h2>
          <p className="mt-0.5 text-[14px] text-muted">مطلوبة لإصدار الشهادات والفواتير باسمك الكامل وعنوانك.</p>
        </div>
        <Link to="/dashboard/profile#complete" className="btn-gold btn-sm">إكمال البيانات</Link>
      </div>
      <ul className="flex flex-wrap gap-2 border-t border-line/70 px-5 py-3">
        {p.missing.map((m) => (
          <li key={m}><Link to={`/dashboard/profile#${STEP[m].anchor}`} className="flex items-center gap-1.5 rounded-full bg-gold-soft px-3 py-1 text-[13px] font-semibold text-gold-deep hover:brightness-95"><Icon name="alert" className="h-3.5 w-3.5" />{STEP[m].label}</Link></li>
        ))}
      </ul>
    </section>
  )
}

function EmailVerify() {
  const { user, setUser, toast } = useApp()
  const [c, setC] = useState<OtpChallenge | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  if (!user?.profile) return null
  const ok = user.profile.emailVerified
  return (
    <SectionCard title="البريد الإلكتروني" icon="bell">
      <div id="email" className="scroll-mt-24 space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <b className="num" dir="ltr">{user.email}</b>
          <span className={`pill ${ok ? 'bg-[#E2F0E8] text-ok' : 'bg-gold-soft text-gold-deep'}`}>{ok ? '✓ موثّق' : 'غير موثّق'}</span>
        </div>
        {!ok && !c && <>
          <p className="text-[14.5px] text-muted">نرسل رمزًا إلى بريدك لنتأكد أنه صحيح، فتصلك الفواتير والشهادات عليه.</p>
          {err && <ErrorBox text={err} />}
          <button className="btn-primary btn-sm" disabled={busy} onClick={async () => {
            setBusy(true); setErr('')
            try { setC(await api.requestEmailVerification()) } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
          }}>{busy ? 'جارٍ الإرسال…' : 'إرسال رمز التحقق'}</button>
        </>}
        {!ok && c && (
          <OtpForm c={c} title="أدخل الرمز المرسل إلى بريدك" onBack={() => setC(null)}
            onResend={async () => { const n = await api.requestEmailVerification(); setC(n); return n }}
            onVerify={async (code) => { setUser(await api.confirmEmailVerification(c.challenge, code)); setC(null); toast('وُثّق بريدك الإلكتروني') }} />
        )}
        {ok && <p className="text-[14px] text-muted">لتغيير البريد استخدم «بيانات الحساب» أعلاه، وستحتاج لتوثيقه من جديد.</p>}
      </div>
    </SectionCard>
  )
}

function AddressForm() {
  const { user, setUser, toast } = useApp()
  const p = user?.profile
  const [f, setF] = useState<AddressInput>(() => ({
    addressCountry: p?.addressCountry ?? p?.residenceCountry ?? 'SA', addressCity: p?.addressCity ?? p?.residenceCity ?? '', district: p?.district ?? '',
    postalCode: p?.postalCode ?? '', street: p?.street ?? '', altPhoneCountry: p?.altPhone?.startsWith('+') ? '' : '966', altPhone: p?.altPhone ?? '',
  }))
  const [edit, setEdit] = useState(!p?.postalCode)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  if (!p) return null
  const put = <K extends keyof AddressInput>(k: K, v: AddressInput[K]) => setF((x) => ({ ...x, [k]: v }))
  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setErr('')
    try { setUser(await api.updateMyAddress(f)); setEdit(false); toast('حُفظ العنوان') } catch (x) { setErr((x as Error).message) } finally { setBusy(false) }
  }
  return (
    <SectionCard title="العنوان الوطني وأرقام التواصل" icon="home" action={!edit && <button className="btn-ghost btn-sm" onClick={() => setEdit(true)}>تعديل</button>}>
      <div id="address" className="scroll-mt-24 p-5">
        {!edit ? (
          <dl className="grid gap-x-6 gap-y-3 text-[14.5px] sm:grid-cols-2">
            {([['البلد', countryName(p.addressCountry)], ['المدينة', p.addressCity], ['الحي', p.district], ['الرمز البريدي', p.postalCode], ['الشارع', p.street || '—'], ['رقم آخر', p.altPhone || '—']] as [string, string | undefined][]).map(([l, v]) => (
              <div key={l} className="flex justify-between gap-3 border-b border-line/60 pb-2"><dt className="text-muted">{l}</dt><dd className="font-semibold" dir="auto">{v}</dd></div>
            ))}
          </dl>
        ) : (
          <form onSubmit={submit} className="space-y-6">
            {err && <ErrorBox text={err} />}
            <FormSection title="العنوان">
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Req htmlFor="ac">البلد</Req><CountrySelect id="ac" value={f.addressCountry} onChange={(v) => setF((x) => ({ ...x, addressCountry: v, addressCity: '' }))} /></div>
                <div><Req htmlFor="acity">المدينة</Req><CityField id="acity" country={f.addressCountry} value={f.addressCity} onChange={(v) => put('addressCity', v)} /></div>
                <div><Req htmlFor="dist">الحي</Req><input id="dist" className="field" value={f.district} onChange={(e) => put('district', e.target.value)} required /></div>
                <div><Req htmlFor="pc">الرمز البريدي</Req><input id="pc" className="field num" dir="ltr" inputMode="numeric" maxLength={10} value={f.postalCode} onChange={(e) => put('postalCode', e.target.value.replace(/\D/g, ''))} required placeholder="12345" /><p className="hint">أرقام فقط</p></div>
              </div>
              <div><Req htmlFor="st" optional>الشارع</Req><input id="st" className="field" value={f.street} onChange={(e) => put('street', e.target.value)} /></div>
            </FormSection>
            <FormSection title="رقم تواصل آخر" hint="اختياري">
              <PhoneField id="alt" dial={f.altPhoneCountry || '966'} onDial={(v) => put('altPhoneCountry', v)} value={f.altPhone ?? ''} onChange={(v) => put('altPhone', v)} required={false} />
            </FormSection>
            <div className="flex gap-2">
              <button className="btn-primary" disabled={busy}>{busy ? 'جارٍ الحفظ…' : 'حفظ العنوان'}</button>
              {p.postalCode && <button type="button" className="btn-ghost" onClick={() => setEdit(false)}>إلغاء</button>}
            </div>
          </form>
        )}
      </div>
    </SectionCard>
  )
}

/** accounts created before the detailed sign-up fill the personal details once */
function PersonalForm() {
  const { user, setUser, toast } = useApp()
  const p = user?.profile
  const [f, setF] = useState<PersonalInput>(() => {
    const parts = (user?.fullName ?? '').split(/\s+/)
    return {
      firstName: p?.firstName ?? parts[0] ?? '', fatherName: p?.fatherName ?? parts[1] ?? '', grandfatherName: p?.grandfatherName ?? parts[2] ?? '', familyName: p?.familyName ?? parts.slice(3).join(' ') ?? '',
      birthDate: p?.birthDate ?? '', gender: p?.gender ?? '', nationality: p?.nationality ?? 'SA', residenceCountry: p?.residenceCountry ?? 'SA', residenceCity: p?.residenceCity ?? '', nationalId: user?.nationalId ?? '',
    }
  })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  if (!p || !p.missing.includes('personal')) return null
  const put = <K extends keyof PersonalInput>(k: K, v: PersonalInput[K]) => setF((x) => ({ ...x, [k]: v }))
  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setErr('')
    try { setUser(await api.updateMyPersonal(f)); toast('حُفظت بياناتك الشخصية') } catch (x) { setErr((x as Error).message) } finally { setBusy(false) }
  }
  return (
    <SectionCard title="البيانات الشخصية" icon="users">
      <form id="personal" onSubmit={submit} className="scroll-mt-24 space-y-4 p-5">
        <p className="text-[14.5px] text-muted">حسابك أُنشئ قبل تحديث نموذج التسجيل؛ أكمل هذه البيانات مرة واحدة.</p>
        {err && <ErrorBox text={err} />}
        {!user?.nationalId && <div><Req htmlFor="pid">رقم الهوية / الإقامة</Req><input id="pid" className="field" dir="ltr" value={f.nationalId} onChange={(e) => put('nationalId', e.target.value)} required /><p className="hint">ستستخدمه للدخول لحسابك</p></div>}
        <div className="grid grid-cols-2 gap-3">
          <div><Req htmlFor="p1">الاسم الأول</Req><input id="p1" className="field" value={f.firstName} onChange={(e) => put('firstName', e.target.value)} required /></div>
          <div><Req htmlFor="p2">اسم الأب</Req><input id="p2" className="field" value={f.fatherName} onChange={(e) => put('fatherName', e.target.value)} required /></div>
          <div><Req htmlFor="p3">اسم الجد</Req><input id="p3" className="field" value={f.grandfatherName} onChange={(e) => put('grandfatherName', e.target.value)} required /></div>
          <div><Req htmlFor="p4">اسم العائلة</Req><input id="p4" className="field" value={f.familyName} onChange={(e) => put('familyName', e.target.value)} required /></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Req htmlFor="pb">تاريخ الميلاد</Req><input id="pb" type="date" className="field" dir="ltr" max={maxBirthDate()} value={f.birthDate} onChange={(e) => put('birthDate', e.target.value)} required /></div>
          <div><span className="label">الجنس<span className="ms-0.5 text-bad">*</span></span><GenderField value={f.gender} onChange={(v) => put('gender', v)} /></div>
          <div><Req htmlFor="pn">الجنسية</Req><CountrySelect id="pn" value={f.nationality} onChange={(v) => put('nationality', v)} /></div>
          <div><Req htmlFor="pr">بلد الإقامة</Req><CountrySelect id="pr" value={f.residenceCountry} onChange={(v) => setF((x) => ({ ...x, residenceCountry: v, residenceCity: '' }))} /></div>
          <div><Req htmlFor="prc">مدينة الإقامة</Req><CityField id="prc" country={f.residenceCountry} value={f.residenceCity} onChange={(v) => put('residenceCity', v)} /></div>
        </div>
        <button className="btn-primary" disabled={busy}>{busy ? 'جارٍ الحفظ…' : 'حفظ'}</button>
      </form>
    </SectionCard>
  )
}

/** the profile-completion block on «حسابي» */
export function ProfileSections() {
  const { user } = useApp()
  const { hash } = useLocation()
  useEffect(() => {
    if (!hash) return
    const t = setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
    return () => clearTimeout(t)
  }, [hash])
  if (!user?.profile) return null
  const p = user.profile
  return (
    <div id="complete" className="mt-6 scroll-mt-24 space-y-6">
      {p.completion < 100 && (
        <div className="flex items-center gap-3 rounded-xl border border-gold/40 bg-gold-soft px-5 py-3 text-gold-deep">
          <Icon name="alert" className="h-5 w-5 shrink-0" />
          <span className="flex-1 font-semibold">اكتمل حسابك بنسبة <span className="num">{p.completion}%</span>، بقي: {p.missing.map((m) => STEP[m].label).join('، ')}</span>
        </div>
      )}
      {(p.firstName || p.nationality) && !p.missing.includes('personal') && (
        <SectionCard title="البيانات الشخصية" icon="users">
          <dl className="grid gap-x-6 gap-y-3 p-5 text-[14.5px] sm:grid-cols-2">
            {([['رقم الهوية', user.nationalId], ['تاريخ الميلاد', p.birthDate], ['الجنس', p.gender === 'female' ? 'أنثى' : 'ذكر'], ['الجنسية', countryName(p.nationality)], ['الإقامة', `${p.residenceCity ?? ''}، ${countryName(p.residenceCountry)}`]] as [string, string | undefined][]).map(([l, v]) => (
              <div key={l} className="flex justify-between gap-3 border-b border-line/60 pb-2"><dt className="text-muted">{l}</dt><dd className="num font-semibold" dir="auto">{v || '—'}</dd></div>
            ))}
          </dl>
          <p className="px-5 pb-4 text-[13px] text-muted">لتصحيح الاسم أو الهوية تواصل مع الدعم.</p>
        </SectionCard>
      )}
      <PersonalForm />
      <EmailVerify />
      <AddressForm />
    </div>
  )
}
