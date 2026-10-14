import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CardStylePicker } from '../components/AuctionCard'
const BankAccountCard = lazy(() => import('./owner/Bank').then((m) => ({ default: m.BankAccountCard })))
import { Icon } from '../components/dash'
import type { IconName } from '../components/dash'
import { SettingRow, Switch } from '../components/SettingsUi'
import { ErrorBox, Loading, Modal, PageHead } from '../components/ui'
import { STAFF_LOGIN_PATH } from '../lib/config'
import { dateTime, num, sar } from '../lib/format'
import { api, useApp, useLoad } from '../lib/store'
import type { AdminSettings, AuctionScope, NameType, Preferences, SessionInfo, SettingsPatch, TicketKind, TicketRouting } from '../lib/types'
import { AuctionActionDialog, useAuctionRights } from '../components/AuctionControls'
import type { AuctionAction } from '../components/AuctionControls'
import { can, canAny } from '../lib/permissions'
import type { Permission } from '../lib/permissions'
import { KIND_LABEL, TICKET_KINDS } from '../lib/tickets'
import { NAME_TYPES, TYPE_LABEL } from '../lib/config'

// ───────────────────────── shared pieces ─────────────────────────

type Tab = { id: string; label: string; icon: IconName }

function Tabs({ tabs, value, onChange }: { tabs: Tab[]; value: string; onChange: (id: string) => void }) {
  return (
    <div role="tablist" aria-label="أقسام الإعدادات" className="-mx-4 mb-6 flex gap-1.5 overflow-x-auto border-b border-line px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
          className={`-mb-px flex shrink-0 items-center gap-2 border-b-[3px] px-3.5 py-3 text-[15px] font-bold transition-colors ${value === t.id ? 'border-gold text-pine' : 'border-transparent text-muted hover:text-pine'}`}>
          <Icon name={t.icon} className="h-[18px] w-[18px]" />{t.label}
        </button>
      ))}
    </div>
  )
}

/** the selected tab lives in the address (?tab=) so a reload or a shared link opens the same section */
function useTab(tabs: Tab[]) {
  const [params, setParams] = useSearchParams()
  const id = tabs.some((t) => t.id === params.get('tab')) ? params.get('tab')! : tabs[0].id
  return [id, (next: string) => setParams((p) => { p.set('tab', next); return p }, { replace: true })] as const
}

function Card({ title, sub, icon, children, tone }: { title: string; sub?: ReactNode; icon: IconName; children: ReactNode; tone?: 'danger' }) {
  return (
    <section className={`panel overflow-hidden ${tone === 'danger' ? 'border-bad/30' : ''}`}>
      <header className={`flex items-start gap-3 border-b px-5 py-4 ${tone === 'danger' ? 'border-bad/20 bg-bad/5' : 'border-line/70'}`}>
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${tone === 'danger' ? 'bg-bad/10 text-bad' : 'bg-pine-soft text-pine'}`}><Icon name={icon} className="h-[18px] w-[18px]" /></span>
        <div><h2 className="text-[17px]">{title}</h2>{sub && <p className="mt-0.5 text-[14px] leading-6 text-muted">{sub}</p>}</div>
      </header>
      {children}
    </section>
  )
}

// ───────────────────────── personal: notifications ─────────────────────────

const PREFS: [keyof Preferences, string, string][] = [
  ['notifyOutbid', 'تمت المزايدة عليك', 'رسالة فور تجاوز مزايدتك، لتلحق بالمزاد قبل نهايته.'],
  ['notifyReminders', 'تذكيرات المزادات', 'قبل بداية ونهاية المزادات التي تتابعها بساعة، وعند فتح مزاد تنتظره.'],
  ['notifyResults', 'النتائج والاسترداد', 'الفوز بمزاد أو انتهاؤه، ورد مبالغ الضمان إلى محفظتك.'],
  ['notifyRequests', 'قرارات لجنة الاعتماد', 'قبول أسماء طلبك أو رفضها.'],
]

export function NotificationSettings() {
  const { toast } = useApp()
  const { data, setData } = useLoad(() => api.myPreferences(), [])
  const [busy, setBusy] = useState(false)
  async function toggle(k: keyof Preferences, v: boolean) {
    if (!data) return
    const next = { ...data, [k]: v }
    setData(next)
    setBusy(true)
    try { setData(await api.saveMyPreferences(next)); toast(v ? 'سيصلك هذا التنبيه برسالة' : 'أُوقف هذا التنبيه برسالة') } catch (e) { setData(data); toast((e as Error).message, 'bad') } finally { setBusy(false) }
  }
  if (!data) return <Loading />
  return (
    <Card icon="bell" title="تنبيهات الرسائل" sub="اختر ما يصلك برسالة نصية أو واتساب. تنبيهات المنصة داخل حسابك تصلك دائمًا، وكذلك رسائل الدفع والدعم والأمان.">
      <div className="divide-y divide-line/70">
        {PREFS.map(([k, t, d]) => <SettingRow key={k} title={t} desc={d} control={<Switch checked={data[k]} onChange={(v) => toggle(k, v)} label={t} disabled={busy} />} />)}
      </div>
    </Card>
  )
}

// ───────────────────────── personal: security ─────────────────────────

function PasswordForm() {
  const { toast, settings } = useApp()
  const [f, setF] = useState({ current: '', next: '', again: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const min = settings.passwordMinLength
  const strong = f.next.length >= min && /[A-Za-z؀-ۿ]/.test(f.next) && /\d/.test(f.next)
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (f.next !== f.again) { setErr('كلمتا المرور غير متطابقتين'); return }
    setBusy(true); setErr('')
    try { await api.changePassword(f.current, f.next); setF({ current: '', next: '', again: '' }); toast('تم تغيير كلمة المرور، وخرجت أجهزتك الأخرى من الحساب') } catch (x) { setErr((x as Error).message) } finally { setBusy(false) }
  }
  return (
    <Card icon="lock" title="كلمة المرور" sub={`${min} أحرف على الأقل. بعد التغيير تخرج كل أجهزتك الأخرى من الحساب.`}>
      <form onSubmit={submit} className="space-y-4 p-5">
        {err && <ErrorBox text={err} />}
        <div><label className="label" htmlFor="sp-c">كلمة المرور الحالية</label><input id="sp-c" type="password" className="field" dir="ltr" autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} required /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="sp-n">كلمة المرور الجديدة</label>
            <input id="sp-n" type="password" className="field" dir="ltr" autoComplete="new-password" minLength={min} value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} required />
            {f.next && <p className={`mt-1 text-[13px] font-semibold ${strong ? 'text-ok' : 'text-warn'}`}>{strong ? 'كلمة مرور جيدة' : `استخدم ${min} أحرف على الأقل تجمع حروفًا وأرقامًا`}</p>}
          </div>
          <div><label className="label" htmlFor="sp-a">تأكيد كلمة المرور</label><input id="sp-a" type="password" className="field" dir="ltr" autoComplete="new-password" value={f.again} onChange={(e) => setF({ ...f, again: e.target.value })} required /></div>
        </div>
        <button className="btn-primary" disabled={busy}>{busy ? 'جارٍ الحفظ…' : 'تغيير كلمة المرور'}</button>
      </form>
    </Card>
  )
}

function Devices() {
  const { toast, setUser, user } = useApp()
  const nav = useNavigate()
  const { data, setData, loading } = useLoad(() => api.mySessions(), [])
  const sec = useLoad(() => api.mySecurity(), [])
  const [confirm, setConfirm] = useState(false)
  async function revoke(s: SessionInfo) {
    try { setData(await api.revokeMySession(s.id)); toast('خرج هذا الجهاز من حسابك') } catch (e) { toast((e as Error).message, 'bad') }
  }
  async function everywhere() {
    await api.signOutEverywhere()
    setUser(null)
    nav(user?.role === 'owner' ? '/login' : STAFF_LOGIN_PATH, { replace: true })
  }
  return (
    <Card icon="device" title="الأجهزة المسجّل دخولها" sub={sec.data?.lastLoginAt ? `آخر دخول: ${dateTime(sec.data.lastLoginAt)}` : 'الأجهزة التي دخلت حسابك خلال آخر 30 يومًا.'}>
      {loading && !data ? <Loading /> : (
        <ul className="divide-y divide-line/70">
          {(data ?? []).map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-stone text-muted"><Icon name="device" className="h-[18px] w-[18px]" /></span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 font-bold">{s.device || 'جهاز غير معروف'}{s.current && <span className="pill bg-[#E2F0E8] text-ok">هذا الجهاز</span>}</div>
                <div className="text-[13px] text-muted">دخل {dateTime(s.signedInAt)} · آخر نشاط {dateTime(s.lastActiveAt)}{s.ip ? <> · <span dir="ltr">{s.ip}</span></> : null}</div>
              </div>
              {!s.current && <button className="btn-ghost btn-sm text-bad" onClick={() => revoke(s)}>تسجيل خروج</button>}
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/70 bg-stone/60 px-5 py-4">
        <p className="text-[14px] text-muted">لاحظت جهازًا لا تعرفه؟ اخرج من كل الأجهزة ثم غيّر كلمة المرور.</p>
        <button className="btn-ghost btn-sm border-bad/40 text-bad" onClick={() => setConfirm(true)}>الخروج من كل الأجهزة</button>
      </div>
      <Modal open={confirm} onClose={() => setConfirm(false)} title="الخروج من كل الأجهزة">
        <p className="text-[15px] leading-7">سيخرج حسابك من كل الأجهزة، ومنها هذا الجهاز، وتحتاج إلى تسجيل الدخول من جديد.</p>
        <div className="mt-5 flex gap-2"><button className="btn bg-bad text-paper hover:brightness-110" onClick={everywhere}>خروج من الكل</button><button className="btn-ghost" onClick={() => setConfirm(false)}>إلغاء</button></div>
      </Modal>
    </Card>
  )
}

export function SecuritySettings() {
  return <div className="space-y-6"><PasswordForm /><Devices /></div>
}

function DisplaySettings() {
  return (
    <Card icon="list" title="العرض" sub="يُحفظ اختيارك في هذا المتصفح.">
      <div className="p-5"><div className="mb-2 font-bold">شكل بطاقات المزادات</div><CardStylePicker /></div>
    </Card>
  )
}

// ───────────────────────── owner settings page ─────────────────────────

const OWNER_TABS: Tab[] = [
  { id: 'notifications', label: 'الإشعارات', icon: 'bell' },
  { id: 'security', label: 'الأمان والدخول', icon: 'shield' },
  { id: 'bank', label: 'الحساب البنكي', icon: 'wallet' },
  { id: 'display', label: 'العرض', icon: 'list' },
]

export function OwnerSettings() {
  const [tab, setTab] = useTab(OWNER_TABS)
  return (
    <>
      <PageHead title="الإعدادات" sub="تنبيهات الرسائل، وكلمة المرور والأجهزة المسجّل دخولها، وطريقة العرض. بياناتك الشخصية وصورتك في «حسابي»." />
      <Tabs tabs={OWNER_TABS} value={tab} onChange={setTab} />
      {tab === 'notifications' && <NotificationSettings />}
      {tab === 'security' && <SecuritySettings />}
      {tab === 'bank' && <div className="max-w-2xl space-y-3"><Suspense fallback={<Loading />}><BankAccountCard /></Suspense><p className="text-[13.5px] text-muted">يُستخدم لاسترداد رصيد محفظتك إلى حسابك. بعد اعتماده تطلب الاسترداد من صفحة «المحفظة».</p></div>}
      {tab === 'display' && <DisplaySettings />}
    </>
  )
}

// ───────────────────────── platform settings (super admin) ─────────────────────────

type Draft = Omit<AdminSettings, 'rules' | 'updatedAt' | 'updatedBy'>

const INTAKES: { flag: 'requestsOpen' | 'compoundOpen' | 'resaleAuctionOpen' | 'instantSaleOpen' | 'investmentOpen'; note: 'requestsClosedNote' | 'compoundClosedNote' | 'saleClosedNote' | 'investmentClosedNote'; title: string; desc: string; icon: IconName }[] = [
  { flag: 'requestsOpen', note: 'requestsClosedNote', title: 'طلبات الشعارات', desc: 'طلبات تسجيل أسماء جديدة (ثلاثة أسماء مقترحة بضمان، يُقبل منها اسم واحد) تُراجعها اللجنة ثم تُطرح في المزاد.', icon: 'file' },
  { flag: 'compoundOpen', note: 'compoundClosedNote', title: 'الأسماء المركبة', desc: 'إضافة كلمة إلى اسم يملكه المالك، تُسجَّل بعد اعتماد اللجنة دون مزاد.', icon: 'plus' },
  { flag: 'resaleAuctionOpen', note: 'saleClosedNote', title: 'إعادة البيع بالمزاد', desc: '«بيع اسم»: يعرض المالك اسمه في مزاد إعادة بيع بحد أدنى يحدده.', icon: 'gavel' },
  { flag: 'instantSaleOpen', note: 'saleClosedNote', title: 'البيع الفوري', desc: '«بيع اسم»: يعرض المالك اسمه بسعر ثابت في سوق الأسماء.', icon: 'tag' },
  { flag: 'investmentOpen', note: 'investmentClosedNote', title: 'استثمار الاسم', desc: 'اقتراح أسماء جديدة برسوم دراسة، تُطرح في مزاد عام ولصاحبها نسبة من البيع.', icon: 'coins' },
]

function IntakePanel({ d, set }: { d: Draft; set: (p: SettingsPatch) => void }) {
  const closed = INTAKES.filter((i) => !d[i.flag]).length
  return (
    <div className="space-y-6">
      <div className={`flex items-center gap-3 rounded-xl border p-4 ${closed ? 'border-gold/40 bg-gold-soft text-gold-deep' : 'border-ok/20 bg-[#E2F0E8] text-ok'}`}>
        <Icon name={closed ? 'lock' : 'check'} className="h-5 w-5 shrink-0" />
        <b>{closed ? `${num(closed)} من ${num(INTAKES.length)} خدمات متوقفة عن استقبال الطلبات` : 'كل الخدمات تستقبل طلبات الملاك'}</b>
      </div>
      <Card icon="file" title="استقبال طلبات الملاك" sub="عند الإيقاف يرى المالك رسالتك على صفحة الخدمة ولا يستطيع تقديم طلب جديد. الطلبات القائمة والمزادات الجارية لا تتأثر.">
        <div className="divide-y divide-line/70">
          {INTAKES.map((i) => {
            const open = d[i.flag]
            const sharedNote = i.note === 'saleClosedNote'
            const showNote = !open && !(sharedNote && i.flag === 'instantSaleOpen' && !d.resaleAuctionOpen)
            return (
              <SettingRow key={i.flag}
                title={<span className="flex flex-wrap items-center gap-2"><Icon name={i.icon} className="h-4 w-4 text-muted" />{i.title}<span className={`pill ${open ? 'bg-[#E2F0E8] text-ok' : 'bg-gold-soft text-gold-deep'}`}>{open ? 'مفتوح' : 'متوقف'}</span></span>}
                desc={i.desc}
                control={<Switch checked={open} onChange={(v) => set({ [i.flag]: v })} label={`استقبال ${i.title}`} />}>
                {showNote && (
                  <div className="mt-3">
                    <label className="label" htmlFor={`n-${i.flag}`}>رسالة للملاك {sharedNote ? '(مشتركة بين نوعي البيع)' : ''} <span className="font-normal text-muted">(اختياري)</span></label>
                    <input id={`n-${i.flag}`} className="field" maxLength={300} placeholder="مثال: يعاد الفتح بداية الشهر القادم" value={d[i.note] ?? ''} onChange={(e) => set({ [i.note]: e.target.value })} />
                  </div>
                )}
              </SettingRow>
            )
          })}
        </div>
      </Card>
    </div>
  )
}

function GeneralPanel({ d, set, rules }: { d: Draft; set: (p: SettingsPatch) => void; rules: AdminSettings['rules'] }) {
  const tone = { info: 'bg-info-soft text-info-deep', warn: 'bg-gold-soft text-gold-deep', ok: 'bg-[#E2F0E8] text-ok' }
  const pct = (r: number) => `${Math.round(r * 100)}%`
  return (
    <div className="space-y-6">
      <Card icon="users" title="التسجيل" sub="عند الإيقاف تُخفى صفحة إنشاء الحساب، ويبقى الدخول متاحًا للحسابات الحالية.">
        <SettingRow title="السماح بإنشاء حسابات ملاك جديدة" control={<Switch checked={d.signupOpen} onChange={(v) => set({ signupOpen: v })} label="السماح بإنشاء حسابات جديدة" />} />
      </Card>

      <Card icon="megaphone" title="شريط الإعلان" sub="رسالة قصيرة تظهر أعلى كل صفحات المنصة ولوحات التحكم.">
        <SettingRow title="إظهار الإعلان" control={<Switch checked={d.announcementOn} onChange={(v) => set({ announcementOn: v })} label="إظهار الإعلان" />}>
          <div className="mt-3 space-y-3">
            <textarea className="field min-h-[80px]" maxLength={400} placeholder="مثال: مزاد الأسماء المميزة يبدأ الخميس الساعة 9 مساءً" value={d.announcement ?? ''} onChange={(e) => set({ announcement: e.target.value })} />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[14px] text-muted">اللون</span>
              {(['info', 'warn', 'ok'] as const).map((t) => (
                <button key={t} type="button" onClick={() => set({ announcementTone: t })} aria-pressed={d.announcementTone === t}
                  className={`rounded-full px-3 py-1 text-[13px] font-bold ring-2 ${tone[t]} ${d.announcementTone === t ? 'ring-pine' : 'ring-transparent'}`}>{{ info: 'معلومة', warn: 'تنبيه', ok: 'خبر سار' }[t]}</button>
              ))}
            </div>
            {d.announcement && <div className={`rounded-lg px-4 py-2.5 text-[14.5px] font-semibold ${tone[d.announcementTone]}`}>{d.announcement}</div>}
          </div>
        </SettingRow>
      </Card>

      <Card icon="alert" title="وضع الصيانة" sub="يبقى التصفح وتسجيل الدخول متاحين، وتتوقف للملاك: الطلبات والمزايدة والدفع والبيع. اللجنة والإدارة تعمل كالمعتاد." tone={d.maintenance ? 'danger' : undefined}>
        <SettingRow title={d.maintenance ? 'المنصة في وضع الصيانة الآن' : 'تشغيل وضع الصيانة'} control={<Switch checked={d.maintenance} onChange={(v) => set({ maintenance: v })} label="وضع الصيانة" />}>
          <input className="field mt-3" maxLength={300} placeholder="رسالة تظهر للزوار، مثال: صيانة مجدولة حتى الساعة 2 فجرًا" value={d.maintenanceNote ?? ''} onChange={(e) => set({ maintenanceNote: e.target.value })} />
        </SettingRow>
      </Card>

      <Card icon="users" title="بيانات التواصل" sub="تظهر للزوار في صفحة التواصل وأسفل المنصة.">
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <div><label className="label" htmlFor="g-mail">بريد الدعم</label><input id="g-mail" type="email" className="field" dir="ltr" value={d.supportEmail} onChange={(e) => set({ supportEmail: e.target.value })} /></div>
          <div><label className="label" htmlFor="g-tel">هاتف الدعم</label><input id="g-tel" className="field" dir="ltr" inputMode="tel" value={d.supportPhone} onChange={(e) => set({ supportPhone: e.target.value })} /></div>
          <div><label className="label" htmlFor="g-wa">واتساب</label><input id="g-wa" className="field" dir="ltr" inputMode="tel" placeholder="9665xxxxxxxx" value={d.whatsApp} onChange={(e) => set({ whatsApp: e.target.value })} /></div>
        </div>
      </Card>

      <Card icon="receipt" title="قواعد المنصة والرسوم" sub="مرجع للاطلاع. تُعدَّل من إعدادات الخادم (PlatformOptions) لأنها تؤثر على المبالغ والفواتير.">
        <dl className="grid gap-px bg-line/70 sm:grid-cols-2 lg:grid-cols-3">
          {([
            ['ضمان طلب الشعارات', sar(rules.depositAmount)], ['أسماء في الطلب', num(rules.namesPerRequest)], ['السعر الافتتاحي', sar(rules.openingPrice)],
            ['أقل زيادة في المزايدة', sar(rules.minIncrement)], ['تمديد المزاد عند آخر مزايدة', `${num(rules.extendMinutes)} دقيقة`], ['ضريبة القيمة المضافة', pct(rules.vatRate)],
            ['رسوم دراسة الاستثمار', sar(rules.investFee)], ['نصيب صاحب الاسم المستثمَر', pct(rules.investOwnerShare)], ['أسماء طلب الاستثمار', num(rules.investMaxNames)],
            ['إعلان مزاد إعادة البيع', `${num(rules.resaleNoticeHours)} ساعة`], ['مدة مزاد إعادة البيع', `${num(rules.resaleAuctionDays)} أيام`], ['عمولة إعادة البيع', pct(rules.resaleCommission)],
            ['ضمان دخول مزاد إعادة البيع', sar(rules.resaleBidDeposit)], ['مدة البيع الفوري', `${num(rules.instantSaleHours)} ساعة`], ['عمولة البيع الفوري', pct(rules.instantCommission)],
          ] as [string, string][]).map(([k, v]) => <div key={k} className="bg-paper px-5 py-3"><dt className="text-[13px] text-muted">{k}</dt><dd className="num font-bold">{v}</dd></div>)}
        </dl>
      </Card>
    </div>
  )
}

function NumberField({ id, label, hint, value, min, max, onChange }: { id: string; label: string; hint: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <input id={id} type="number" className="field num" dir="ltr" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <p className="mt-1 text-[13px] text-muted">{hint} ({num(min)}–{num(max)})</p>
    </div>
  )
}

function PolicyPanel({ d, set }: { d: Draft; set: (p: SettingsPatch) => void }) {
  const { toast } = useApp()
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  async function signOutAll() {
    setBusy(true)
    try { const n = await api.signOutEveryone(); toast(`خرج ${num(n)} حساب من كل الأجهزة، وبقيت أنت داخل حسابك`); setConfirm(false) } catch (e) { toast((e as Error).message, 'bad') } finally { setBusy(false) }
  }
  return (
    <div className="space-y-6">
      <Card icon="lock" title="سياسة الدخول وكلمات المرور" sub="تُطبَّق على كل الحسابات. رمز التحقق (OTP) مطلوب دائمًا عند الدخول ولا يمكن إيقافه.">
        <div className="grid gap-5 p-5 sm:grid-cols-2">
          <NumberField id="p-len" label="أقل طول لكلمة المرور" hint="للحسابات الجديدة وعند التغيير" value={d.passwordMinLength} min={8} max={32} onChange={(v) => set({ passwordMinLength: v })} />
          <NumberField id="p-try" label="محاولات خاطئة قبل قفل الدخول" hint="كلمة مرور خاطئة متتالية" value={d.maxLoginAttempts} min={3} max={20} onChange={(v) => set({ maxLoginAttempts: v })} />
          <NumberField id="p-lock" label="مدة قفل الدخول (دقيقة)" hint="بعد بلوغ عدد المحاولات" value={d.lockoutMinutes} min={1} max={1440} onChange={(v) => set({ lockoutMinutes: v })} />
          <NumberField id="p-idle" label="خروج الموظفين بعد خمول (دقيقة)" hint="لوحة اللجنة والإدارة، 0 يعني بدون" value={d.staffIdleMinutes} min={0} max={480} onChange={(v) => set({ staffIdleMinutes: v })} />
        </div>
      </Card>
      <Card icon="alert" title="إجراء طارئ" sub="عند الاشتباه في تسرب بيانات دخول: يخرج كل المستخدمين (ملاكًا وموظفين) من كل الأجهزة فورًا، وتبقى أنت داخل حسابك." tone="danger">
        <div className="p-5"><button className="btn bg-bad text-paper hover:brightness-110" onClick={() => setConfirm(true)}>تسجيل خروج جميع المستخدمين</button></div>
      </Card>
      <Modal open={confirm} onClose={() => setConfirm(false)} title="تسجيل خروج جميع المستخدمين">
        <p className="text-[15px] leading-7">سيخرج كل مستخدمي المنصة من كل الأجهزة ويحتاجون إلى تسجيل الدخول من جديد. المزادات والطلبات لا تتأثر. يُسجَّل الإجراء باسمك في سجل التغييرات.</p>
        <div className="mt-5 flex gap-2"><button className="btn bg-bad text-paper hover:brightness-110" disabled={busy} onClick={signOutAll}>{busy ? 'جارٍ التنفيذ…' : 'تأكيد'}</button><button className="btn-ghost" onClick={() => setConfirm(false)}>إلغاء</button></div>
      </Modal>
    </div>
  )
}

const FIELD_LABEL: Record<string, string> = {
  RequestsOpen: 'استقبال طلبات الشعارات', RequestsClosedNote: 'رسالة إيقاف طلبات الشعارات', CompoundOpen: 'استقبال الأسماء المركبة',
  CompoundClosedNote: 'رسالة إيقاف الأسماء المركبة', ResaleAuctionOpen: 'إعادة البيع بالمزاد', InstantSaleOpen: 'البيع الفوري',
  SaleClosedNote: 'رسالة إيقاف البيع', InvestmentOpen: 'استثمار الاسم', InvestmentClosedNote: 'رسالة إيقاف الاستثمار',
  SignupOpen: 'إنشاء حسابات جديدة', SupportEmail: 'بريد الدعم', SupportPhone: 'هاتف الدعم', WhatsApp: 'واتساب',
  AnnouncementOn: 'شريط الإعلان', Announcement: 'نص الإعلان', AnnouncementTone: 'لون الإعلان', Maintenance: 'وضع الصيانة',
  MaintenanceNote: 'رسالة الصيانة', PasswordMinLength: 'أقل طول لكلمة المرور', MaxLoginAttempts: 'محاولات الدخول قبل القفل',
  LockoutMinutes: 'مدة قفل الدخول', StaffIdleMinutes: 'مهلة خمول الموظفين', SignOutEveryone: 'تسجيل خروج جميع المستخدمين',
  AuctionPause: 'إيقاف مزادات مؤقتًا', AuctionResume: 'استئناف مزادات', AuctionExtend: 'تمديد مزادات', AuctionCancel: 'إلغاء مزادات',
  StaffRole: 'تعديل دور', StaffRoleCreated: 'إنشاء دور', StaffRoleDeleted: 'حذف دور', UserStaffRole: 'تغيير دور موظف',
  TicketRouting: 'مسؤولو الشكاوى والبلاغات', TicketsRestrictToHandlers: 'قصر التذاكر على المسؤولين',
  OwnersReport: 'طباعة أو تصدير بيانات العملاء', BankVerified: 'اعتماد حساب بنكي', BankRejected: 'رفض حساب بنكي', WithdrawalCompleted: 'تنفيذ استرداد إلى البنك',
  WithdrawalRejected: 'رفض طلب استرداد', WithdrawalDirect: 'استرداد مباشر إلى البنك', WalletAdjust: 'تسوية رصيد محفظة', DepositRefund: 'استرداد ضمان',
  'TicketEmails:complaint': 'بريد الشكاوى', 'TicketEmails:report': 'بريد البلاغات', 'TicketEmails:inquiry': 'بريد الاستفسارات', 'TicketEmails:suggestion': 'بريد الاقتراحات',
}

const TONE_LABEL: Record<string, string> = { info: 'معلومة', warn: 'تنبيه', ok: 'خبر سار' }
const showValue = (field: string, v?: string) => (field === 'AnnouncementTone' && v ? TONE_LABEL[v] ?? v : v)

function HistoryPanel() {
  const { data, loading } = useLoad(() => api.settingsHistory(), [])
  if (loading && !data) return <Loading />
  return (
    <Card icon="history" title="سجل التغييرات" sub="كل تغيير في الإعدادات وكل إجراء أمني، بالاسم والوقت.">
      {data?.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-[14.5px]">
            <thead className="bg-stone text-start text-[13px] text-muted"><tr><th className="px-5 py-2.5 text-start font-bold">الوقت</th><th className="px-3 py-2.5 text-start font-bold">الإعداد</th><th className="px-3 py-2.5 text-start font-bold">من</th><th className="px-3 py-2.5 text-start font-bold">إلى</th><th className="px-5 py-2.5 text-start font-bold">بواسطة</th></tr></thead>
            <tbody className="divide-y divide-line/70">
              {data.map((c) => (
                <tr key={c.id}>
                  <td className="whitespace-nowrap px-5 py-2.5 text-muted">{dateTime(c.at)}</td>
                  <td className="px-3 py-2.5 font-bold">{FIELD_LABEL[c.field] ?? c.field}</td>
                  <td className="max-w-[180px] truncate px-3 py-2.5 text-muted" title={c.oldValue}>{c.field === 'SignOutEveryone' ? '—' : showValue(c.field, c.oldValue) || '—'}</td>
                  <td className="max-w-[220px] truncate px-3 py-2.5" title={c.newValue}>{c.field === 'SignOutEveryone' ? `${c.newValue} حساب` : showValue(c.field, c.newValue) || '—'}</td>
                  <td className="whitespace-nowrap px-5 py-2.5">{c.userName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="px-5 py-10 text-center text-muted">لا توجد تغييرات بعد.</p>}
    </Card>
  )
}


// ───────────────────────── complaints, reports and enquiries: who handles them ─────────────────────────

const INBOX_LABEL: Record<TicketKind, string> = { complaint: 'الشكاوى', report: 'البلاغات', inquiry: 'الاستفسارات', suggestion: 'الاقتراحات' }

function TicketsPanel() {
  const { toast } = useApp()
  const { data, setData, loading, error } = useLoad(() => api.ticketRouting(), [])
  const [d, setD] = useState<{ restrictToHandlers: boolean; handlers: TicketRouting['handlers']; emails: TicketRouting['emails'] } | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => { if (data) setD({ restrictToHandlers: data.restrictToHandlers, handlers: { ...data.handlers }, emails: { ...data.emails } }) }, [data])
  if (error) return <ErrorBox text={error} />
  if (loading || !data || !d) return <Loading />
  const repliers = data.staff.filter((s) => s.canReply && s.active)
  const dirty = JSON.stringify(d) !== JSON.stringify({ restrictToHandlers: data.restrictToHandlers, handlers: data.handlers, emails: data.emails })
  const toggle = (k: TicketKind, id: string) => setD({ ...d, handlers: { ...d.handlers, [k]: d.handlers[k]?.includes(id) ? d.handlers[k].filter((x) => x !== id) : [...(d.handlers[k] ?? []), id] } })

  async function save() {
    if (!d) return
    setBusy(true); setErr('')
    try { setData(await api.saveTicketRouting(d)); toast('حُفظ توزيع الشكاوى والبلاغات') } catch (x) { setErr((x as Error).message) } finally { setBusy(false) }
  }

  return (
    <div className={`space-y-6 ${dirty ? 'pb-24' : ''}`}>
      {err && <ErrorBox text={err} />}
      <Card icon="users" title="مين يرد ويعالج كل نوع" sub="تُسند كل تذكرة جديدة تلقائيًا لأقل موظف عنده تذاكر مفتوحة من المسؤولين عن نوعها، ويصل إشعار لكل المسؤولين. إن لم تحدد أحدًا يتولاها كل من لديه صلاحية «الرد على التذاكر».">
        <div className="divide-y divide-line/70">
          {TICKET_KINDS.map((k) => {
            const chosen = d.handlers[k] ?? []
            return (
              <div key={k} className="px-5 py-4">
                <div className="mb-2.5 flex flex-wrap items-center gap-2">
                  <b className="text-[15.5px]">{KIND_LABEL[k].ar}</b>
                  <span className="text-[13px] text-muted">{KIND_LABEL[k].hintAr}</span>
                  <span className={`pill ms-auto ${chosen.length ? 'bg-pine-soft text-pine' : 'bg-stone text-muted'}`}>{chosen.length ? `${num(chosen.length)} مسؤول` : 'كل فريق الدعم'}</span>
                </div>
                {repliers.length ? (
                  <div className="flex flex-wrap gap-2">
                    {repliers.map((s) => {
                      const on = chosen.includes(s.id)
                      return (
                        <button key={s.id} type="button" aria-pressed={on} onClick={() => toggle(k, s.id)}
                          className={`rounded-full border px-3 py-1.5 text-[13.5px] transition ${on ? 'border-pine bg-pine text-paper' : 'border-line bg-paper hover:border-pine/40'}`}>
                          {on && '✓ '}{s.fullName}<span className={`ms-1 text-[12px] ${on ? 'text-paper/70' : 'text-muted'}`}>· {s.staffRoleName}</span>
                        </button>
                      )
                    })}
                  </div>
                ) : <p className="text-sm text-muted">لا يوجد موظفون لديهم صلاحية «الرد على التذاكر». أضفها لدور من «الأدوار والصلاحيات».</p>}
                <div className="mt-3">
                  <label className="label" htmlFor={`em-${k}`}>البريد الذي تصل عليه {INBOX_LABEL[k]} <span className="font-normal text-muted">(اختياري، أكثر من بريد بفاصلة)</span></label>
                  <input id={`em-${k}`} className="field" dir="ltr" placeholder={`${k}@sammha.sa`} value={d.emails[k] ?? ''} onChange={(e) => setD({ ...d, emails: { ...d.emails, [k]: e.target.value } })} />
                </div>
              </div>
            )
          })}
        </div>
      </Card>
      <Card icon="lock" title="من يرى التذاكر">
        <SettingRow title="كل موظف يرى تذاكر الأنواع المسؤول عنها فقط" desc="عند التفعيل لا يرى الموظف إلا تذاكر الأنواع التي أُسند إليها والتذاكر المسندة له. مدير النظام يرى الجميع."
          control={<Switch checked={d.restrictToHandlers} onChange={(v) => setD({ ...d, restrictToHandlers: v })} label="قصر التذاكر على المسؤولين" />} />
      </Card>
      {dirty && (
        <div className="fixed inset-x-0 bottom-[72px] z-30 px-4 lg:bottom-4 lg:ps-72" role="region" aria-label="حفظ التغييرات">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 rounded-xl bg-pine px-5 py-3 text-paper shadow-lift">
            <span className="flex-1 font-bold">تغييرات في توزيع التذاكر لم تُحفظ</span>
            <button className="btn-on-dark btn-sm" disabled={busy} onClick={() => setD({ restrictToHandlers: data.restrictToHandlers, handlers: { ...data.handlers }, emails: { ...data.emails } })}>تراجع</button>
            <button className="btn-gold btn-sm" disabled={busy} onClick={save}>{busy ? 'جارٍ الحفظ…' : 'حفظ'}</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ───────────────────────── auctions: global controls ─────────────────────────

function AuctionsPanel() {
  const rights = useAuctionRights()
  const { data, loading, reload, error } = useLoad(() => api.adminAuctions('active'), [], 15000)
  const [dialog, setDialog] = useState<{ action: AuctionAction; scope: AuctionScope; label: string } | null>(null)
  if (error) return <ErrorBox text={error} />
  if (loading && !data) return <Loading />
  const list = data ?? []
  const t = Date.now()
  const stats = (type?: NameType) => {
    const a = type ? list.filter((x) => x.type === type) : list
    return { total: a.length, live: a.filter((x) => !x.paused && Date.parse(x.startsAt) <= t && Date.parse(x.endsAt) > t).length, scheduled: a.filter((x) => !x.paused && Date.parse(x.startsAt) > t).length, paused: a.filter((x) => x.paused).length }
  }
  const rows: { type?: NameType; label: string }[] = [{ label: 'كل الشعارات' }, ...NAME_TYPES.map((x) => ({ type: x, label: `مزادات ${TYPE_LABEL[x]}` }))]
  return (
    <div className="space-y-6">
      <Card icon="gavel" title="التحكم في كل المزادات" sub={<>يُطبَّق على كل المزادات الجارية والقادمة (أو نوع واحد). لمزاد محدد أو عدة مزادات افتح <Link to="/admin/auctions" className="underline">التحكم في المزادات</Link>. كل إجراء يصل إشعاره للمزايدين ويُسجَّل في سجل التغييرات.</>}>
        <div className="divide-y divide-line/70">
          {rows.map((r) => {
            const st = stats(r.type)
            const scope: AuctionScope = { all: true, type: r.type }
            return (
              <div key={r.label} className={`flex flex-wrap items-center gap-3 px-5 py-4 ${!r.type ? 'bg-stone/50' : ''}`}>
                <div className="min-w-[12rem] flex-1">
                  <b className="text-[15.5px]">{r.label}</b>
                  <p className="mt-0.5 text-[13px] text-muted">
                    <span className="num">{num(st.live)}</span> جارٍ · <span className="num">{num(st.scheduled)}</span> قادم{st.paused ? <> · <span className="num font-bold text-info-deep">{num(st.paused)}</span> متوقف</> : null}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {rights.manage && <>
                    <button className="btn-ghost btn-sm" disabled={!(st.live + st.scheduled)} onClick={() => setDialog({ action: 'pause', scope, label: r.label })}>إيقاف مؤقت</button>
                    <button className="btn-ghost btn-sm" disabled={!st.paused} onClick={() => setDialog({ action: 'resume', scope, label: r.label })}>استئناف</button>
                    <button className="btn-ghost btn-sm" disabled={!st.total} onClick={() => setDialog({ action: 'extend', scope, label: r.label })}>تمديد</button>
                  </>}
                  {rights.cancel && <button className="btn-danger btn-sm" disabled={!st.total} onClick={() => setDialog({ action: 'cancel', scope, label: r.label })}>إلغاء</button>}
                </div>
              </div>
            )
          })}
        </div>
      </Card>
      <AuctionActionDialog action={dialog?.action ?? null} scope={dialog?.scope ?? {}} label={dialog?.label ?? ''} onClose={() => setDialog(null)} onDone={() => reload()} />
    </div>
  )
}

/** Read-only view of which services are open, for committee members. */
function IntakeStatus() {
  const { settings } = useApp()
  return (
    <Card icon="file" title="حالة استقبال الطلبات" sub="يتحكم فيها مدير النظام.">
      <ul className="divide-y divide-line/70">
        {INTAKES.map((i) => (
          <li key={i.flag} className="flex items-center justify-between gap-3 px-5 py-3">
            <span className="flex items-center gap-2 font-bold"><Icon name={i.icon} className="h-4 w-4 text-muted" />{i.title}</span>
            <span className={`pill ${settings[i.flag] ? 'bg-[#E2F0E8] text-ok' : 'bg-gold-soft text-gold-deep'}`}>{settings[i.flag] ? 'مفتوح' : 'متوقف'}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

// ───────────────────────── staff settings page ─────────────────────────

/** every tab and the permission that opens it; each staff member sees only what their role allows */
const STAFF_TABS: (Tab & { perms?: Permission[] })[] = [
  { id: 'intake', label: 'استقبال الطلبات', icon: 'file', perms: ['settings.manage'] },
  { id: 'auctions', label: 'المزادات', icon: 'gavel', perms: ['auctions.manage', 'auctions.cancel'] },
  { id: 'tickets', label: 'الشكاوى والبلاغات', icon: 'alert', perms: ['settings.manage'] },
  { id: 'general', label: 'الإعدادات العامة', icon: 'settings', perms: ['settings.manage'] },
  { id: 'policy', label: 'سياسة الأمان', icon: 'lock', perms: ['security.manage'] },
  { id: 'history', label: 'سجل التغييرات', icon: 'history', perms: ['audit.view'] },
  { id: 'status', label: 'حالة الخدمات', icon: 'file' },
  { id: 'account', label: 'حسابي والأمان', icon: 'shield' },
]

export function StaffSettings() {
  const { user } = useApp()
  const tabs = STAFF_TABS.filter((t) => (!t.perms || canAny(user, t.perms)) && !(t.id === 'status' && can(user, 'settings.manage')))
  return <AdminSettingsPage tabs={tabs} />
}

function AdminSettingsPage({ tabs }: { tabs: Tab[] }) {
  const { toast, reloadSettings, user } = useApp()
  const [tab, setTab] = useTab(tabs)
  const canSettings = canAny(user, ['settings.manage', 'security.manage'])
  const { data, setData, loading, error } = useLoad(() => (canSettings ? api.adminSettings() : Promise.resolve(null)), [])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (data && !draft) setDraft(strip(data)) }, [data, draft])

  const changes = useMemo(() => {
    if (!data || !draft) return {} as SettingsPatch
    const base = strip(data)
    return Object.fromEntries(Object.entries(draft).filter(([k, v]) => (base as Record<string, unknown>)[k] !== v && !((base as Record<string, unknown>)[k] == null && v === ''))) as SettingsPatch
  }, [data, draft])
  const dirty = Object.keys(changes).length

  // leaving with unsaved changes asks first
  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  async function save() {
    setBusy(true)
    try {
      const s = await api.updateSettings(changes)
      setData(s); setDraft(strip(s)); await reloadSettings()
      toast(`حُفظت ${num(dirty)} ${dirty === 1 ? 'تغيير' : 'تغييرات'}، وتظهر للمستخدمين خلال دقيقة`)
    } catch (e) { toast((e as Error).message, 'bad') } finally { setBusy(false) }
  }

  const set = (p: SettingsPatch) => setDraft((d) => (d ? { ...d, ...p } : d))
  const needsData = tab === 'intake' || tab === 'general' || tab === 'policy'
  return (
    <>
      <PageHead title={canSettings ? 'إعدادات المنصة' : 'الإعدادات'} sub={data?.updatedBy ? `آخر تعديل: ${data.updatedBy}${data.updatedAt ? `، ${dateTime(data.updatedAt)}` : ''}` : 'حسب صلاحيات دورك.'} />
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {needsData && (error ? <ErrorBox text={error} /> : loading || !draft || !data ? <Loading /> : (
        <div className={dirty ? 'pb-24' : ''}>
          {tab === 'intake' && <IntakePanel d={draft} set={set} />}
          {tab === 'general' && <GeneralPanel d={draft} set={set} rules={data.rules} />}
          {tab === 'policy' && <PolicyPanel d={draft} set={set} />}
        </div>
      ))}
      {tab === 'history' && <HistoryPanel key={data?.updatedAt} />}
      {tab === 'auctions' && <AuctionsPanel />}
      {tab === 'tickets' && <TicketsPanel />}
      {tab === 'status' && <IntakeStatus />}
      {tab === 'account' && <SecuritySettings />}

      {dirty > 0 && (
        <div className="fixed inset-x-0 bottom-[72px] z-30 px-4 lg:bottom-4 lg:ps-72" role="region" aria-label="حفظ التغييرات">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 rounded-xl bg-pine px-5 py-3 text-paper shadow-lift">
            <span className="flex-1 font-bold">{dirty === 1 ? 'تغيير واحد لم يُحفظ' : `${num(dirty)} تغييرات لم تُحفظ`}</span>
            <button className="btn-on-dark btn-sm" disabled={busy} onClick={() => data && setDraft(strip(data))}>تراجع</button>
            <button className="btn-gold btn-sm" disabled={busy} onClick={save}>{busy ? 'جارٍ الحفظ…' : 'حفظ التغييرات'}</button>
          </div>
        </div>
      )}
    </>
  )
}

function strip(s: AdminSettings): Draft {
  const { rules: _r, updatedAt: _a, updatedBy: _b, ...d } = s
  return {
    ...d,
    requestsClosedNote: d.requestsClosedNote ?? '', compoundClosedNote: d.compoundClosedNote ?? '', saleClosedNote: d.saleClosedNote ?? '',
    investmentClosedNote: d.investmentClosedNote ?? '', announcement: d.announcement ?? '', maintenanceNote: d.maintenanceNote ?? '',
  }
}
