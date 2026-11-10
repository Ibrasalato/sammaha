import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon } from '../../components/dash'
import { useFines } from '../../components/Fines'
import { ProfileCompletion } from '../owner/Profile'
import { useClosed } from '../../components/SettingsUi'
import { Countdown, Empty, Loading } from '../../components/ui'
import { NAME_TYPES, TYPE_CLS, TYPE_LABEL } from '../../lib/config'
import { phaseOf } from '../../lib/demoApi'
import { date, humanLeft, num, sar } from '../../lib/format'
import { tr } from '../../lib/i18n'
import { api, useApp, useLoad } from '../../lib/store'
import type { Auction, AuctionPhase, NameType } from '../../lib/types'

/* ───────── mobile-app screens (Capacitor only): same API and rules as the website pages ───────── */

type Mark = 'leading' | 'outbid' | 'won' | 'lost' | null

function TypePill({ type }: { type: NameType }) {
  return <span className={`pill ${TYPE_CLS[type].pill}`}><span className={`h-2 w-2 rounded-full ${TYPE_CLS[type].dot}`} />{TYPE_LABEL[type]}</span>
}

function MarkPill({ m }: { m: Mark }) {
  if (!m) return null
  const x = {
    leading: ['bg-[#E2F0E8] text-ok', tr('أنت المتصدر', 'You are leading')],
    outbid: ['bg-bad/10 text-bad', tr('تم تجاوزك', 'Outbid')],
    won: ['bg-gold-soft text-gold-deep', tr('فزت بالمزاد', 'You won')],
    lost: ['bg-stone-deep text-muted', tr('لم يرسُ عليك', 'Not won')],
  }[m]
  return <span className={`pill ${x[0]}`}>{x[1]}</span>
}

/** One auction as a compact card: name and type, price, bids and time, one small button. */
export function AuctionTile({ a, mark, mine, watching, onWatch }: { a: Auction; mark?: Mark; mine?: number; watching?: boolean; onWatch?: () => void }) {
  const phase: AuctionPhase = a.paused ? 'live' : phaseOf(a)
  const ended = phase === 'ended'
  const price = a.finalPrice ?? a.currentPrice
  const urgent = phase === 'live' && Date.parse(a.endsAt) - Date.now() < 3600_000
  return (
    <div className={`app-card !p-3.5 ${a.paused ? 'opacity-80' : ''}`}>
      <Link to={`/auctions/${a.id}`} className="block">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1 text-start">
            <div className="flex items-center gap-2">
              {onWatch && (
                <button type="button" className="shrink-0 text-muted" aria-pressed={!!watching} aria-label={tr('تابع المزاد', 'Watch')} onClick={(e) => { e.preventDefault(); onWatch() }}>
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill={watching ? '#00513B' : 'none'} stroke={watching ? '#00513B' : 'currentColor'} strokeWidth="2"><path d="M6 3h12v18l-6-4-6 4z" /></svg>
                </button>
              )}
              <b className="truncate text-[21px] font-extrabold leading-tight">{a.name}</b>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5"><TypePill type={a.type} /><MarkPill m={mark ?? (a.isLeader && !ended ? 'leading' : null)} />{a.cancelled && <span className="pill bg-bad/10 text-bad">{tr('ملغى', 'Cancelled')}</span>}{a.paused && <span className="pill bg-info-soft text-info-deep">{tr('متوقف مؤقتًا', 'Paused')}</span>}</div>
          </div>
          <div className="shrink-0 text-end">
            <span className="block text-[12px] text-muted">{ended ? tr('سعر الترسية', 'Hammer price') : mine ? tr('مزايدتي', 'My bid') : a.bidCount ? tr('أعلى مزايدة', 'Top bid') : tr('السعر الافتتاحي', 'Opening price')}</span>
            <span className="num block text-[22px] font-extrabold leading-tight">{sar(mine ?? price)}</span>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 text-[13px]">
          <span className="flex items-center gap-1.5 text-muted"><Icon name="gavel" className="h-4 w-4" /><span className="num">{num(a.bidCount)}</span> {tr('مزايدة', 'bids')}</span>
          <span className={`flex items-center gap-1.5 font-bold ${urgent ? 'text-bad' : 'text-muted'}`}>
            <Icon name="clock" className="h-4 w-4" />
            {phase === 'live' && !a.paused && <Countdown to={a.endsAt} />}
            {phase === 'scheduled' && <><span className="font-medium">{tr('يبدأ بعد', 'Starts in')}</span><Countdown to={a.startsAt} /></>}
            {a.paused && <span>{tr('متوقف مؤقتًا', 'Paused')}</span>}
            {ended && <span>{date(a.endsAt)}</span>}
          </span>
        </div>
      </Link>
      {phase === 'live' && !a.paused && <Link to={`/auctions/${a.id}`} className="app-outline mt-3">{tr('زايد الآن', 'Bid now')}</Link>}
    </div>
  )
}

function Chips<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="app-chips" role="tablist">
      {options.map(([v, l]) => <button key={v} role="tab" aria-selected={v === value} className={`app-chip ${v === value ? 'on' : ''}`} onClick={() => onChange(v)}>{l}</button>)}
    </div>
  )
}

/** «المزادات»: all auctions / my bids / watchlist, in one screen. */
export function NativeAuctions() {
  const { user } = useApp()
  const nav = useNavigate()
  const [tab, setTab] = useState<'all' | 'mine' | 'watch'>('all')
  const [phase, setPhase] = useState<AuctionPhase | 'all'>('live')
  const [type, setType] = useState<NameType | 'all'>('all')
  const [q, setQ] = useState('')
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
      <h1 className="mb-3">{tr('المزادات', 'Auctions')}</h1>
      <div className="app-seg" role="tablist">
        {([['all', tr('كل المزادات', 'All auctions')], ['mine', `${tr('مزايداتي', 'My bids')}${bids.data?.length ? ` (${num(bids.data.length)})` : ''}`], ['watch', tr('المتابعة', 'Watching')]] as ['all' | 'mine' | 'watch', string][]).map(([v, l]) => (
          <button key={v} role="tab" aria-selected={tab === v} className={tab === v ? 'on' : ''} onClick={() => setTab(v)}>{l}</button>
        ))}
      </div>

      {needLogin ? (
        <Empty title={tr('سجّل الدخول لمتابعة مزايداتك', 'Sign in to follow your bids')}><button className="btn-primary" onClick={() => nav('/login')}>{tr('تسجيل الدخول', 'Sign in')}</button></Empty>
      ) : tab === 'all' ? (
        <>
          <div className="app-search"><Icon name="list" className="h-[18px] w-[18px] text-muted" /><input type="search" placeholder={tr('ابحث عن اسم…', 'Search a name…')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={tr('ابحث عن اسم', 'Search a name')} /></div>
          <Chips value={type} onChange={setType} options={[['all', tr('الكل', 'All')], ...NAME_TYPES.map((t) => [t, TYPE_LABEL[t]] as [NameType, string])]} />
          <Chips value={phase} onChange={setPhase} options={[['live', tr('جارية', 'Live')], ['scheduled', tr('قادمة', 'Upcoming')], ['ended', tr('منتهية', 'Ended')], ['all', tr('الكل', 'All')]]} />
          {all.loading && !all.data ? <Loading /> : all.data?.length
            ? <div className="space-y-3">{all.data.map((a) => <AuctionTile key={a.id} a={a} mark={markOf(a)} mine={myBid.get(a.id)?.amount} watching={watched.has(a.id)} onWatch={owner ? () => void toggle(a.id) : undefined} />)}</div>
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
    <Link to={to} className={`flex items-center gap-3 rounded-2xl border px-3.5 py-3 ${tone === 'red' ? 'border-bad/40 bg-[#FDECEE]' : 'border-gold/50 bg-gold-soft'}`}>
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${tone === 'red' ? 'bg-bad/10 text-bad' : 'bg-gold/20 text-gold-deep'}`}><Icon name={icon} className="h-[18px] w-[18px]" /></span>
      <span className="min-w-0 flex-1 text-[14px] font-bold leading-6">{title}</span>
      {aside && <span className="num shrink-0 text-[15px] font-extrabold">{aside}</span>}
    </Link>
  )
}

/** The owner's home: what needs attention first, then the wallet, the numbers and the auctions about to close. */
export function NativeDash() {
  const { user } = useApp()
  const requestsClosed = useClosed('requests')
  const wallet = useLoad(() => api.myWallet(), [])
  const reqs = useLoad(() => api.myRequests(), [])
  const bids = useLoad(() => api.myBids(), [], 15000)
  const invoices = useLoad(() => api.myInvoices(), [])
  const names = useLoad(() => api.myNames(), [])
  const certs = useLoad(() => api.myCertificates(), [])
  const ban = useLoad(() => api.myBan(), [])
  const fines = useFines()
  const live = useLoad(() => api.listAuctions({ phase: 'live' }), [], 15000)
  const finesDue = fines.list?.filter((f) => f.state === 'due') ?? []
  const unpaid = invoices.data?.filter((i) => i.status === 'unpaid') ?? []
  const liveBids = bids.data?.filter((b) => phaseOf(b.auction) === 'live') ?? []
  const outbid = liveBids.filter((b) => !b.auction.isLeader)
  const pendingPay = reqs.data?.filter((r) => r.status === 'pending_payment') ?? []
  const todo = unpaid.length + pendingPay.length + outbid.length + finesDue.length
  const soon = (liveBids.length ? liveBids.map((b) => b.auction).sort((x, y) => Number(!!x.isLeader) - Number(!!y.isLeader) || Date.parse(x.endsAt) - Date.parse(y.endsAt)) : [...(live.data ?? [])].sort((a, b) => Date.parse(a.endsAt) - Date.parse(b.endsAt))).slice(0, 4)

  return (
    <div className="space-y-3.5">
      <div>
        <h1>{tr('أهلاً بك يا', 'Welcome,')} {user?.fullName.split(' ')[0] ?? ''}</h1>
        <p className="text-[14px] text-muted">{todo ? tr(`لديك ${todo === 1 ? 'إجراء واحد' : todo === 2 ? 'إجراءان' : `${todo} إجراءات`} بانتظارك.`, `You have ${todo} pending ${todo === 1 ? 'action' : 'actions'}.`) : tr('تابع مزاداتك وطلب أسماء جديدة.', 'Follow your auctions and request new names.')}</p>
      </div>

      {ban.data && <Alert to="/dashboard/profile" icon="lock" title={ban.data.endsOn ? tr(`حسابك محظور من المشاركة حتى ${date(ban.data.endsOn)}`, `Your account is barred until ${date(ban.data.endsOn)}`) : tr('حسابك محظور من المشاركة حتى إشعار آخر', 'Your account is barred until further notice')} />}
      {outbid.map((b) => <Alert key={b.id} to={`/auctions/${b.auctionId}`} icon="alert" title={tr(`تم تجاوز مزايدتك على «${b.auction.name}»`, `You were outbid on «${b.auction.name}»`)} aside={sar(b.auction.currentPrice)} />)}
      {unpaid.map((i) => <Alert key={i.id} to={`/dashboard/invoices/${i.id}`} tone="gold" icon="receipt" title={tr(`سدّد فاتورة «${i.name}» لإصدار الشهادة`, `Pay the invoice for «${i.name}» to get the certificate`)} aside={sar(i.amountDue)} />)}
      {pendingPay.map((r) => <Alert key={r.id} to={`/dashboard/requests/${r.id}`} tone="gold" icon="file" title={tr(`الطلب ${r.number}: سدّد الضمان لإكماله`, `Request ${r.number}: pay the guarantee to complete it`)} />)}
      {!!finesDue.length && <Alert to="/dashboard/violations" icon="alert" title={tr(`مخالفات وغرامات مستحقة (${finesDue.length})`, `Violations and fines due (${finesDue.length})`)} aside={sar(finesDue.reduce((t, f) => t + f.amount, 0))} />}
      <ProfileCompletion />

      <Link to="/dashboard/wallet" className="app-wallet">
        <span className="min-w-0 flex-1"><span className="block text-[13px] text-paper/75">{tr('رصيد المحفظة', 'Wallet balance')}</span><span className="num block text-[28px] font-extrabold leading-tight">{wallet.data ? sar(wallet.data.balance) : '…'}</span></span>
        <span className="grid h-11 w-11 place-items-center rounded-full bg-gold text-pine-deep"><Icon name="plus" className="h-5 w-5" /></span>
      </Link>

      <div className="grid grid-cols-2 gap-2.5">
        <Link to="/dashboard/requests/new" className="app-stat !border-gold/60 !bg-gold-soft"><Icon name="tag" className="h-6 w-6 text-gold-deep" /><span className="!text-[14px] !text-gold-deep">{requestsClosed ? tr('طلب شعار (مغلق حاليًا)', 'New request (closed)') : tr('طلب شعار جديد', 'New name request')}</span></Link>
        <Link to="/dashboard/names" className="app-stat"><Icon name="shield" className="h-6 w-6 text-pine" /><span className="!text-[14px]">{tr('أسمائي', 'My names')}</span><b className="num text-[20px]">{num(names.data?.length ?? 0)}</b></Link>
        <Link to="/dashboard/requests" className="app-stat"><Icon name="file" className="h-6 w-6 text-pine" /><span className="!text-[14px]">{tr('طلبات قيد المراجعة', 'Under review')}</span><b className="num text-[20px]">{num(reqs.data?.filter((r) => r.status === 'under_review').length ?? 0)}</b></Link>
        <Link to="/dashboard/invoices" className="app-stat"><Icon name="receipt" className="h-6 w-6 text-pine" /><span className="!text-[14px]">{tr('الفواتير', 'Invoices')}</span><b className="num text-[20px]">{num(unpaid.length)}</b></Link>
      </div>

      <div className="flex items-center justify-between pt-1">
        <h2 className="flex items-center gap-1.5 text-[18px]"><Icon name="clock" className="h-[18px] w-[18px] text-gold-deep" />{liveBids.length ? tr('مزايداتي الجارية', 'My live bids') : tr('مزادات قريبة من الانتهاء', 'Closing soon')}</h2>
        <Link to="/auctions" className="text-[14px] font-bold text-pine">{tr('الكل', 'All')}</Link>
      </div>
      {soon.length ? (
        <ul className="space-y-2.5">
          {soon.map((a) => (
            <li key={a.id}>
              <Link to={`/auctions/${a.id}`} className="app-row">
                <span className="min-w-0 flex-1 text-start"><b className="block truncate text-[17px]">{a.name}</b><span className="flex items-center gap-2 text-[13px] text-muted"><TypePill type={a.type} /><span>{tr('ينتهي خلال', 'Ends in')} {humanLeft(Date.parse(a.endsAt) - Date.now())}</span></span></span>
                <span className="text-end"><span className="num block text-[17px] font-extrabold">{sar(a.currentPrice)}</span><span className="text-[12px] text-muted">{a.isLeader ? tr('أنت المتصدر', 'You lead') : tr('أعلى مزايدة', 'top bid')}</span></span>
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
import { Sheet } from '../../components/AppChrome'
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
      <Icon name={s.icon} className={`h-7 w-7 ${gold ? 'text-gold-deep' : 'text-pine'}`} />
      <span>{s.title}</span>
      {!s.open && <span className="text-[11px] font-medium text-muted">{s.soon ? tr('قريبًا', 'Soon') : tr('مغلقة', 'Closed')}</span>}
    </button>
  )
  return (
    <div>
      <h1>{tr('الخدمات الإلكترونية', 'E-services')}</h1>
      <p className="mb-3 text-[14px] text-muted">{tr('أنجز معاملاتك بأسماء الإبل بسهولة وأمان.', 'Handle your camel-name transactions easily and safely.')}</p>
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
        <div className="flex items-center justify-between"><span className="text-[13px] text-paper/75">{tr('رصيد المحفظة', 'Wallet balance')}</span><Icon name="wallet" className="h-5 w-5 text-gold-light" /></div>
        <p className="num mt-1 text-[34px] font-extrabold leading-tight">{data ? sar(data.balance) : '…'}</p>
      </section>
      <div className="grid grid-cols-3 gap-2.5">
        <button className="app-tile" onClick={() => setTop(true)}><Icon name="plus" className="h-6 w-6 text-pine" /><span>{tr('شحن الرصيد', 'Top up')}</span></button>
        <button className="app-tile" onClick={() => document.getElementById('wallet-bank')?.scrollIntoView({ behavior: 'smooth' })}><Icon name="arrow" className="h-6 w-6 text-pine" /><span>{tr('سحب الرصيد', 'Withdraw')}</span></button>
        <button className="app-tile" onClick={() => document.getElementById('wallet-txs')?.scrollIntoView({ behavior: 'smooth' })}><Icon name="file" className="h-6 w-6 text-pine" /><span>{tr('كشف الحركات', 'Statement')}</span></button>
      </div>
      <p className="text-[13px] leading-6 text-muted">{tr('رصيد المحفظة لسداد الضمانات والفواتير، ويمكنك طلب استرداده إلى حسابك البنكي.', 'The wallet pays guarantees and invoices; you can ask to refund it to your bank account.')}</p>
      <h2 id="wallet-txs" className="text-[18px]">{tr('آخر العمليات', 'Recent activity')}</h2>
      {loading && !data ? <Loading /> : data?.txs.length ? (
        <ul className="space-y-2">
          {data.txs.map((t) => (
            <li key={t.id} className="app-row">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${t.amount > 0 ? 'bg-[#E2F0E8] text-ok' : 'bg-stone text-muted'}`}><Icon name={t.amount > 0 ? 'plus' : 'receipt'} className="h-[18px] w-[18px]" /></span>
              <span className="min-w-0 flex-1 text-start"><b className="block truncate text-[15px]">{K[t.kind] ?? t.kind}</b><span className="block truncate text-[12.5px] text-muted">{LT(t.note ?? '')} · {date(t.createdAt)}</span></span>
              <span className={`num shrink-0 text-[16px] font-extrabold ${t.amount > 0 ? 'text-ok' : ''}`}>{t.amount > 0 ? '+' : '−'}{sar(Math.abs(t.amount))}</span>
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
        <Avatar name={user.fullName} src={user.avatarUrl} size={88} ring />
        <b className="mt-1 text-[20px]">{user.fullName}</b>
        <span className="text-[13px] text-muted">{tr('مالك إبل', 'Camel owner')}</span>
        <span className="text-[13px] font-bold text-pine">{tr('عرض الملف الشخصي وتعديله', 'View and edit your profile')}</span>
      </L2>
      <div className="grid grid-cols-4 gap-2">
        <L2 to="/dashboard/wallet" className="app-stat"><Icon name="wallet" className="h-5 w-5 text-pine" /><span>{tr('المحفظة', 'Wallet')}</span><b className="num text-[13px]">{wallet.data ? sar(wallet.data.balance) : '…'}</b></L2>
        <L2 to="/dashboard/invoices" className="app-stat"><Icon name="receipt" className="h-5 w-5 text-pine" /><span>{tr('الفواتير', 'Invoices')}</span><b className="num text-[15px]">{num(unpaid)}</b></L2>
        <L2 to="/dashboard/names" className="app-stat"><Icon name="tag" className="h-5 w-5 text-pine" /><span>{tr('أسمائي', 'Names')}</span><b className="num text-[15px]">{num(names.data?.length ?? 0)}</b></L2>
        <L2 to="/dashboard/certificates" className="app-stat"><Icon name="file" className="h-5 w-5 text-pine" /><span>{tr('الشهادات', 'Certs')}</span><b className="num text-[15px]">{num(certs.data?.length ?? 0)}</b></L2>
      </div>
      <section className="app-card !p-0 overflow-hidden">
        <MenuRow to="/dashboard/names" icon="tag" label={tr('أسمائي', 'My names')} />
        <MenuRow to="/dashboard/camels" icon="shield" label={tr('إبلي', 'My camels')} />
        <MenuRow to="/dashboard/certificates" icon="file" label={tr('شهاداتي', 'My certificates')} />
        <MenuRow to="/dashboard/wallet" icon="wallet" label={tr('المحفظة', 'Wallet')} />
        <MenuRow to="/dashboard/invoices" icon="receipt" label={tr('الفواتير', 'Invoices')} badge={unpaid} />
        <MenuRow to="/dashboard/violations" icon="alert" label={tr('المخالفات', 'Violations')} badge={due} />
        <MenuRow to="/dashboard/requests" icon="list" label={tr('طلباتي', 'My requests')} />
      </section>
      <section className="app-card !p-0 overflow-hidden">
        <MenuRow to="/dashboard/tickets" icon="users" label={tr('الشكاوى والاستفسارات', 'Complaints & enquiries')} badge={openTickets} />
        <MenuRow to="/dashboard/settings" icon="settings" label={tr('الإعدادات والأمان والتفويض', 'Settings, security & delegation')} />
        <MenuRow to="/contact" icon="users" label={tr('المساعدة والدعم', 'Help & support')} />
        <MenuRow to="/faq" icon="list" label={tr('الأسئلة الشائعة', 'FAQ')} />
        <MenuRow to="/verify" icon="check" label={tr('التحقق من شهادة', 'Verify a certificate')} />
        <MenuRow to="/names" icon="tag" label={tr('سجل الأسماء', 'Names registry')} />
      </section>
      <div className="flex gap-2"><LangSwitch className="btn-ghost flex-1" /></div>
      <button className="btn w-full border border-bad/40 bg-[#FDECEE] font-bold text-bad" onClick={async () => { await api.signOut(); setUser(null); nav('/') }}>{tr('تسجيل الخروج', 'Sign out')}</button>
      <nav className="flex flex-wrap justify-center gap-x-4 gap-y-1 pt-1 text-[12.5px] text-muted"><L2 to="/terms">{tr('الشروط', 'Terms')}</L2><L2 to="/privacy">{tr('الخصوصية', 'Privacy')}</L2><L2 to="/refund">{tr('الاسترداد', 'Refunds')}</L2></nav>
    </div>
  )
}
