import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon } from '../../components/dash'
import { Sheet } from '../../components/AppChrome'
import { FollowBell } from '../../components/Follow'
import { useFines } from '../../components/Fines'
import { ProfileCompletion } from '../owner/Profile'
import { useClosed } from '../../components/SettingsUi'
import { Countdown, Empty, Loading } from '../../components/ui'
import { TYPE_CLS, TYPE_LABEL } from '../../lib/config'
import { phaseOf } from '../../lib/demoApi'
import { date, num, sar } from '../../lib/format'
import { tr } from '../../lib/i18n'
import { api, useApp, useLoad } from '../../lib/store'
import type { Auction, AuctionPhase, NameType } from '../../lib/types'

/* ───────── mobile-app screens (Capacitor only): same API and rules as the website pages ───────── */

type Mark = 'leading' | 'outbid' | 'won' | 'lost' | null

function TypePill({ type }: { type: NameType }) {
  return <span className={`spill ${TYPE_CLS[type].dot}`}>{TYPE_LABEL[type]}</span>
}

export function SoftPill({ type, big }: { type: NameType; big?: boolean }) {
  return <span className={`pill ${TYPE_CLS[type].pill} ${big ? '!px-3 !text-[13.5px]' : ''}`}>{TYPE_LABEL[type]}</span>
}
export function Crown({ className = 'h-4 w-4' }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" aria-hidden><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" /></svg>
}
function Bookmark({ on }: { on: boolean }) {
  return <svg viewBox="0 0 24 24" className="h-5 w-5" fill={on ? '#B98A2E' : 'none'} stroke={on ? '#B98A2E' : 'currentColor'} strokeWidth="1.9" strokeLinejoin="round"><path d="M6 3h12v18l-6-4-6 4z" /></svg>
}
export function TimerPill({ a, phase }: { a: Auction; phase: AuctionPhase }) {
  const left = Date.parse(phase === 'scheduled' ? a.startsAt : a.endsAt) - Date.now()
  const urgent = phase === 'live' && left < 3600_000
  return (
    <span className={`flex h-10 items-center justify-center gap-1.5 rounded-xl px-2 text-[15px] font-extrabold ${phase === 'ended' ? 'bg-stone text-muted' : urgent ? 'bg-[#FDECEE] text-bad' : 'bg-info-soft text-info-deep'}`}>
      <Icon name="clock" className="h-[18px] w-[18px]" />
      {a.paused ? tr('متوقف', 'Paused') : phase === 'live' ? <Countdown to={a.endsAt} /> : phase === 'scheduled' ? <><span className="text-[12px] font-bold">{tr('يبدأ', 'Starts')}</span><Countdown to={a.startsAt} /></> : <span className="text-[13px]">{tr('انتهى', 'Ended')}</span>}
    </span>
  )
}

/** One auction as a card: name and type, price, bookmark and bell, time left and the bid button; my position when I bid. */
export function AuctionTile({ a, mark, mine, watching, onWatch }: { a: Auction; mark?: Mark; mine?: number; watching?: boolean; onWatch?: () => void }) {
  const phase: AuctionPhase = a.paused ? 'live' : phaseOf(a)
  const ended = phase === 'ended'
  const price = a.finalPrice ?? a.currentPrice
  const m = mark ?? (a.isLeader && !ended ? 'leading' : null)
  return (
    <Link to={`/auctions/${a.id}`} className={`app-card block !p-3.5 ${m === 'leading' ? '!border-2 !border-ok/50' : m === 'outbid' ? '!border-2 !border-bad/40' : ''} ${a.paused ? 'opacity-80' : ''}`}>
      <div className="grid grid-cols-2">
        <div className="min-w-0 border-e border-line/80 pe-3 text-start">
          <SoftPill type={a.type} />
          <b className="mt-1 block truncate text-[23px] font-extrabold leading-tight">{a.name}</b>
          <span className="text-[13px] text-muted"><span className="num">{num(a.bidCount)}</span> {tr('مزايدات', 'bids')}</span>
        </div>
        <div className="min-w-0 ps-3 text-end">
          <div className="flex items-center justify-end gap-1">
            <FollowBell a={a} myBid={mine} />
            {onWatch && (
              <button type="button" className="grid h-9 w-9 place-items-center text-muted" aria-pressed={!!watching} aria-label={tr('احفظ في المتابعة', 'Save')} onClick={(e) => { e.preventDefault(); e.stopPropagation(); onWatch() }}><Bookmark on={!!watching} /></button>
            )}
          </div>
          <span className="num block text-[24px] font-extrabold leading-tight">{sar(price)}</span>
          <span className="text-[12.5px] text-muted">{ended ? tr('سعر الترسية', 'Hammer price') : a.bidCount ? tr('أعلى مزايدة', 'Top bid') : tr('السعر الافتتاحي', 'Opening price')}</span>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <TimerPill a={a} phase={phase} />
        {phase === 'live' && !a.paused ? <span className="flex h-10 items-center justify-center rounded-xl bg-pine text-[16px] font-extrabold text-paper shadow-sm">{tr('زايد الآن', 'Bid now')}</span>
          : <span className="flex h-10 items-center justify-center rounded-xl border border-line text-[14px] font-bold text-muted">{phase === 'scheduled' ? tr('قريبًا', 'Soon') : tr('عرض النتيجة', 'See result')}</span>}
      </div>
      {mine !== undefined && m && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-stone/70 px-2.5 py-2">
          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[12.5px] font-extrabold ${m === 'leading' ? 'border-ok/40 bg-[#E2F0E8] text-ok' : m === 'outbid' ? 'border-bad/30 bg-bad/10 text-bad' : m === 'won' ? 'border-gold/50 bg-gold-soft text-gold-deep' : 'border-line text-muted'}`}>
            {m === 'leading' ? <><Crown className="h-3.5 w-3.5" />{tr('أنت متصدر حاليًا', 'You are leading')}</> : m === 'outbid' ? tr('تم تجاوز مزايدتك', 'You were outbid') : m === 'won' ? tr('فزت بالمزاد', 'You won') : tr('لم يرسُ عليك', 'Not won')}
          </span>
          <span className="text-[12.5px] text-muted">{tr('مزايدتك الأخيرة:', 'Your last bid:')} <b className="num text-ink">{sar(mine)}</b></span>
        </div>
      )}
    </Link>
  )
}

function Chips<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="app-chips" role="tablist">
      {options.map(([v, l]) => <button key={v} role="tab" aria-selected={v === value} className={`app-chip ${v === value ? 'on' : ''}`} onClick={() => onChange(v)}>{l}</button>)}
    </div>
  )
}

type SortKey = 'ending' | 'price' | 'bids' | 'new'
const SORTS = (): [SortKey, string][] => [['ending', tr('ينتهي قريبًا', 'Ending soon')], ['price', tr('الأعلى سعرًا', 'Highest price')], ['bids', tr('الأكثر مزايدات', 'Most bids')], ['new', tr('الأحدث', 'Newest')]]
function sortAuctions(list: Auction[], k: SortKey) {
  const x = [...list]
  if (k === 'ending') x.sort((a, b) => Date.parse(a.endsAt) - Date.parse(b.endsAt))
  if (k === 'price') x.sort((a, b) => b.currentPrice - a.currentPrice)
  if (k === 'bids') x.sort((a, b) => b.bidCount - a.bidCount)
  if (k === 'new') x.sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt))
  return x
}

/** «المزادات»: all auctions / my bids / watchlist, in one screen. */
export function NativeAuctions() {
  const { user } = useApp()
  const nav = useNavigate()
  const [tab, setTab] = useState<'all' | 'mine' | 'watch'>('all')
  const [phase, setPhase] = useState<AuctionPhase | 'all'>('live')
  const [type, setType] = useState<NameType | 'all'>('all')
  const [q, setQ] = useState('')
  const [filt, setFilt] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)
  const [sort, setSort] = useState<SortKey>('ending')
  const all = useLoad(() => api.listAuctions({ phase, type, q }), [phase, type, q], 15000)
  const bids = useLoad(() => (user?.role === 'owner' ? api.myBids() : Promise.resolve([])), [user?.id], 15000)
  const watch = useLoad(() => (user?.role === 'owner' ? api.myWatchlist() : Promise.resolve([])), [user?.id], 15000)
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined
    const stop = api.subscribeLive?.({ onAuction: () => { t ??= setTimeout(() => { t = undefined; all.reload() }, 1000) } })
    return () => { clearTimeout(t); stop?.() }
  }, [all.reload]) // eslint-disable-line react-hooks/exhaustive-deps
  const owner = user?.role === 'owner'
  const myBid = useMemo(() => new Map((bids.data ?? []).map((b) => [b.auctionId, b])), [bids.data])
  const watched = useMemo(() => new Set((watch.data ?? []).map((a) => a.id)), [watch.data])
  const markOf = (a: Auction): Mark => {
    const b = myBid.get(a.id)
    if (!b) return null
    if (phaseOf(a) === 'ended') return a.isWinner ? 'won' : 'lost'
    return a.isLeader ? 'leading' : 'outbid'
  }
  async function toggle(id: string) { try { await api.toggleWatch(id); watch.reload() } catch { /* sign-in lost */ } }
  const needLogin = (tab !== 'all') && !owner

  return (
    <div>
      <h1 className="sr-only">{tr('المزادات', 'Auctions')}</h1>
      <div className="app-seg" role="tablist">
        {([['all', `${tr('كل المزادات', 'All auctions')}${all.data ? ` (${num(all.data.length)})` : ''}`], ['mine', `${tr('مزايداتي', 'My bids')}${bids.data?.length ? ` (${num(bids.data.length)})` : ''}`], ...(tab === 'watch' ? [['watch', tr('المتابعة', 'Watching')]] : [])] as ['all' | 'mine' | 'watch', string][]).map(([v, l]) => (
          <button key={v} role="tab" aria-selected={tab === v} className={tab === v ? 'on' : ''} onClick={() => setTab(v)}>{l}</button>
        ))}
      </div>

      {needLogin ? (
        <Empty title={tr('سجّل الدخول لمتابعة مزايداتك', 'Sign in to follow your bids')}><button className="btn-primary" onClick={() => nav('/login')}>{tr('تسجيل الدخول', 'Sign in')}</button></Empty>
      ) : tab === 'all' ? (
        <>
          <div className="mb-2.5 flex items-center gap-2">
            <div className="app-search !mb-0 flex-1"><svg viewBox="0 0 24 24" className="h-5 w-5 text-ink/70" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg><input type="search" placeholder={tr('البحث عن اسم', 'Search a name')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={tr('البحث عن اسم', 'Search a name')} /></div>
            <button type="button" className="app-filterbtn" onClick={() => setFilt(true)} aria-label={tr('تصفية', 'Filter')}><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></svg></button>
          </div>
          <div className="app-chips">
            <button type="button" className="app-chip !inline-flex items-center gap-1" onClick={() => setSortOpen(true)}>{tr('ترتيب', 'Sort')}<svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4" /></svg></button>
            {([['all', tr('الكل', 'All')], ...(['bakkar', 'qaadan', 'manqiya'] as NameType[]).map((t) => [t, TYPE_LABEL[t]] as [NameType, string])] as [NameType | 'all', string][]).map(([v, l]) => <button key={v} type="button" aria-pressed={v === type} className={`app-chip ${v === type ? 'on' : ''}`} onClick={() => setType(v)}>{l}</button>)}
          </div>
          <Sheet open={sortOpen} onClose={() => setSortOpen(false)} title={tr('ترتيب المزادات', 'Sort auctions')}>
            <ul className="app-list mb-2">{SORTS().map(([k, l]) => <li key={k}><button type="button" className={`flex w-full items-center justify-between px-4 py-3.5 text-start text-[15px] font-bold ${sort === k ? 'text-pine' : ''}`} onClick={() => { setSort(k); setSortOpen(false) }}>{l}{sort === k && <Icon name="check" className="h-5 w-5" />}</button></li>)}</ul>
          </Sheet>
          <Sheet open={filt} onClose={() => setFilt(false)} title={tr('تصفية المزادات', 'Filter auctions')}>
            <p className="mb-2 text-[13px] font-bold text-muted">{tr('حالة المزاد', 'Auction status')}</p>
            <Chips value={phase} onChange={(v) => { setPhase(v); setFilt(false) }} options={[['live', tr('جارية', 'Live')], ['scheduled', tr('قادمة', 'Upcoming')], ['ended', tr('منتهية', 'Ended')], ['all', tr('الكل', 'All')]]} />
            {owner && <button type="button" className="btn-ghost mt-2 w-full" onClick={() => { setTab('watch'); setFilt(false) }}>{tr('عرض المزادات التي أتابعها', 'Show auctions I watch')}</button>}
          </Sheet>
          {all.loading && !all.data ? <Loading /> : all.data?.length
            ? <div className="space-y-3">{sortAuctions(all.data, sort).map((a) => <AuctionTile key={a.id} a={a} mark={markOf(a)} mine={myBid.get(a.id)?.amount} watching={watched.has(a.id)} onWatch={owner ? () => void toggle(a.id) : undefined} />)}</div>
            : <Empty title={tr('لا توجد مزادات بهذه التصفية', 'No auctions match this filter')} />}
        </>
      ) : tab === 'mine' ? (
        bids.loading && !bids.data ? <Loading /> : bids.data?.length
          ? <div className="space-y-3">{bids.data.map((b) => <AuctionTile key={b.id} a={b.auction} mark={markOf(b.auction)} mine={b.amount} watching={watched.has(b.auctionId)} onWatch={() => void toggle(b.auctionId)} />)}</div>
          : <Empty title={tr('لم تزايد على أي اسم بعد', 'You have not bid on any name yet')}><button className="btn-primary" onClick={() => setTab('all')}>{tr('تصفّح المزادات', 'Browse auctions')}</button></Empty>
      ) : (
        watch.loading && !watch.data ? <Loading /> : watch.data?.length
          ? <div className="space-y-3">{watch.data.map((a) => <AuctionTile key={a.id} a={a} mark={markOf(a)} mine={myBid.get(a.id)?.amount} watching onWatch={() => void toggle(a.id)} />)}</div>
          : <Empty title={tr('لا تتابع أي مزاد بعد', 'You are not watching any auctions yet')}><p className="text-muted">{tr('اضغط على علامة الحفظ في بطاقة أي مزاد لمتابعته، وننبهك قبل بدايته وقبل نهايته.', 'Tap the bookmark on any auction to follow it; we notify you before it starts and ends.')}</p></Empty>
      )}
    </div>
  )
}

function Alert({ to, tone = 'red', icon, title, aside }: { to: string; tone?: 'red' | 'gold'; icon: 'alert' | 'gavel' | 'receipt' | 'file' | 'lock'; title: string; aside?: string }) {
  return (
    <Link to={to} className={`app-alert border ${tone === 'red' ? 'border-bad/40 bg-[#FDECEE]' : 'border-gold/50 bg-gold-soft'}`}>
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${tone === 'red' ? 'bg-bad/10 text-bad' : 'bg-gold/20 text-gold-deep'}`}><Icon name={icon} className="h-5 w-5" /></span>
      <span className="min-w-0 flex-1 text-start"><b className={`block text-[14.5px] leading-6 ${tone === 'red' ? 'text-bad' : 'text-gold-deep'}`}>{title}</b>{aside && <span className="num block text-[13px] text-muted">{aside}</span>}</span>
      <Icon name="arrow" className="h-4 w-4 shrink-0 text-muted rtl:rotate-180" />
    </Link>
  )
}

/** The owner's home: what needs attention first, then the wallet, the numbers and the auctions about to close. */
export function NativeDash() {
  const { user } = useApp()
  const requestsClosed = useClosed('requests')
  const [showAll, setShowAll] = useState(false)
  const wallet = useLoad(() => api.myWallet(), [])
  const reqs = useLoad(() => api.myRequests(), [])
  const bids = useLoad(() => api.myBids(), [], 15000)
  const invoices = useLoad(() => api.myInvoices(), [])
  const names = useLoad(() => api.myNames(), [])
  const ban = useLoad(() => api.myBan(), [])
  const fines = useFines()
  const live = useLoad(() => api.listAuctions({ phase: 'live' }), [], 15000)
  const finesDue = fines.list?.filter((f) => f.state === 'due') ?? []
  const unpaid = invoices.data?.filter((i) => i.status === 'unpaid') ?? []
  const liveBids = bids.data?.filter((b) => phaseOf(b.auction) === 'live') ?? []
  const outbid = liveBids.filter((b) => !b.auction.isLeader)
  const pendingPay = reqs.data?.filter((r) => r.status === 'pending_payment') ?? []
  const alerts: React.ReactNode[] = [
    ...(ban.data ? [<Alert key="ban" to="/dashboard/profile" icon="lock" title={ban.data.endsOn ? tr(`حسابك محظور من المشاركة حتى ${date(ban.data.endsOn)}`, `Your account is barred until ${date(ban.data.endsOn)}`) : tr('حسابك محظور من المشاركة حتى إشعار آخر', 'Your account is barred until further notice')} />] : []),
    ...outbid.map((b) => <Alert key={b.id} to={`/auctions/${b.auctionId}`} icon="alert" title={tr('لديك مزايدة تحتاج متابعة', 'A bid needs your attention')} aside={`${tr('تم تجاوزك على', 'Outbid on')} «${b.auction.name}» · ${sar(b.auction.currentPrice)}`} />),
    ...unpaid.map((i) => <Alert key={i.id} to={`/dashboard/invoices/${i.id}`} tone="gold" icon="receipt" title={tr(`سدّد فاتورة «${i.name}»`, `Pay the invoice for «${i.name}»`)} aside={sar(i.amountDue)} />),
    ...pendingPay.map((r) => <Alert key={r.id} to={`/dashboard/requests/${r.id}`} tone="gold" icon="file" title={tr(`الطلب ${r.number}: سدّد الضمان لإكماله`, `Request ${r.number}: pay the guarantee`)} />),
    ...(finesDue.length ? [<Alert key="fines" to="/dashboard/violations" icon="alert" title={tr(`مخالفات وغرامات مستحقة (${finesDue.length})`, `Violations and fines due (${finesDue.length})`)} aside={sar(finesDue.reduce((t, f) => t + f.amount, 0))} />] : []),
  ]
  const soon = (liveBids.length ? liveBids.map((b) => b.auction).sort((x, y) => Number(!!x.isLeader) - Number(!!y.isLeader) || Date.parse(x.endsAt) - Date.parse(y.endsAt)) : [...(live.data ?? [])].sort((a, b) => Date.parse(a.endsAt) - Date.parse(b.endsAt))).slice(0, 4)

  return (
    <div className="space-y-3.5">
      <div>
        <h1>{tr('أهلاً بك يا', 'Welcome,')} {user?.fullName.split(' ')[0] ?? ''}</h1>
        <p className="text-[14px] text-muted">{tr('تابع مزايداتك واطلب أسماء جديدة', 'Follow your bids and request new names')}</p>
      </div>

      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.slice(0, showAll ? undefined : 1)}
          {alerts.length > 1 && <button type="button" className="w-full py-1 text-center text-[13.5px] font-bold text-pine" onClick={() => setShowAll(!showAll)}>{showAll ? tr('إخفاء', 'Hide') : tr(alerts.length === 2 ? 'تنبيه آخر' : `${num(alerts.length - 1)} تنبيهات أخرى`, `${alerts.length - 1} more alerts`)}</button>}
        </div>
      )}
      <ProfileCompletion />

      <Link to="/dashboard/wallet" className="app-wallet">
        <Icon name="wallet" className="h-9 w-9 shrink-0 text-gold-light" />
        <span className="min-w-0 flex-1 text-start"><span className="block text-[13px] text-paper/75">{tr('رصيد المحفظة', 'Wallet balance')}</span><span className="num block text-[28px] font-extrabold leading-tight">{wallet.data ? sar(wallet.data.balance) : '…'}</span></span>
        <span className="plus"><Icon name="plus" className="h-5 w-5" /></span>
      </Link>

      <div className="grid grid-cols-2 gap-2.5">
        <Link to="/dashboard/requests/new" className="app-stat sm !border-gold/60 !bg-gold-soft"><Icon name="tag" className="h-6 w-6 text-gold-deep" /><span className="!text-[14px] !text-gold-deep">{requestsClosed ? tr('طلب شعار (مغلق حاليًا)', 'New request (closed)') : tr('طلب شعار جديد', 'New name request')}</span></Link>
        <Link to="/dashboard/names" className="app-stat sm"><Icon name="shield" className="h-6 w-6 text-pine" /><span className="!text-[14px]">{tr('أسمائي', 'My names')}</span><b className="num text-[20px]">{num(names.data?.length ?? 0)}</b></Link>
        <Link to="/dashboard/requests" className="app-stat sm"><Icon name="file" className="h-6 w-6 text-pine" /><span className="!text-[14px]">{tr('طلبات قيد المراجعة', 'Under review')}</span><b className="num text-[20px]">{num(reqs.data?.filter((r) => r.status === 'under_review').length ?? 0)}</b></Link>
        <Link to="/dashboard/invoices" className="app-stat sm"><Icon name="receipt" className="h-6 w-6 text-pine" /><span className="!text-[14px]">{tr('الفواتير', 'Invoices')}</span><b className="num text-[20px]">{num(unpaid.length)}</b></Link>
      </div>

      <div className="flex items-center justify-between pt-1">
        <h2 className="flex items-center gap-1.5 text-[18px]"><Icon name="clock" className="h-[18px] w-[18px] text-gold-deep" />{liveBids.length ? tr('مزايداتي تحتاج دخلك', 'My bids need you') : tr('مزادات قريبة من الانتهاء', 'Closing soon')}</h2>
        <Link to="/auctions" className="text-[14px] font-bold text-pine">{tr('الكل', 'All')}</Link>
      </div>
      {soon.length ? (
        <ul className="space-y-2.5">
          {soon.map((a) => (
            <li key={a.id}>
              <Link to={`/auctions/${a.id}`} className="app-row !py-2.5">
                <span className="min-w-0 flex-1 text-start"><b className="block truncate text-[18px]">{a.name}</b><span className="num block text-[16px] font-extrabold">{sar(a.currentPrice)}</span></span>
                <span className="flex flex-col items-end gap-1"><TypePill type={a.type} /><span className={`flex items-center gap-1 text-[12.5px] font-bold ${Date.parse(a.endsAt) - Date.now() < 3600_000 ? 'text-bad' : 'text-muted'}`}><Icon name="clock" className="h-3.5 w-3.5" /><Countdown to={a.endsAt} /></span></span>
                <Icon name="arrow" className="h-4 w-4 shrink-0 text-muted rtl:rotate-180" />
              </Link>
            </li>
          ))}
        </ul>
      ) : <p className="rounded-2xl border border-line bg-paper p-5 text-center text-muted">{tr('لا توجد مزادات جارية الآن.', 'No live auctions right now.')}</p>}
    </div>
  )
}

/* ───────── services, wallet, account ───────── */

import { Link as L2 } from 'react-router-dom'
import { LangSwitch } from '../../lib/i18n'
import { Avatar } from '../../components/Avatar'
import { ServiceCard, useServices } from '../../components/Services'
import type { EService } from '../../components/Services'
import { BankAndRefunds } from '../owner/Bank'
import { localizeServerText as LT } from '../../lib/serverText'

export function NativeServices() {
  const { user } = useApp()
  const list = useServices()
  const [open, setOpen] = useState<EService | null>(null)
  const isOwner = user?.role === 'owner'
  const main = list
  const Tile = ({ s, gold }: { s: EService; gold?: boolean }) => (
    <button type="button" onClick={() => setOpen(s)} className={`app-tile ${gold ? '!border-gold/60 !bg-gold-soft' : ''} ${s.open ? '' : 'opacity-70'}`}>
      <Icon name={s.icon} className={`h-8 w-8 ${gold ? 'text-gold-deep' : 'text-pine'}`} />
      <span className="text-[15px]">{s.title}</span>
      {!s.open && <span className="text-[11px] font-medium text-muted">{s.soon ? tr('قريبًا', 'Soon') : tr('مغلقة', 'Closed')}</span>}
    </button>
  )
  return (
    <div>
      <h1 className="text-center">{tr('الخدمات', 'Services')}</h1>
      <p className="mb-4 text-center text-[14px] text-muted">{tr('أنجز معاملاتك بأسماء الإبل بسهولة وأمان.', 'Handle your camel-name transactions easily and safely.')}</p>
      <div className="grid grid-cols-2 gap-2.5">{main.map((s, i) => <Tile key={s.key} s={s} gold={i === 0} />)}</div>
      {isOwner && <L2 to="/dashboard/requests" className="app-row mt-3"><Icon name="file" className="h-5 w-5 text-pine" /><span className="flex-1 font-bold">{tr('متابعة طلباتي', 'Track my requests')}</span><Icon name="arrow" className="h-4 w-4 text-muted rtl:rotate-180" /></L2>}
      <Sheet open={!!open} onClose={() => setOpen(null)} title={open?.title ?? ''}>
        {open && <ul><ServiceCard s={open} isOwner={isOwner} signedIn={!!user} /></ul>}
      </Sheet>
    </div>
  )
}

const txKind = () => ({ topup: tr('شحن', 'Top up'), deposit: tr('ضمان مزاد', 'Auction guarantee'), refund: tr('استرداد', 'Refund'), invoice_payment: tr('سداد فاتورة', 'Invoice payment'), service_fee: tr('رسوم استثمار الاسم', 'Name investment fee'), investment_payout: tr('عائد استثمار الاسم', 'Name investment payout'), bid_deposit: tr('ضمان دخول مزاد', 'Participation guarantee'), sale_payout: tr('ثمن بيع اسم', 'Name sale proceeds'), purchase: tr('شراء اسم', 'Name purchase'), withdrawal: tr('استرداد إلى البنك', 'Refund to bank'), adjustment: tr('تسوية', 'Adjustment'), fine: tr('سداد مخالفة', 'Violation fine') })

export function NativeWallet() {
  const { toast, user } = useApp()
  const { data, loading, reload } = useLoad(() => api.myWallet(), [])
  const [top, setTop] = useState(false)
  const [amount, setAmount] = useState('100')
  const K = txKind()
  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-gradient-to-br from-pine to-pine-deep p-5 text-paper">
        <div className="flex items-center gap-3"><span className="min-w-0 flex-1 text-start"><span className="block text-[13px] text-paper/75">{tr('رصيد المحفظة', 'Wallet balance')}</span><span className="num block text-[32px] font-extrabold leading-tight">{data ? sar(data.balance) : '…'}</span></span><Icon name="wallet" className="h-10 w-10 shrink-0 text-gold-light" /></div>
      </section>
      <div className="grid grid-cols-3 gap-2.5">
        <button className="app-tile" onClick={() => setTop(true)}><Icon name="plus" className="h-6 w-6 text-pine" /><span>{tr('شحن الرصيد', 'Top up')}</span></button>
        <button className="app-tile" onClick={() => document.getElementById('wallet-bank')?.scrollIntoView({ behavior: 'smooth' })}><Icon name="arrow" className="h-6 w-6 text-pine" /><span>{tr('سحب الرصيد', 'Withdraw')}</span></button>
        <button className="app-tile" onClick={() => document.getElementById('wallet-txs')?.scrollIntoView({ behavior: 'smooth' })}><Icon name="file" className="h-6 w-6 text-pine" /><span>{tr('كشف الحركات', 'Statement')}</span></button>
      </div>
      <h2 id="wallet-txs" className="text-[18px]">{tr('آخر التعاملات', 'Recent transactions')}</h2>
      {loading && !data ? <Loading /> : data?.txs.length ? (
        <ul className="app-list">
          {data.txs.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1 text-start"><b className="block truncate text-[15px]">{K[t.kind] ?? t.kind}</b><span className="block truncate text-[12.5px] text-muted">{date(t.createdAt)}{t.note ? ` · ${LT(t.note)}` : ''}</span></span>
              <span className={`num shrink-0 text-[16px] font-extrabold ${t.amount > 0 ? 'text-ok' : 'text-bad'}`}>{sar(Math.abs(t.amount))}</span>
            </li>
          ))}
        </ul>
      ) : <Empty title={tr('لا توجد عمليات بعد', 'No transactions yet')} />}
      <div id="wallet-bank" />
      {user?.acting ? null : <BankAndRefunds balance={data?.balance ?? 0} onChange={reload} />}
      <Sheet open={top} onClose={() => setTop(false)} title={tr('شحن المحفظة', 'Top up wallet')}>
        <label className="label" htmlFor="amt">{tr('المبلغ', 'Amount')}</label>
        <input id="amt" className="field num" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))} />
        <div className="mt-2 grid grid-cols-4 gap-2">{[50, 100, 500, 1000].map((v) => <button key={v} className="btn-ghost btn-sm num" onClick={() => setAmount(String(v))}>{v}</button>)}</div>
        <button className="btn-gold mt-4 w-full" disabled={!Number(amount)} onClick={async () => {
          try { await api.topUp(Number(amount)); toast(tr(`تم شحن ${sar(Number(amount))}`, `Topped up ${sar(Number(amount))}`)); setTop(false); reload() } catch (e) { toast((e as Error).message, 'bad') }
        }}>{tr(`ادفع ${sar(Number(amount) || 0)} بالبطاقة`, `Pay ${sar(Number(amount) || 0)} by card`)}</button>
      </Sheet>
    </div>
  )
}

function MenuRow({ to, icon, label, badge }: { to: string; icon: 'alert' | 'gavel' | 'receipt' | 'file' | 'lock' | 'tag' | 'shield' | 'wallet' | 'users' | 'settings' | 'check' | 'list'; label: string; badge?: number }) {
  return (
    <L2 to={to} className="flex items-center gap-3 border-b border-line/70 px-4 py-3.5 last:border-b-0 active:bg-pine-soft">
      <Icon name={icon} className="h-5 w-5 text-pine" />
      <span className="flex-1 text-[15px] font-bold">{label}</span>
      {!!badge && <span className="num grid h-6 min-w-6 place-items-center rounded-full bg-bad px-1.5 text-[12px] font-bold text-paper">{badge}</span>}
      <Icon name="arrow" className="h-4 w-4 text-muted rtl:rotate-180" />
    </L2>
  )
}

/** «حسابي»: the owner's profile card and every other screen one tap away. */
export function NativeAccount() {
  const { user, setUser } = useApp()
  const nav = useNavigate()
  const invoices = useLoad(() => api.myInvoices(), [])
  const fines = useFines()
  const tickets = useLoad(() => api.myTickets(), [])
  const wallet = useLoad(() => api.myWallet(), [])
  const names = useLoad(() => api.myNames(), [])
  const certs = useLoad(() => api.myCertificates(), [])
  if (!user) return null
  const unpaid = invoices.data?.filter((i) => i.status === 'unpaid').length ?? 0
  const due = fines.list?.filter((f) => f.state === 'due').length ?? 0
  const openTickets = tickets.data?.filter((t) => t.status !== 'closed').length ?? 0
  return (
    <div className="space-y-3.5">
      <L2 to="/dashboard/profile" className="flex flex-col items-center gap-1 text-center">
        <span className="relative"><Avatar name={user.fullName} src={user.avatarUrl} size={88} ring /><span className="absolute bottom-0 end-0 grid h-7 w-7 place-items-center rounded-full border-2 border-paper bg-ok text-paper"><Icon name="check" className="h-4 w-4" /></span></span>
        <b className="mt-1 text-[20px]">{user.fullName}</b>
        <span className="text-[13px] text-muted">{tr('مالك إبل', 'Camel owner')}</span>
        
      </L2>
      <div className="grid grid-cols-4 gap-2">
        <L2 to="/dashboard/wallet" className="app-stat"><Icon name="wallet" className="h-5 w-5 text-pine" /><span>{tr('المحفظة', 'Wallet')}</span><b className="num text-[13px]">{wallet.data ? sar(wallet.data.balance) : '…'}</b></L2>
        <L2 to="/dashboard/invoices" className="app-stat"><Icon name="receipt" className="h-5 w-5 text-pine" /><span>{tr('الفواتير', 'Invoices')}</span><b className="num text-[15px]">{num(unpaid)}</b></L2>
        <L2 to="/dashboard/names" className="app-stat"><Icon name="tag" className="h-5 w-5 text-pine" /><span>{tr('أسمائي', 'Names')}</span><b className="num text-[15px]">{num(names.data?.length ?? 0)}</b></L2>
        <L2 to="/dashboard/certificates" className="app-stat"><Icon name="file" className="h-5 w-5 text-pine" /><span>{tr('الشهادات', 'Certs')}</span><b className="num text-[15px]">{num(certs.data?.length ?? 0)}</b></L2>
      </div>
      <section className="app-card !p-0 overflow-hidden">
        <MenuRow to="/dashboard/settings" icon="shield" label={tr('الأمان وتغيير كلمة المرور', 'Security & password')} />
        <MenuRow to="/dashboard/camels" icon="shield" label={tr('إبلي', 'My camels')} />
        <MenuRow to="/dashboard/violations" icon="alert" label={tr('المخالفات', 'Violations')} badge={due} />
        <MenuRow to="/dashboard/requests" icon="list" label={tr('طلباتي', 'My requests')} />
        <MenuRow to="/dashboard/tickets" icon="users" label={tr('الشكاوى والاستفسارات', 'Complaints & enquiries')} badge={openTickets} />
        <MenuRow to="/contact" icon="users" label={tr('المساعدة والدعم', 'Help & support')} />
        <MenuRow to="/about" icon="list" label={tr('عن تطبيق سمّها', 'About Sammha')} />
      </section>
      <LangSwitch className="btn-ghost w-full" />
      <button className="flex w-full items-center justify-center gap-2 rounded-2xl border border-bad/30 bg-[#FDECEE] py-3 font-bold text-bad" onClick={async () => { await api.signOut(); setUser(null); nav('/') }}>{tr('تسجيل الخروج', 'Sign out')}</button>
      <nav className="flex flex-wrap justify-center gap-x-4 gap-y-1 pt-1 text-[12.5px] text-muted"><L2 to="/terms">{tr('الشروط', 'Terms')}</L2><L2 to="/privacy">{tr('الخصوصية', 'Privacy')}</L2><L2 to="/refund">{tr('الاسترداد', 'Refunds')}</L2></nav>
    </div>
  )
}
