import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CardStylePicker } from '../components/AuctionCard'
const ActivityPanel = lazy(() => import('./admin/Activity').then((m) => ({ default: m.ActivityPanel })))
const DelegationPanel = lazy(() => import('./owner/Delegation').then((m) => ({ default: m.DelegationPanel })))
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
import { tr } from '../lib/i18n'
import { NAME_TYPES, TYPE_LABEL } from '../lib/config'
import { RegionForm } from '../components/Region'

// ───────────────────────── shared pieces ─────────────────────────

type Tab = { id: string; label: string; icon: IconName }

function Tabs({ tabs, value, onChange }: { tabs: Tab[]; value: string; onChange: (id: string) => void }) {
  return (
    <div role="tablist" aria-label={tr('أقسام الإعدادات', 'Settings sections')} className="-mx-4 mb-6 flex gap-1.5 overflow-x-auto border-b border-line px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
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

const PREFS = (): [keyof Preferences, string, string][] => [
  ['notifyOutbid', tr('تمت المزايدة عليك', 'You were outbid'), tr('رسالة فور تجاوز مزايدتك، لتلحق بالمزاد قبل نهايته.', 'A message as soon as your bid is beaten, so you can get back in before the auction ends.')],
  ['notifyReminders', tr('تذكيرات المزادات', 'Auction reminders'), tr('قبل بداية ونهاية المزادات التي تتابعها بساعة، وعند فتح مزاد تنتظره.', 'One hour before auctions you follow start and end, and when an auction you are waiting for opens.')],
  ['notifyResults', tr('النتائج والاسترداد', 'Results and refunds'), tr('الفوز بمزاد أو انتهاؤه، ورد مبالغ الضمان إلى محفظتك.', 'Winning or the end of an auction, and guarantee refunds to your wallet.')],
  ['notifyRequests', tr('قرارات لجنة الاعتماد', 'Accreditation Committee decisions'), tr('قبول أسماء طلبك أو رفضها.', 'Acceptance or rejection of the names in your request.')],
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
    try { setData(await api.saveMyPreferences(next)); toast(v ? tr('سيصلك هذا التنبيه برسالة', 'You will receive this alert by message') : tr('أُوقف هذا التنبيه برسالة', 'This message alert is turned off')) } catch (e) { setData(data); toast((e as Error).message, 'bad') } finally { setBusy(false) }
  }
  if (!data) return <Loading />
  return (
    <Card icon="bell" title={tr('تنبيهات الرسائل', 'Message alerts')} sub={tr('اختر ما يصلك برسالة نصية أو واتساب. تنبيهات المنصة داخل حسابك تصلك دائمًا، وكذلك رسائل الدفع والدعم والأمان.', 'Choose what you receive by SMS or WhatsApp. In-app notifications always reach you, as do payment, support and security messages.')}>
      <div className="divide-y divide-line/70">
        {PREFS().map(([k, t, d]) => <SettingRow key={k} title={t} desc={d} control={<Switch checked={data[k]} onChange={(v) => toggle(k, v)} label={t} disabled={busy} />} />)}
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
    if (f.next !== f.again) { setErr(tr('كلمتا المرور غير متطابقتين', 'The passwords do not match')); return }
    setBusy(true); setErr('')
    try { await api.changePassword(f.current, f.next); setF({ current: '', next: '', again: '' }); toast(tr('تم تغيير كلمة المرور، وخرجت أجهزتك الأخرى من الحساب', 'Password changed. Your other devices have been signed out')) } catch (x) { setErr((x as Error).message) } finally { setBusy(false) }
  }
  return (
    <Card icon="lock" title={tr('كلمة المرور', 'Password')} sub={tr(`${min} أحرف على الأقل. بعد التغيير تخرج كل أجهزتك الأخرى من الحساب.`, `At least ${min} characters. After the change, all your other devices are signed out.`)}>
      <form onSubmit={submit} className="space-y-4 p-5">
        {err && <ErrorBox text={err} />}
        <div><label className="label" htmlFor="sp-c">{tr('كلمة المرور الحالية', 'Current password')}</label><input id="sp-c" type="password" className="field" dir="ltr" autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} required /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="sp-n">{tr('كلمة المرور الجديدة', 'New password')}</label>
            <input id="sp-n" type="password" className="field" dir="ltr" autoComplete="new-password" minLength={min} value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} required />
            {f.next && <p className={`mt-1 text-[13px] font-semibold ${strong ? 'text-ok' : 'text-warn'}`}>{strong ? tr('كلمة مرور جيدة', 'Good password') : tr(`استخدم ${min} أحرف على الأقل تجمع حروفًا وأرقامًا`, `Use at least ${min} characters with letters and numbers`)}</p>}
          </div>
          <div><label className="label" htmlFor="sp-a">{tr('تأكيد كلمة المرور', 'Confirm password')}</label><input id="sp-a" type="password" className="field" dir="ltr" autoComplete="new-password" value={f.again} onChange={(e) => setF({ ...f, again: e.target.value })} required /></div>
        </div>
        <button className="btn-primary" disabled={busy}>{busy ? tr('جارٍ الحفظ…', 'Saving…') : tr('تغيير كلمة المرور', 'Change password')}</button>
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
    try { setData(await api.revokeMySession(s.id)); toast(tr('خرج هذا الجهاز من حسابك', 'This device has been signed out of your account')) } catch (e) { toast((e as Error).message, 'bad') }
  }
  async function everywhere() {
    await api.signOutEverywhere()
    setUser(null)
    nav(user?.role === 'owner' ? '/login' : STAFF_LOGIN_PATH, { replace: true })
  }
  return (
    <Card icon="device" title={tr('الأجهزة المسجّل دخولها', 'Signed-in devices')} sub={sec.data?.lastLoginAt ? `${tr('آخر دخول', 'Last sign-in')}: ${dateTime(sec.data.lastLoginAt)}` : tr('الأجهزة التي دخلت حسابك خلال آخر 30 يومًا.', 'Devices that signed in to your account in the last 30 days.')}>
      {loading && !data ? <Loading /> : (
        <ul className="divide-y divide-line/70">
          {(data ?? []).map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-stone text-muted"><Icon name="device" className="h-[18px] w-[18px]" /></span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 font-bold">{s.device || tr('جهاز غير معروف', 'Unknown device')}{s.current && <span className="pill bg-[#E2F0E8] text-ok">{tr('هذا الجهاز', 'This device')}</span>}</div>
                <div className="text-[13px] text-muted">{tr('دخل', 'Signed in')} {dateTime(s.signedInAt)} · {tr('آخر نشاط', 'last active')} {dateTime(s.lastActiveAt)}{s.ip ? <> · <span dir="ltr">{s.ip}</span></> : null}</div>
              </div>
              {!s.current && <button className="btn-ghost btn-sm text-bad" onClick={() => revoke(s)}>{tr('تسجيل خروج', 'Sign out')}</button>}
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/70 bg-stone/60 px-5 py-4">
        <p className="text-[14px] text-muted">{tr('لاحظت جهازًا لا تعرفه؟ اخرج من كل الأجهزة ثم غيّر كلمة المرور.', 'Notice a device you don\'t recognize? Sign out of all devices, then change your password.')}</p>
        <button className="btn-ghost btn-sm border-bad/40 text-bad" onClick={() => setConfirm(true)}>{tr('الخروج من كل الأجهزة', 'Sign out of all devices')}</button>
      </div>
      <Modal open={confirm} onClose={() => setConfirm(false)} title={tr('الخروج من كل الأجهزة', 'Sign out of all devices')}>
        <p className="text-[15px] leading-7">{tr('سيخرج حسابك من كل الأجهزة، ومنها هذا الجهاز، وتحتاج إلى تسجيل الدخول من جديد.', 'Your account will be signed out of all devices, including this one, and you will need to sign in again.')}</p>
        <div className="mt-5 flex gap-2"><button className="btn bg-bad text-paper hover:brightness-110" onClick={everywhere}>{tr('خروج من الكل', 'Sign out everywhere')}</button><button className="btn-ghost" onClick={() => setConfirm(false)}>{tr('إلغاء', 'Cancel')}</button></div>
      </Modal>
    </Card>
  )
}

export function SecuritySettings() {
  return <div className="space-y-6"><PasswordForm /><Devices /></div>
}

function DisplaySettings() {
  return (
    <Card icon="list" title={tr('العرض', 'Display')} sub={tr('يُحفظ اختيارك في هذا المتصفح.', 'Your choice is saved in this browser.')}>
      <div className="border-b border-line/70 p-5"><RegionForm /></div>
      <div className="p-5"><div className="mb-2 font-bold">{tr('شكل بطاقات المزادات', 'Auction card style')}</div><CardStylePicker /></div>
    </Card>
  )
}

// ───────────────────────── owner settings page ─────────────────────────

const OWNER_TABS: Tab[] = [
  { id: 'notifications', get label() { return tr('الإشعارات', 'Notifications') }, icon: 'bell' },
  { id: 'security', get label() { return tr('الأمان والدخول', 'Security & sign-in') }, icon: 'shield' },
  { id: 'bank', get label() { return tr('الحساب البنكي', 'Bank account') }, icon: 'wallet' },
  { id: 'delegation', get label() { return tr('تفويض إدارة الحساب', 'Account delegation') }, icon: 'users' },
  { id: 'activity', get label() { return tr('سجل النشاط', 'Activity log') }, icon: 'history' },
  { id: 'display', get label() { return tr('العرض', 'Display') }, icon: 'list' },
]

export function OwnerSettings() {
  const { user } = useApp()
  // a delegate never sees the owner's credentials, bank account or delegation settings
  const tabs = user?.acting ? OWNER_TABS.filter((t) => t.id === 'notifications' || t.id === 'display') : OWNER_TABS
  const [tab, setTab] = useTab(tabs)
  return (
    <>
      <PageHead title={tr('الإعدادات', 'Settings')} sub={tr('تنبيهات الرسائل، وكلمة المرور والأجهزة المسجّل دخولها، والحساب البنكي، والتفويض، وسجل نشاط حسابك. بياناتك الشخصية وصورتك في «حسابي».', 'Message alerts, password and signed-in devices, bank account, delegation and your account activity log. Your personal details and photo are under "My account".')} />
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === 'notifications' && <NotificationSettings />}
      {tab === 'security' && <SecuritySettings />}
      {tab === 'bank' && <div className="max-w-2xl space-y-3"><Suspense fallback={<Loading />}><BankAccountCard /></Suspense><p className="text-[13.5px] text-muted">{tr('يُستخدم لاسترداد رصيد محفظتك إلى حسابك. بعد اعتماده تطلب الاسترداد من صفحة «المحفظة».', 'Used to refund your wallet balance to your account. Once verified, request a refund from the "Wallet" page.')}</p></div>}
      {tab === 'delegation' && <Suspense fallback={<Loading />}><DelegationPanel /></Suspense>}
      {tab === 'activity' && <Suspense fallback={<Loading />}><ActivityPanel owner /></Suspense>}
      {tab === 'display' && <DisplaySettings />}
    </>
  )
}

// ───────────────────────── platform settings (super admin) ─────────────────────────

type Draft = Omit<AdminSettings, 'rules' | 'updatedAt' | 'updatedBy'>

const INTAKES: { flag: 'requestsOpen' | 'compoundOpen' | 'resaleAuctionOpen' | 'instantSaleOpen' | 'investmentOpen'; note: 'requestsClosedNote' | 'compoundClosedNote' | 'saleClosedNote' | 'investmentClosedNote'; title: string; desc: string; icon: IconName }[] = [
  { flag: 'requestsOpen', note: 'requestsClosedNote', get title() { return tr('طلبات الشعارات', 'Mark requests') }, get desc() { return tr('طلبات تسجيل أسماء جديدة (ثلاثة أسماء مقترحة بضمان، يُقبل منها اسم واحد) تُراجعها اللجنة ثم تُطرح في المزاد.', 'Requests to register new names (three proposed names with a guarantee, one accepted), reviewed by the committee and then auctioned.') }, icon: 'file' },
  { flag: 'compoundOpen', note: 'compoundClosedNote', get title() { return tr('الأسماء المركبة', 'Compound names') }, get desc() { return tr('إضافة كلمة إلى اسم يملكه المالك، تُسجَّل بعد اعتماد اللجنة دون مزاد.', 'Adding a word to a name the owner holds; registered after committee approval without an auction.') }, icon: 'plus' },
  { flag: 'resaleAuctionOpen', note: 'saleClosedNote', get title() { return tr('إعادة البيع بالمزاد', 'Resale by auction') }, get desc() { return tr('«بيع اسم»: يعرض المالك اسمه في مزاد إعادة بيع بحد أدنى يحدده.', '"Sell a name": the owner lists their name in a resale auction with a reserve price they set.') }, icon: 'gavel' },
  { flag: 'instantSaleOpen', note: 'saleClosedNote', get title() { return tr('البيع الفوري', 'Instant sale') }, get desc() { return tr('«بيع اسم»: يعرض المالك اسمه بسعر ثابت في سوق الأسماء.', '"Sell a name": the owner lists their name at a fixed price in the names market.') }, icon: 'tag' },
  { flag: 'investmentOpen', note: 'investmentClosedNote', get title() { return tr('استثمار الاسم', 'Name investment') }, get desc() { return tr('اقتراح أسماء جديدة برسوم دراسة، تُطرح في مزاد عام ولصاحبها نسبة من البيع.', 'Proposing new names for a study fee; they go to a public auction and the proposer gets a share of the sale.') }, icon: 'coins' },
]

function IntakePanel({ d, set }: { d: Draft; set: (p: SettingsPatch) => void }) {
  const closed = INTAKES.filter((i) => !d[i.flag]).length
  return (
    <div className="space-y-6">
      <div className={`flex items-center gap-3 rounded-xl border p-4 ${closed ? 'border-gold/40 bg-gold-soft text-gold-deep' : 'border-ok/20 bg-[#E2F0E8] text-ok'}`}>
        <Icon name={closed ? 'lock' : 'check'} className="h-5 w-5 shrink-0" />
        <b>{closed ? tr(`${num(closed)} من ${num(INTAKES.length)} خدمات متوقفة عن استقبال الطلبات`, `${num(closed)} of ${num(INTAKES.length)} services are not accepting requests`) : tr('كل الخدمات تستقبل طلبات الملاك', 'All services are accepting owner requests')}</b>
      </div>
      <Card icon="file" title={tr('استقبال طلبات الملاك', 'Accepting owner requests')} sub={tr('عند الإيقاف يرى المالك رسالتك على صفحة الخدمة ولا يستطيع تقديم طلب جديد. الطلبات القائمة والمزادات الجارية لا تتأثر.', 'When paused, owners see your message on the service page and cannot submit new requests. Existing requests and running auctions are not affected.')}>
        <div className="divide-y divide-line/70">
          {INTAKES.map((i) => {
            const open = d[i.flag]
            const sharedNote = i.note === 'saleClosedNote'
            const showNote = !open && !(sharedNote && i.flag === 'instantSaleOpen' && !d.resaleAuctionOpen)
            return (
              <SettingRow key={i.flag}
                title={<span className="flex flex-wrap items-center gap-2"><Icon name={i.icon} className="h-4 w-4 text-muted" />{i.title}<span className={`pill ${open ? 'bg-[#E2F0E8] text-ok' : 'bg-gold-soft text-gold-deep'}`}>{open ? tr('مفتوح', 'Open') : tr('متوقف', 'Paused')}</span></span>}
                desc={i.desc}
                control={<Switch checked={open} onChange={(v) => set({ [i.flag]: v })} label={`${tr('استقبال', 'Accept')} ${i.title}`} />}>
                {showNote && (
                  <div className="mt-3">
                    <label className="label" htmlFor={`n-${i.flag}`}>{tr('رسالة للملاك', 'Message to owners')} {sharedNote ? tr('(مشتركة بين نوعي البيع)', '(shared by both sale types)') : ''} <span className="font-normal text-muted">({tr('اختياري', 'optional')})</span></label>
                    <input id={`n-${i.flag}`} className="field" maxLength={300} placeholder={tr('مثال: يعاد الفتح بداية الشهر القادم', 'e.g. Reopening at the start of next month')} value={d[i.note] ?? ''} onChange={(e) => set({ [i.note]: e.target.value })} />
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
      <Card icon="users" title={tr('التسجيل', 'Sign-up')} sub={tr('عند الإيقاف تُخفى صفحة إنشاء الحساب، ويبقى الدخول متاحًا للحسابات الحالية.', 'When off, the sign-up page is hidden; existing accounts can still sign in.')}>
        <SettingRow title={tr('السماح بإنشاء حسابات ملاك جديدة', 'Allow new owner accounts')} control={<Switch checked={d.signupOpen} onChange={(v) => set({ signupOpen: v })} label={tr('السماح بإنشاء حسابات جديدة', 'Allow new accounts')} />} />
      </Card>

      <Card icon="megaphone" title={tr('شريط الإعلان', 'Announcement bar')} sub={tr('رسالة قصيرة تظهر أعلى كل صفحات المنصة ولوحات التحكم.', 'A short message shown at the top of every platform page and dashboard.')}>
        <SettingRow title={tr('إظهار الإعلان', 'Show announcement')} control={<Switch checked={d.announcementOn} onChange={(v) => set({ announcementOn: v })} label={tr('إظهار الإعلان', 'Show announcement')} />}>
          <div className="mt-3 space-y-3">
            <textarea className="field min-h-[80px]" maxLength={400} placeholder={tr('مثال: مزاد الأسماء المميزة يبدأ الخميس الساعة 9 مساءً', 'e.g. The premium names auction starts Thursday at 9 pm')} value={d.announcement ?? ''} onChange={(e) => set({ announcement: e.target.value })} />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[14px] text-muted">{tr('اللون', 'Colour')}</span>
              {(['info', 'warn', 'ok'] as const).map((t) => (
                <button key={t} type="button" onClick={() => set({ announcementTone: t })} aria-pressed={d.announcementTone === t}
                  className={`rounded-full px-3 py-1 text-[13px] font-bold ring-2 ${tone[t]} ${d.announcementTone === t ? 'ring-pine' : 'ring-transparent'}`}>{toneLabel(t)}</button>
              ))}
            </div>
            {d.announcement && <div className={`rounded-lg px-4 py-2.5 text-[14.5px] font-semibold ${tone[d.announcementTone]}`}>{d.announcement}</div>}
          </div>
        </SettingRow>
      </Card>

      <Card icon="alert" title={tr('وضع الصيانة', 'Maintenance mode')} sub={tr('يبقى التصفح وتسجيل الدخول متاحين، وتتوقف للملاك: الطلبات والمزايدة والدفع والبيع. اللجنة والإدارة تعمل كالمعتاد.', 'Browsing and sign-in stay available; for owners, requests, bidding, payments and sales pause. The committee and administration work as usual.')} tone={d.maintenance ? 'danger' : undefined}>
        <SettingRow title={d.maintenance ? tr('المنصة في وضع الصيانة الآن', 'The platform is in maintenance mode now') : tr('تشغيل وضع الصيانة', 'Turn on maintenance mode')} control={<Switch checked={d.maintenance} onChange={(v) => set({ maintenance: v })} label={tr('وضع الصيانة', 'Maintenance mode')} />}>
          <input className="field mt-3" maxLength={300} placeholder={tr('رسالة تظهر للزوار، مثال: صيانة مجدولة حتى الساعة 2 فجرًا', 'Message shown to visitors, e.g. Scheduled maintenance until 2 am')} value={d.maintenanceNote ?? ''} onChange={(e) => set({ maintenanceNote: e.target.value })} />
        </SettingRow>
      </Card>

      <Card icon="users" title={tr('بيانات التواصل', 'Contact details')} sub={tr('تظهر للزوار في صفحة التواصل وأسفل المنصة.', 'Shown to visitors on the contact page and in the site footer.')}>
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <div><label className="label" htmlFor="g-mail">{tr('بريد الدعم', 'Support email')}</label><input id="g-mail" type="email" className="field" dir="ltr" value={d.supportEmail} onChange={(e) => set({ supportEmail: e.target.value })} /></div>
          <div><label className="label" htmlFor="g-tel">{tr('هاتف الدعم', 'Support phone')}</label><input id="g-tel" className="field" dir="ltr" inputMode="tel" value={d.supportPhone} onChange={(e) => set({ supportPhone: e.target.value })} /></div>
          <div><label className="label" htmlFor="g-wa">{tr('واتساب', 'WhatsApp')}</label><input id="g-wa" className="field" dir="ltr" inputMode="tel" placeholder="9665xxxxxxxx" value={d.whatsApp} onChange={(e) => set({ whatsApp: e.target.value })} /></div>
        </div>
      </Card>

      <Card icon="receipt" title={tr('قواعد المنصة والرسوم', 'Platform rules and fees')} sub={tr('مرجع للاطلاع. تُعدَّل من إعدادات الخادم (PlatformOptions) لأنها تؤثر على المبالغ والفواتير.', 'For reference. Changed in the server settings (PlatformOptions) because they affect amounts and invoices.')}>
        <dl className="grid gap-px bg-line/70 sm:grid-cols-2 lg:grid-cols-3">
          {([
            [tr('ضمان طلب الشعارات', 'Mark request guarantee'), sar(rules.depositAmount)], [tr('أسماء في الطلب', 'Names per request'), num(rules.namesPerRequest)], [tr('السعر الافتتاحي', 'Opening price'), sar(rules.openingPrice)],
            [tr('أقل زيادة في المزايدة', 'Minimum bid raise'), sar(rules.minIncrement)], [tr('تمديد المزاد عند آخر مزايدة', 'Auction extension on a late bid'), `${num(rules.extendMinutes)} ${tr('دقيقة', 'min')}`], [tr('ضريبة القيمة المضافة', 'VAT'), pct(rules.vatRate)],
            [tr('رسوم دراسة الاستثمار', 'Investment study fee'), sar(rules.investFee)], [tr('نصيب صاحب الاسم المستثمَر', 'Invested name owner\'s share'), pct(rules.investOwnerShare)], [tr('أسماء طلب الاستثمار', 'Names per investment request'), num(rules.investMaxNames)],
            [tr('إعلان مزاد إعادة البيع', 'Resale auction notice'), `${num(rules.resaleNoticeHours)} ${tr('ساعة', 'h')}`], [tr('مدة مزاد إعادة البيع', 'Resale auction duration'), `${num(rules.resaleAuctionDays)} ${tr('أيام', 'days')}`], [tr('عمولة إعادة البيع', 'Resale commission'), pct(rules.resaleCommission)],
            [tr('ضمان دخول مزاد إعادة البيع', 'Resale auction entry guarantee'), sar(rules.resaleBidDeposit)], [tr('مدة البيع الفوري', 'Instant sale duration'), `${num(rules.instantSaleHours)} ${tr('ساعة', 'h')}`], [tr('عمولة البيع الفوري', 'Instant sale commission'), pct(rules.instantCommission)],
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
    try { const n = await api.signOutEveryone(); toast(tr(`خرج ${num(n)} حساب من كل الأجهزة، وبقيت أنت داخل حسابك`, `${num(n)} accounts were signed out of all devices; you remain signed in`)); setConfirm(false) } catch (e) { toast((e as Error).message, 'bad') } finally { setBusy(false) }
  }
  return (
    <div className="space-y-6">
      <Card icon="lock" title={tr('سياسة الدخول وكلمات المرور', 'Sign-in and password policy')} sub={tr('تُطبَّق على كل الحسابات. رمز التحقق (OTP) مطلوب دائمًا عند الدخول ولا يمكن إيقافه.', 'Applies to all accounts. A one-time code (OTP) is always required at sign-in and cannot be turned off.')}>
        <div className="grid gap-5 p-5 sm:grid-cols-2">
          <NumberField id="p-len" label={tr('أقل طول لكلمة المرور', 'Minimum password length')} hint={tr('للحسابات الجديدة وعند التغيير', 'For new accounts and on change')} value={d.passwordMinLength} min={8} max={32} onChange={(v) => set({ passwordMinLength: v })} />
          <NumberField id="p-try" label={tr('محاولات خاطئة قبل قفل الدخول', 'Failed attempts before lockout')} hint={tr('كلمة مرور خاطئة متتالية', 'Consecutive wrong passwords')} value={d.maxLoginAttempts} min={3} max={20} onChange={(v) => set({ maxLoginAttempts: v })} />
          <NumberField id="p-lock" label={tr('مدة قفل الدخول (دقيقة)', 'Lockout duration (minutes)')} hint={tr('بعد بلوغ عدد المحاولات', 'After reaching the attempt limit')} value={d.lockoutMinutes} min={1} max={1440} onChange={(v) => set({ lockoutMinutes: v })} />
          <NumberField id="p-idle" label={tr('خروج الموظفين بعد خمول (دقيقة)', 'Staff sign-out after inactivity (minutes)')} hint={tr('لوحة اللجنة والإدارة، 0 يعني بدون', 'Committee and admin dashboards; 0 means never')} value={d.staffIdleMinutes} min={0} max={480} onChange={(v) => set({ staffIdleMinutes: v })} />
        </div>
      </Card>
      <Card icon="alert" title={tr('إجراء طارئ', 'Emergency action')} sub={tr('عند الاشتباه في تسرب بيانات دخول: يخرج كل المستخدمين (ملاكًا وموظفين) من كل الأجهزة فورًا، وتبقى أنت داخل حسابك.', 'If sign-in details may have leaked: every user (owners and staff) is signed out of all devices immediately, while you stay signed in.')} tone="danger">
        <div className="p-5"><button className="btn bg-bad text-paper hover:brightness-110" onClick={() => setConfirm(true)}>{tr('تسجيل خروج جميع المستخدمين', 'Sign out all users')}</button></div>
      </Card>
      <Modal open={confirm} onClose={() => setConfirm(false)} title={tr('تسجيل خروج جميع المستخدمين', 'Sign out all users')}>
        <p className="text-[15px] leading-7">{tr('سيخرج كل مستخدمي المنصة من كل الأجهزة ويحتاجون إلى تسجيل الدخول من جديد. المزادات والطلبات لا تتأثر. يُسجَّل الإجراء باسمك في سجل التغييرات.', 'All platform users will be signed out of all devices and will need to sign in again. Auctions and requests are not affected. The action is recorded under your name in the change history.')}</p>
        <div className="mt-5 flex gap-2"><button className="btn bg-bad text-paper hover:brightness-110" disabled={busy} onClick={signOutAll}>{busy ? tr('جارٍ التنفيذ…', 'Working…') : tr('تأكيد', 'Confirm')}</button><button className="btn-ghost" onClick={() => setConfirm(false)}>{tr('إلغاء', 'Cancel')}</button></div>
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

const FIELD_LABEL_EN: Record<string, string> = {
  'RequestsOpen': "Accepting mark requests",
  'RequestsClosedNote': "Mark requests pause message",
  'CompoundOpen': "Accepting compound names",
  'CompoundClosedNote': "Compound names pause message",
  'ResaleAuctionOpen': "Resale by auction",
  'InstantSaleOpen': "Instant sale",
  'SaleClosedNote': "Sales pause message",
  'InvestmentOpen': "Name investment",
  'InvestmentClosedNote': "Investment pause message",
  'SignupOpen': "New account sign-up",
  'SupportEmail': "Support email",
  'SupportPhone': "Support phone",
  'WhatsApp': "WhatsApp",
  'AnnouncementOn': "Announcement bar",
  'Announcement': "Announcement text",
  'AnnouncementTone': "Announcement colour",
  'Maintenance': "Maintenance mode",
  'MaintenanceNote': "Maintenance message",
  'PasswordMinLength': "Minimum password length",
  'MaxLoginAttempts': "Sign-in attempts before lockout",
  'LockoutMinutes': "Lockout duration",
  'StaffIdleMinutes': "Staff idle timeout",
  'SignOutEveryone': "Sign out all users",
  'AuctionPause': "Pause auctions",
  'AuctionResume': "Resume auctions",
  'AuctionExtend': "Extend auctions",
  'AuctionCancel': "Cancel auctions",
  'StaffRole': "Edit role",
  'StaffRoleCreated': "Create role",
  'StaffRoleDeleted': "Delete role",
  'UserStaffRole': "Change staff role",
  'TicketRouting': "Complaints & reports handlers",
  'TicketsRestrictToHandlers': "Restrict tickets to handlers",
  'OwnersReport': "Print or export customer data",
  'BankVerified': "Bank account verified",
  'BankRejected': "Bank account rejected",
  'WithdrawalCompleted': "Bank refund completed",
  'WithdrawalRejected': "Refund request rejected",
  'WithdrawalDirect': "Direct bank refund",
  'WalletAdjust': "Wallet balance adjustment",
  'DepositRefund': "Guarantee refund",
  'TicketEmails:complaint': "Complaints email",
  'TicketEmails:report': "Reports email",
  'TicketEmails:inquiry': "Enquiries email",
  'TicketEmails:suggestion': "Suggestions email",
}
const fieldLabel = (f: string) => (FIELD_LABEL[f] ? tr(FIELD_LABEL[f], FIELD_LABEL_EN[f] ?? f) : f)

const TONE_LABEL: Record<string, string> = { info: 'معلومة', warn: 'تنبيه', ok: 'خبر سار' }
const TONE_LABEL_EN: Record<string, string> = { info: 'Info', warn: 'Warning', ok: 'Good news' }
const toneLabel = (t: string) => (TONE_LABEL[t] ? tr(TONE_LABEL[t], TONE_LABEL_EN[t]) : t)
const showValue = (field: string, v?: string) => (field === 'AnnouncementTone' && v ? toneLabel(v) : v === 'مفعّل' ? tr(v, 'On') : v === 'متوقف' ? tr(v, 'Off') : v)

function HistoryPanel() {
  const { data, loading } = useLoad(() => api.settingsHistory(), [])
  if (loading && !data) return <Loading />
  return (
    <Card icon="history" title={tr('سجل التغييرات', 'Change history')} sub={tr('كل تغيير في الإعدادات وكل إجراء أمني، بالاسم والوقت.', 'Every settings change and security action, with name and time.')}>
      {data?.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-[14.5px]">
            <thead className="bg-stone text-start text-[13px] text-muted"><tr><th className="px-5 py-2.5 text-start font-bold">{tr('الوقت', 'Time')}</th><th className="px-3 py-2.5 text-start font-bold">{tr('الإعداد', 'Setting')}</th><th className="px-3 py-2.5 text-start font-bold">{tr('من', 'From')}</th><th className="px-3 py-2.5 text-start font-bold">{tr('إلى', 'To')}</th><th className="px-5 py-2.5 text-start font-bold">{tr('بواسطة', 'By')}</th></tr></thead>
            <tbody className="divide-y divide-line/70">
              {data.map((c) => (
                <tr key={c.id}>
                  <td className="whitespace-nowrap px-5 py-2.5 text-muted">{dateTime(c.at)}</td>
                  <td className="px-3 py-2.5 font-bold">{fieldLabel(c.field)}</td>
                  <td className="max-w-[180px] truncate px-3 py-2.5 text-muted" title={c.oldValue}>{c.field === 'SignOutEveryone' ? '—' : showValue(c.field, c.oldValue) || '—'}</td>
                  <td className="max-w-[220px] truncate px-3 py-2.5" title={c.newValue}>{c.field === 'SignOutEveryone' ? `${c.newValue} ${tr('حساب', 'accounts')}` : showValue(c.field, c.newValue) || '—'}</td>
                  <td className="whitespace-nowrap px-5 py-2.5">{c.userName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="px-5 py-10 text-center text-muted">{tr('لا توجد تغييرات بعد.', 'No changes yet.')}</p>}
    </Card>
  )
}


// ───────────────────────── complaints, reports and enquiries: who handles them ─────────────────────────

const INBOX_LABEL: Record<TicketKind, string> = { get complaint() { return tr('الشكاوى', 'complaints') }, get report() { return tr('البلاغات', 'reports') }, get inquiry() { return tr('الاستفسارات', 'enquiries') }, get suggestion() { return tr('الاقتراحات', 'suggestions') } }

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
    try { setData(await api.saveTicketRouting(d)); toast(tr('حُفظ توزيع الشكاوى والبلاغات', 'Complaints and reports routing saved')) } catch (x) { setErr((x as Error).message) } finally { setBusy(false) }
  }

  return (
    <div className={`space-y-6 ${dirty ? 'pb-24' : ''}`}>
      {err && <ErrorBox text={err} />}
      <Card icon="users" title={tr('مين يرد ويعالج كل نوع', 'Who handles each type')} sub={tr('تُسند كل تذكرة جديدة تلقائيًا لأقل موظف عنده تذاكر مفتوحة من المسؤولين عن نوعها، ويصل إشعار لكل المسؤولين. إن لم تحدد أحدًا يتولاها كل من لديه صلاحية «الرد على التذاكر».', 'Each new ticket is assigned automatically to the handler of its type with the fewest open tickets, and all handlers are notified. If you pick no one, anyone with the "Reply to tickets" permission handles it.')}>
        <div className="divide-y divide-line/70">
          {TICKET_KINDS.map((k) => {
            const chosen = d.handlers[k] ?? []
            return (
              <div key={k} className="px-5 py-4">
                <div className="mb-2.5 flex flex-wrap items-center gap-2">
                  <b className="text-[15.5px]">{tr(KIND_LABEL[k].ar, KIND_LABEL[k].en)}</b>
                  <span className="text-[13px] text-muted">{tr(KIND_LABEL[k].hintAr, KIND_LABEL[k].hintEn)}</span>
                  <span className={`pill ms-auto ${chosen.length ? 'bg-pine-soft text-pine' : 'bg-stone text-muted'}`}>{chosen.length ? `${num(chosen.length)} ${tr('مسؤول', chosen.length === 1 ? 'handler' : 'handlers')}` : tr('كل فريق الدعم', 'Whole support team')}</span>
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
                ) : <p className="text-sm text-muted">{tr('لا يوجد موظفون لديهم صلاحية «الرد على التذاكر». أضفها لدور من «الأدوار والصلاحيات».', 'No staff have the "Reply to tickets" permission. Add it to a role under "Roles & permissions".')}</p>}
                <div className="mt-3">
                  <label className="label" htmlFor={`em-${k}`}>{tr('البريد الذي تصل عليه', 'Email that receives')} {INBOX_LABEL[k]} <span className="font-normal text-muted">({tr('اختياري، أكثر من بريد بفاصلة', 'optional, separate several with commas')})</span></label>
                  <input id={`em-${k}`} className="field" dir="ltr" placeholder={`${k}@sammha.sa`} value={d.emails[k] ?? ''} onChange={(e) => setD({ ...d, emails: { ...d.emails, [k]: e.target.value } })} />
                </div>
              </div>
            )
          })}
        </div>
      </Card>
      <Card icon="lock" title={tr('من يرى التذاكر', 'Who sees tickets')}>
        <SettingRow title={tr('كل موظف يرى تذاكر الأنواع المسؤول عنها فقط', 'Staff see only tickets of the types they handle')} desc={tr('عند التفعيل لا يرى الموظف إلا تذاكر الأنواع التي أُسند إليها والتذاكر المسندة له. مدير النظام يرى الجميع.', 'When on, staff see only tickets of their assigned types and tickets assigned to them. The system administrator sees all.')}
          control={<Switch checked={d.restrictToHandlers} onChange={(v) => setD({ ...d, restrictToHandlers: v })} label={tr('قصر التذاكر على المسؤولين', 'Restrict tickets to handlers')} />} />
      </Card>
      {dirty && (
        <div className="fixed inset-x-0 bottom-[72px] z-30 px-4 lg:bottom-4 lg:ps-72" role="region" aria-label={tr('حفظ التغييرات', 'Save changes')}>
          <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 rounded-xl bg-pine px-5 py-3 text-paper shadow-lift">
            <span className="flex-1 font-bold">{tr('تغييرات في توزيع التذاكر لم تُحفظ', 'Unsaved ticket routing changes')}</span>
            <button className="btn-on-dark btn-sm" disabled={busy} onClick={() => setD({ restrictToHandlers: data.restrictToHandlers, handlers: { ...data.handlers }, emails: { ...data.emails } })}>{tr('تراجع', 'Discard')}</button>
            <button className="btn-gold btn-sm" disabled={busy} onClick={save}>{busy ? tr('جارٍ الحفظ…', 'Saving…') : tr('حفظ', 'Save')}</button>
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
  const rows: { type?: NameType; label: string }[] = [{ label: tr('كل الشعارات', 'All marks') }, ...NAME_TYPES.map((x) => ({ type: x, label: tr(`مزادات ${TYPE_LABEL[x]}`, `${TYPE_LABEL[x]} auctions`) }))]
  return (
    <div className="space-y-6">
      <Card icon="gavel" title={tr('التحكم في كل المزادات', 'Control all auctions')} sub={<>{tr('يُطبَّق على كل المزادات الجارية والقادمة (أو نوع واحد). لمزاد محدد أو عدة مزادات افتح', 'Applies to all running and upcoming auctions (or one type). For one or several specific auctions, open')} <Link to="/admin/auctions" className="underline">{tr('التحكم في المزادات', 'Auction control')}</Link>. {tr('كل إجراء يصل إشعاره للمزايدين ويُسجَّل في سجل التغييرات.', 'Bidders are notified of every action and it is recorded in the change history.')}</>}>
        <div className="divide-y divide-line/70">
          {rows.map((r) => {
            const st = stats(r.type)
            const scope: AuctionScope = { all: true, type: r.type }
            return (
              <div key={r.label} className={`flex flex-wrap items-center gap-3 px-5 py-4 ${!r.type ? 'bg-stone/50' : ''}`}>
                <div className="min-w-[12rem] flex-1">
                  <b className="text-[15.5px]">{r.label}</b>
                  <p className="mt-0.5 text-[13px] text-muted">
                    <span className="num">{num(st.live)}</span> {tr('جارٍ', 'live')} · <span className="num">{num(st.scheduled)}</span> {tr('قادم', 'upcoming')}{st.paused ? <> · <span className="num font-bold text-info-deep">{num(st.paused)}</span> {tr('متوقف', 'paused')}</> : null}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {rights.manage && <>
                    <button className="btn-ghost btn-sm" disabled={!(st.live + st.scheduled)} onClick={() => setDialog({ action: 'pause', scope, label: r.label })}>{tr('إيقاف مؤقت', 'Pause')}</button>
                    <button className="btn-ghost btn-sm" disabled={!st.paused} onClick={() => setDialog({ action: 'resume', scope, label: r.label })}>{tr('استئناف', 'Resume')}</button>
                    <button className="btn-ghost btn-sm" disabled={!st.total} onClick={() => setDialog({ action: 'extend', scope, label: r.label })}>{tr('تمديد', 'Extend')}</button>
                  </>}
                  {rights.cancel && <button className="btn-danger btn-sm" disabled={!st.total} onClick={() => setDialog({ action: 'cancel', scope, label: r.label })}>{tr('إلغاء', 'Cancel')}</button>}
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
    <Card icon="file" title={tr('حالة استقبال الطلبات', 'Request intake status')} sub={tr('يتحكم فيها مدير النظام.', 'Controlled by the system administrator.')}>
      <ul className="divide-y divide-line/70">
        {INTAKES.map((i) => (
          <li key={i.flag} className="flex items-center justify-between gap-3 px-5 py-3">
            <span className="flex items-center gap-2 font-bold"><Icon name={i.icon} className="h-4 w-4 text-muted" />{i.title}</span>
            <span className={`pill ${settings[i.flag] ? 'bg-[#E2F0E8] text-ok' : 'bg-gold-soft text-gold-deep'}`}>{settings[i.flag] ? tr('مفتوح', 'Open') : tr('متوقف', 'Paused')}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

// ───────────────────────── staff settings page ─────────────────────────

/** every tab and the permission that opens it; each staff member sees only what their role allows */
const STAFF_TABS: (Tab & { perms?: Permission[] })[] = [
  { id: 'intake', get label() { return tr('استقبال الطلبات', 'Accepting requests') }, icon: 'file', perms: ['settings.manage'] },
  { id: 'auctions', get label() { return tr('المزادات', 'Auctions') }, icon: 'gavel', perms: ['auctions.manage', 'auctions.cancel'] },
  { id: 'tickets', get label() { return tr('الشكاوى والبلاغات', 'Complaints & reports') }, icon: 'alert', perms: ['settings.manage'] },
  { id: 'general', get label() { return tr('الإعدادات العامة', 'General settings') }, icon: 'settings', perms: ['settings.manage'] },
  { id: 'policy', get label() { return tr('سياسة الأمان', 'Security policy') }, icon: 'lock', perms: ['security.manage'] },
  { id: 'activity', get label() { return tr('سجل النشاط', 'Activity log') }, icon: 'history', perms: ['logs.view'] },
  { id: 'history', get label() { return tr('سجل التغييرات', 'Change history') }, icon: 'history', perms: ['audit.view'] },
  { id: 'status', get label() { return tr('حالة الخدمات', 'Service status') }, icon: 'file' },
  { id: 'account', get label() { return tr('حسابي والأمان', 'My account & security') }, icon: 'shield' },
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
      toast(tr(`حُفظت ${num(dirty)} ${dirty === 1 ? 'تغيير' : 'تغييرات'}، وتظهر للمستخدمين خلال دقيقة`, `Saved ${num(dirty)} ${dirty === 1 ? 'change' : 'changes'}; users will see them within a minute`))
    } catch (e) { toast((e as Error).message, 'bad') } finally { setBusy(false) }
  }

  const set = (p: SettingsPatch) => setDraft((d) => (d ? { ...d, ...p } : d))
  const needsData = tab === 'intake' || tab === 'general' || tab === 'policy'
  return (
    <>
      <PageHead title={canSettings ? tr('إعدادات المنصة', 'Platform settings') : tr('الإعدادات', 'Settings')} sub={data?.updatedBy ? `${tr('آخر تعديل', 'Last changed')}: ${data.updatedBy}${data.updatedAt ? `${tr('، ', ', ')}${dateTime(data.updatedAt)}` : ''}` : tr('حسب صلاحيات دورك.', 'Based on your role permissions.')} />
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {needsData && (error ? <ErrorBox text={error} /> : loading || !draft || !data ? <Loading /> : (
        <div className={dirty ? 'pb-24' : ''}>
          {tab === 'intake' && <IntakePanel d={draft} set={set} />}
          {tab === 'general' && <GeneralPanel d={draft} set={set} rules={data.rules} />}
          {tab === 'policy' && <PolicyPanel d={draft} set={set} />}
        </div>
      ))}
      {tab === 'history' && <HistoryPanel key={data?.updatedAt} />}
      {tab === 'activity' && <Suspense fallback={<Loading />}><ActivityPanel /></Suspense>}
      {tab === 'auctions' && <AuctionsPanel />}
      {tab === 'tickets' && <TicketsPanel />}
      {tab === 'status' && <IntakeStatus />}
      {tab === 'account' && <SecuritySettings />}

      {dirty > 0 && (
        <div className="fixed inset-x-0 bottom-[72px] z-30 px-4 lg:bottom-4 lg:ps-72" role="region" aria-label={tr('حفظ التغييرات', 'Save changes')}>
          <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 rounded-xl bg-pine px-5 py-3 text-paper shadow-lift">
            <span className="flex-1 font-bold">{dirty === 1 ? tr('تغيير واحد لم يُحفظ', '1 unsaved change') : tr(`${num(dirty)} تغييرات لم تُحفظ`, `${num(dirty)} unsaved changes`)}</span>
            <button className="btn-on-dark btn-sm" disabled={busy} onClick={() => data && setDraft(strip(data))}>{tr('تراجع', 'Discard')}</button>
            <button className="btn-gold btn-sm" disabled={busy} onClick={save}>{busy ? tr('جارٍ الحفظ…', 'Saving…') : tr('حفظ التغييرات', 'Save changes')}</button>
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
