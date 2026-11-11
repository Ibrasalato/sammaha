import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon } from '../../components/dash'
import type { IconName } from '../../components/dash'
import { Sheet } from '../../components/AppChrome'
import { BIG_BID, biometricAvailable, haptic, lockEnabled, setLockEnabled, verifyOwner } from '../../lib/device'
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
const TINT: Record<NameType, string> = { bakkar: '#ECF9F0', qaadan: '#F5EFFA', manqiya: '#FFFAEC' }
const PILL: Record<NameType, string> = { bakkar: 'bg-[#D3EEDC] text-[#155A43]', qaadan: 'bg-[#E6D9F2] text-[#5B3A80]', manqiya: 'bg-[#FBEBC4] text-[#8A6414]' }

/** time left: red under an hour, orange up to three hours, blue beyond */
export function TimerPill({ a, phase }: { a: Auction; phase: AuctionPhase }) {
  const left = Date.parse(phase === 'scheduled' ? a.startsAt : a.endsAt) - Date.now()
  const tone = phase === 'ended' ? 'bg-stone text-muted' : phase === 'scheduled' ? 'bg-[#E8F0FC] text-[#1D4E9E]' : left < 3600_000 ? 'bg-[#FDECEE] text-[#C62828]' : left < 3 * 3600_000 ? 'bg-[#FFF1DC] text-[#B86A00]' : 'bg-[#E8F0FC] text-[#1D4E9E]'
  return (
    <span className={`flex h-[34px] items-center justify-center gap-1.5 rounded-xl px-2 ${tone}`}>
      <Icon name="clock" className="h-[17px] w-[17px] shrink-0" />
      {a.paused ? <b className="text-[13px]">{tr('متوقف مؤقتًا', 'Paused')}</b>
        : phase === 'ended' ? <b className="text-[13px]">{tr('انتهى المزاد', 'Ended')}</b>
        : <><span className="text-[11.5px] font-bold">{phase === 'scheduled' ? tr('يبدأ خلال', 'Starts in') : tr('ينتهي خلال', 'Ends in')}</span><b className="num text-[15px] font-extrabold"><Countdown to={phase === 'scheduled' ? a.startsAt : a.endsAt} /></b></>}
    </span>
  )
}

function StatusPill({ a, m, phase }: { a: Auction; m: Mark; phase: AuctionPhase }) {
  const check = <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden><circle cx="12" cy="12" r="10" fill="currentColor" /><path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
  if (m === 'leading') return <span className="inline-flex items-center gap-1 rounded-full bg-[#DCF0E3] px-2 py-0.5 text-[11px] font-extrabold text-[#1E7A45]">{tr('أنت الأعلى', 'Top bid')}{check}</span>
  if (m === 'outbid') return <span className="inline-flex items-center gap-1 rounded-full bg-[#FDECEE] px-2 py-0.5 text-[11px] font-extrabold text-[#C62828]"><svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M6 11l6-6 6 6" /></svg>{tr('تمت المزايدة عليك', 'Outbid')}</span>
  if (m === 'won') return <span className="inline-flex items-center gap-1 rounded-full bg-gold-soft px-2 py-0.5 text-[11px] font-extrabold text-gold-deep">{tr('فزت بالمزاد', 'You won')}</span>
  if (phase === 'ended') return <span className="inline-flex items-center gap-1 rounded-full bg-stone px-2 py-0.5 text-[11px] font-extrabold text-muted">{tr('انتهى المزاد', 'Ended')}🏁</span>
  if (!a.bidCount && phase === 'live') return <span className="rounded-full bg-[#DCF0E3] px-2 py-0.5 text-[11px] font-extrabold text-[#1E7A45]">{tr('جديد', 'New')}</span>
  return null
}

/** One auction card: the name on its category colour, price with bookmark and bell, time left and the bid button. */
export function AuctionTile({ a, mark, watching, onWatch }: { a: Auction; mark?: Mark; mine?: number; watching?: boolean; onWatch?: () => void }) {
  const phase: AuctionPhase = a.paused ? 'live' : phaseOf(a)
  const ended = phase === 'ended'
  const price = a.finalPrice ?? a.currentPrice
  const m = mark ?? (a.isLeader && !ended ? 'leading' : null)
  return (
    <Link to={`/auctions/${a.id}`} className={`block rounded-[18px] border border-[#E6EAEE] bg-paper p-1.5 shadow-[0_4px_14px_-10px_rgba(9,47,39,.35)] ${a.paused ? 'opacity-80' : ''}`}>
      <div className="flex items-stretch">
        <div className="min-w-0 flex-1 rounded-[14px] px-2.5 py-1.5 text-start" style={{ background: TINT[a.type] }}>
          <div className="flex items-center gap-1.5 whitespace-nowrap"><span className={`rounded-md px-2 py-0.5 text-[12px] font-extrabold ${PILL[a.type]}`}>{TYPE_LABEL[a.type]}</span><StatusPill a={a} m={m} phase={phase} /></div>
          <b className="mt-0.5 block truncate text-[21px] font-semibold leading-tight">{a.name}</b>
          <span className="flex items-center gap-1 text-[12px] text-muted">{tr('مزايدات', 'bids')} <span className="num">{num(a.bidCount)}</span><Icon name="users" className="h-4 w-4" /></span>
        </div>
        <span className="mx-2 my-2 w-px bg-line" aria-hidden />
        <div className="w-[38%] shrink-0 px-1 text-end">
          <div className="flex items-center justify-end gap-1">
            <FollowBell a={a} tone="gold" />
            {onWatch && (
              <button type="button" className="grid h-7 w-7 place-items-center text-ink/70" aria-pressed={!!watching} aria-label={tr('احفظ في المتابعة', 'Save')} onClick={(e) => { e.preventDefault(); e.stopPropagation(); onWatch() }}><Bookmark on={!!watching} /></button>
            )}
          </div>
          <span className="num block text-[20px] font-medium leading-tight">{sar(price)}</span>
          <span className="text-[11.5px] text-muted">{ended ? tr('سعر الترسية', 'Hammer price') : a.bidCount ? tr('أعلى مزايدة', 'Top bid') : tr('السعر الافتتاحي', 'Opening price')}</span>
        </div>
      </div>
      <div className="mt-1.5 grid grid-cols-[1fr_38%] gap-2">
        <TimerPill a={a} phase={phase} />
        {phase === 'live' && !a.paused
          ? <span className="flex h-[34px] items-center justify-center rounded-xl bg-[#DCE8E0] text-[16px] font-extrabold text-[#155A43]">{tr('زايد الآن', 'Bid now')}</span>
          : <span className="flex h-[34px] items-center justify-center rounded-xl bg-[#EEF0F2] text-[15px] font-bold text-[#9AA3AD]">{tr('زايد الآن', 'Bid now')}</span>}
      </div>
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
      {tab === 'all' && (
        <div className="mb-2.5 flex items-center gap-2">
            <div className="app-search !mb-0 flex-1"><svg viewBox="0 0 24 24" className="h-5 w-5 text-ink/70" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg><input type="search" placeholder={tr('البحث عن اسم مزاد...', 'Search an auction name…')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={tr('البحث عن اسم', 'Search a name')} /></div>
            <button type="button" className="app-filterbtn" onClick={() => setFilt(true)} aria-label={tr('تصفية', 'Filter')}><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></svg></button>
          </div>
      )}
      <div className="app-seg" role="tablist">
        {([['all', `${tr('كل المزادات', 'All auctions')}${all.data ? ` (${num(all.data.length)})` : ''}`], ['mine', `${tr('مزايداتي', 'My bids')}${bids.data?.length ? ` (${num(bids.data.length)})` : ''}`], ...(tab === 'watch' ? [['watch', tr('المتابعة', 'Watching')]] : [])] as ['all' | 'mine' | 'watch', string][]).map(([v, l]) => (
          <button key={v} role="tab" aria-selected={tab === v} className={tab === v ? 'on' : ''} onClick={() => setTab(v)}>{l}</button>
        ))}
      </div>

      {needLogin ? (
        <Empty title={tr('سجّل الدخول لمتابعة مزايداتك', 'Sign in to follow your bids')}><button className="btn-primary" onClick={() => nav('/login')}>{tr('تسجيل الدخول', 'Sign in')}</button></Empty>
      ) : tab === 'all' ? (
        <>
          <div className="app-chips">
            <button type="button" className="app-chip !inline-flex items-center gap-1" onClick={() => setSortOpen(true)}>{tr('ترتيب', 'Sort')}<svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4" /></svg></button>
            {([['all', tr('الكل', 'All')], ...(['bakkar', 'qaadan', 'manqiya'] as NameType[]).map((t) => [t, TYPE_LABEL[t]] as [NameType, string])] as [NameType | 'all', string][]).map(([v, l]) => <button key={v} type="button" aria-pressed={v === type} className={`app-chip ${v === type ? 'on' : ''}`} style={v === 'manqiya' && v !== type ? { background: TINT.manqiya } : undefined} onClick={() => setType(v)}>{l}</button>)}
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
            ? <div className="space-y-2.5">{sortAuctions(all.data, sort).map((a) => <AuctionTile key={a.id} a={a} mark={markOf(a)} mine={myBid.get(a.id)?.amount} watching={watched.has(a.id)} onWatch={owner ? () => void toggle(a.id) : undefined} />)}</div>
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

const Chevron = () => <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-ink/60 rtl:rotate-180" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>

/** a live auction on the home screen: price and my last bid, then my position and the time left */
function BidCard({ a, myBid }: { a: Auction; myBid?: number }) {
  const lead = !!a.isLeader
  return (
    <Link to={`/auctions/${a.id}`} className="app-card flex items-center gap-3 !rounded-[20px] !p-3.5">
      <span className="min-w-0 flex-[1.35] text-start">
        <b className="block truncate text-[21px] font-extrabold leading-tight">{a.name}</b>
        <span className="mt-0.5 flex items-baseline gap-2"><b className="num text-[20px] font-extrabold">{sar(a.currentPrice)}</b><span className="text-[12.5px] text-muted">{tr('أعلى مزايدة حاليًا', 'Current top bid')}</span></span>
        {myBid !== undefined
          ? <span className={`mt-1.5 flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] ${lead ? 'bg-[#E3F1E8] text-pine' : 'bg-stone text-ink/80'}`}><Icon name="user" className="h-4 w-4" />{tr('مزايدتك الأخيرة:', 'Your last bid:')} <b className="num">{sar(myBid)}</b></span>
          : <span className="mt-1.5 inline-flex"><TypePill type={a.type} /></span>}
      </span>
      <span className="h-16 w-px bg-line" aria-hidden />
      <span className="flex flex-1 flex-col items-center gap-1">
        {myBid !== undefined && (lead
          ? <span className="inline-flex items-center gap-1 rounded-full bg-[#E3F1E8] px-3 py-1 text-[13.5px] font-extrabold text-pine"><Crown className="h-4 w-4" />{tr('أنت المتصدر', 'Leading')}</span>
          : <span className="inline-flex items-center gap-1 rounded-full bg-[#FDECEE] px-3 py-1 text-[13.5px] font-extrabold text-bad">{tr('تم تجاوزك', 'Outbid')}<svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg></span>)}
        <span className="flex items-center gap-1 text-[17px] font-bold"><Icon name="clock" className="h-4 w-4 text-muted" /><Countdown to={a.endsAt} /></span>
        <span className="text-[12.5px] text-muted">{tr('متبقي', 'left')}</span>
      </span>
      <Chevron />
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
    ...outbid.map((b) => <Alert key={b.id} to={`/auctions/${b.auctionId}`} icon="alert" title={tr('لديك مزايدة تحتاج متابعة', 'A bid needs your attention')} aside={tr(`تم تجاوزك على «${b.auction.name}» بمبلغ ${sar(b.auction.currentPrice)}`, `Outbid on «${b.auction.name}» at ${sar(b.auction.currentPrice)}`)} />),
    ...unpaid.map((i) => <Alert key={i.id} to={`/dashboard/invoices/${i.id}`} tone="gold" icon="receipt" title={tr(`سدّد فاتورة «${i.name}»`, `Pay the invoice for «${i.name}»`)} aside={sar(i.amountDue)} />),
    ...pendingPay.map((r) => <Alert key={r.id} to={`/dashboard/requests/${r.id}`} tone="gold" icon="file" title={tr(`الطلب ${r.number}: سدّد الضمان لإكماله`, `Request ${r.number}: pay the guarantee`)} />),
    ...(finesDue.length ? [<Alert key="fines" to="/dashboard/violations" icon="alert" title={tr(`مخالفات وغرامات مستحقة (${finesDue.length})`, `Violations and fines due (${finesDue.length})`)} aside={sar(finesDue.reduce((t, f) => t + f.amount, 0))} />] : []),
  ]
  const soon = (liveBids.length ? liveBids.map((b) => b.auction).sort((x, y) => Number(!!x.isLeader) - Number(!!y.isLeader) || Date.parse(x.endsAt) - Date.parse(y.endsAt)) : [...(live.data ?? [])].sort((a, b) => Date.parse(a.endsAt) - Date.parse(b.endsAt))).slice(0, 4)

  return (
    <div className="space-y-3.5">
      <div>
        <h1 className="!text-[28px] !font-extrabold text-pine-deep">{tr('أهلاً بك يا', 'Welcome,')} {user?.fullName.split(' ')[0] ?? ''}</h1>
        <p className="text-[15px] text-muted">{tr('تابع مزايداتك وخدماتك من مكان واحد', 'Your bids and services in one place')}</p>
      </div>

      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.slice(0, showAll ? undefined : 1)}
          {alerts.length > 1 && <button type="button" className="w-full py-1 text-center text-[13.5px] font-bold text-pine" onClick={() => setShowAll(!showAll)}>{showAll ? tr('إخفاء', 'Hide') : tr(alerts.length === 2 ? 'تنبيه آخر' : `${num(alerts.length - 1)} تنبيهات أخرى`, `${alerts.length - 1} more alerts`)}</button>}
        </div>
      )}
      <ProfileCompletion />

      <Link to="/dashboard/wallet" className="app-wallet">
        <Icon name="wallet" className="h-10 w-10 shrink-0 text-gold-light" />
        <span className="min-w-0 flex-1 text-start"><span className="block text-[14px] text-paper/80">{tr('رصيد المحفظة', 'Wallet balance')}</span><span className="num block text-[30px] font-extrabold leading-tight">{wallet.data ? sar(wallet.data.balance) : '…'}</span></span>
        <span className="h-12 w-px bg-paper/30" aria-hidden />
        <span className="flex items-center gap-3"><span className="text-[15px] font-bold">{tr('إضافة رصيد', 'Top up')}</span><span className="plus !h-12 !w-12 !rounded-2xl"><Icon name="plus" className="h-6 w-6" /></span></span>
      </Link>

      <div className="grid grid-cols-2 gap-3">
        <Link to="/dashboard/requests/new" className="app-qtile justify-center !border-gold/50 !bg-gold-soft !text-gold-deep"><span>{requestsClosed ? tr('الطلبات مغلقة', 'Requests closed') : tr('طلب شعار جديد', 'New name request')}</span><Icon name="tag" className="h-6 w-6" /></Link>
        <Link to="/dashboard/names" className="app-qtile"><span className="cnt num">{num(names.data?.length ?? 0)}</span><span className="flex-1">{tr('أسمائي', 'My names')}</span><Icon name="shield" className="h-6 w-6 shrink-0 text-pine" /></Link>
        <Link to="/dashboard/requests" className="app-qtile !whitespace-normal !text-[13px]"><span className="cnt num">{num(reqs.data?.filter((r) => r.status === 'under_review').length ?? 0)}</span><span className="flex-1 leading-tight">{tr('طلبات قيد المراجعة', 'Under review')}</span><Icon name="file" className="h-6 w-6 shrink-0 text-pine" /></Link>
        <Link to="/dashboard/invoices" className="app-qtile"><span className="cnt num">{num(unpaid.length)}</span><span className="flex-1">{tr('الفواتير', 'Invoices')}</span><Icon name="receipt" className="h-6 w-6 shrink-0 text-pine" /></Link>
      </div>

      <div className="flex items-center justify-between pt-2">
        <h2 className="flex items-center gap-2 text-[20px] font-extrabold"><Icon name="gavel" className="h-7 w-7 text-pine" />{liveBids.length ? tr('مزايداتي الجارية', 'My live bids') : tr('مزادات قريبة من الانتهاء', 'Closing soon')}</h2>
        <Link to="/auctions" className="flex items-center gap-1 text-[15px] font-bold text-pine">{tr('عرض الكل', 'View all')}<svg viewBox="0 0 24 24" className="h-4 w-4 rtl:rotate-180" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg></Link>
      </div>
      {liveBids.length ? (
        <ul className="space-y-3">
          {liveBids.sort((x, y) => Number(!!x.auction.isLeader) - Number(!!y.auction.isLeader) || Date.parse(x.auction.endsAt) - Date.parse(y.auction.endsAt)).slice(0, 4).map((b) => <li key={b.id}><BidCard a={b.auction} myBid={b.amount} /></li>)}
        </ul>
      ) : soon.length ? (
        <ul className="space-y-3">{soon.map((a) => <li key={a.id}><BidCard a={a} /></li>)}</ul>
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
  const SHORT: Record<string, [string, string]> = {
    mark: ['إصدار شعار باسم الإبل', 'Issue a mark for a camel name'], invest: ['طلب شعار للاستثمار في اسم', 'Request a mark to invest in a name'],
    resale: ['عرض الاسم للبيع في المنصة', 'List a name for sale'], transfer: ['تحويل ملكية الاسم لمالك آخر', 'Transfer a name to another owner'],
    compound: ['تسجيل وطلب اسم مركب جديد', 'Register a new compound name'], exemption: ['طلب المشاركة في المزادات', 'Take part in auctions'],
  }
  const Tile = ({ s, gold }: { s: EService; gold?: boolean }) => (
    <button type="button" onClick={() => setOpen(s)} className={`flex flex-col items-center gap-1.5 rounded-[20px] border px-3 pb-4 pt-4 text-center shadow-[0_6px_18px_-12px_rgba(9,47,39,.3)] ${gold ? 'border-gold/60 bg-[#FFF6E2]' : 'border-[#E3E7EB] bg-paper'} ${s.open ? '' : 'opacity-70'}`}>
      <span className={`grid h-14 w-14 place-items-center rounded-2xl ${gold ? 'bg-gold/15 text-gold-deep' : 'bg-[#E3F1E8] text-pine'}`}><Icon name={s.icon} className="h-8 w-8" /></span>
      <b className="mt-1 text-[15px] font-extrabold leading-snug">{s.title}</b>
      <span className="text-[12px] leading-5 text-muted">{s.open ? tr(...(SHORT[s.key] ?? [s.desc, s.desc])) : s.soon ? tr('قريبًا', 'Soon') : tr('مغلقة حاليًا', 'Closed now')}</span>
    </button>
  )
  return (
    <div>
      <h1 className="text-center !text-[32px] !font-extrabold text-pine">{tr('الخدمات', 'Services')}</h1>
      <p className="text-center text-[15px] text-muted">{tr('أنجز معاملاتك بأسماء الإبل بسهولة وأمان', 'Handle your camel-name transactions easily and safely')}</p>
      <span className="mx-auto mb-5 mt-3 block h-1 w-12 rounded-full bg-gold" aria-hidden />
      <div className="grid grid-cols-2 gap-3">{main.map((s, i) => <Tile key={s.key} s={s} gold={i === 0} />)}</div>
      {isOwner && (
        <L2 to="/dashboard/requests" className="mt-6 flex items-center gap-3 rounded-[20px] border-[1.5px] border-pine/70 bg-paper px-4 py-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#E3F1E8] text-pine"><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg></span>
          <span className="min-w-0 flex-1 text-start"><b className="block text-[19px] font-extrabold text-pine">{tr('متابعة طلباتي', 'Track my requests')}</b><span className="text-[13.5px] text-muted">{tr('اطلع على حالة جميع طلباتك', 'See the status of all your requests')}</span></span>
          <span className="h-10 w-px bg-line" aria-hidden />
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#E3F1E8] text-pine"><Icon name="file" className="h-7 w-7" /></span>
        </L2>
      )}
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

function MenuRow({ to, icon, label, badge }: { to: string; icon: IconName; label: string; badge?: number }) {
  return (
    <L2 to={to} className="flex items-center gap-3 border-b border-line/70 px-4 py-3.5 last:border-b-0 active:bg-pine-soft">
      <Icon name={icon} className="h-5 w-5 text-pine" />
      <span className="flex-1 text-[15px] font-bold">{label}</span>
      {!!badge && <span className="num grid h-6 min-w-6 place-items-center rounded-full bg-bad px-1.5 text-[12px] font-bold text-paper">{badge}</span>}
      <Chevron />
    </L2>
  )
}

/** «حسابي»: the owner's profile card and every other screen one tap away. */
export function NativeAccount() {
  const { user, setUser, toast } = useApp()
  const [del, setDel] = useState(false)
  const [delBusy, setDelBusy] = useState(false)
  const [bio, setBio] = useState(false)
  const [lock, setLock] = useState(lockEnabled())
  useEffect(() => { void biometricAvailable().then(setBio) }, [])
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
        <button type="button" className="flex w-full items-center gap-3 border-b border-line/70 px-4 py-3.5 text-start active:bg-pine-soft" onClick={() => window.dispatchEvent(new Event('sammha:chat'))}>
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-pine" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z" /><path d="M8.5 11h.01M12 11h.01M15.5 11h.01" /></svg>
          <span className="flex-1 text-[15px] font-bold">{tr('مساعد سمّها', 'Sammha assistant')}</span><Chevron />
        </button>
        {bio && (
          <button type="button" className="flex w-full items-center gap-3 border-b border-line/70 px-4 py-3.5 text-start" onClick={async () => { const on = !lock; if (on && !(await verifyOwner(tr('تفعيل قفل التطبيق', 'Turn on app lock')))) return; setLockEnabled(on); setLock(on); void haptic('success') }} aria-pressed={lock}>
            <Icon name="lock" className="h-5 w-5 text-pine" />
            <span className="flex-1"><b className="block text-[15px]">{tr('قفل التطبيق بـ Face ID', 'Lock the app with Face ID')}</b><span className="text-[12.5px] text-muted">{tr(`عند فتح التطبيق وقبل المزايدات من ${num(BIG_BID)} ريال`, `On opening and before bids from ${num(BIG_BID)} SAR`)}</span></span>
            <span className={`relative inline-block h-7 w-12 shrink-0 rounded-full transition ${lock ? 'bg-pine' : 'bg-line'}`}><span className={`absolute top-0.5 h-6 w-6 rounded-full bg-paper shadow transition-all ${lock ? 'start-[22px]' : 'start-0.5'}`} /></span>
          </button>
        )}
        <MenuRow to="/contact" icon="users" label={tr('المساعدة والدعم', 'Help & support')} />
        <MenuRow to="/about" icon="list" label={tr('عن تطبيق سمّها', 'About Sammha')} />
      </section>
      <h2 className="px-1 pt-1 text-[15px] font-extrabold text-muted">{tr('استكشف سمّها', 'Explore Sammha')}</h2>
      <section className="app-card !p-0 overflow-hidden">
        <MenuRow to="/market" icon="coins" label={tr('سوق الأسماء', 'Name market')} />
        <MenuRow to="/names" icon="tag" label={tr('سجل الأسماء المحجوزة', 'Reserved names registry')} />
        <MenuRow to="/events" icon="calendar" label={tr('مواعيد الإبل والمزادات', 'Camel calendar')} />
        <MenuRow to="/invest" icon="trophy" label={tr('استثمار الاسم', 'Name investment')} />
        <MenuRow to="/verify" icon="check" label={tr('التحقق من شهادة', 'Verify a certificate')} />
        <MenuRow to="/faq" icon="list" label={tr('الأسئلة الشائعة', 'FAQ')} />
      </section>
      <LangSwitch className="btn-ghost w-full" />
      <button type="button" className="w-full py-1 text-center text-[13.5px] font-bold text-muted underline" onClick={() => setDel(true)}>{tr('حذف الحساب', 'Delete account')}</button>
      <Sheet open={del} onClose={() => setDel(false)} title={tr('حذف الحساب', 'Delete account')}>
        <p className="text-[14.5px] leading-7">{tr('سيُغلق حسابك ولن تتمكن من الدخول به. تبقى أسماؤك المسجلة وفواتيرك محفوظة في سجل المنظمة كما يقتضي النظام. اطلب استرداد رصيد المحفظة قبل الحذف.', 'Your account will be closed and you will not be able to sign in. Your registered names and invoices stay in the organization registry as required. Refund your wallet balance before deleting.')}</p>
        <button className="btn mt-4 w-full bg-bad font-bold text-paper" disabled={delBusy} onClick={async () => {
          if (!(await verifyOwner(tr('تأكيد حذف الحساب', 'Confirm account deletion')))) return
          setDelBusy(true)
          try { await api.deleteMyAccount(); setUser(null); nav('/') } catch (e) { toast((e as Error).message, 'bad') } finally { setDelBusy(false) }
        }}>{delBusy ? '…' : tr('احذف حسابي نهائيًا', 'Delete my account')}</button>
        <button className="btn-ghost mt-2 w-full" onClick={() => setDel(false)}>{tr('تراجع', 'Back')}</button>
      </Sheet>
      <button className="flex w-full items-center justify-center gap-2 rounded-2xl border border-bad/30 bg-[#FDECEE] py-3 font-bold text-bad" onClick={async () => { await api.signOut(); setUser(null); nav('/') }}>{tr('تسجيل الخروج', 'Sign out')}</button>
      <p className="num text-center text-[12px] text-muted">{tr('الإصدار', 'Version')} 1.0 ({import.meta.env.VITE_BUILD ?? 'dev'})</p>
      <nav className="flex flex-wrap justify-center gap-x-4 gap-y-1 pt-1 text-[12.5px] text-muted"><L2 to="/terms">{tr('الشروط', 'Terms')}</L2><L2 to="/privacy">{tr('الخصوصية', 'Privacy')}</L2><L2 to="/refund">{tr('الاسترداد', 'Refunds')}</L2></nav>
    </div>
  )
}
