/**
 * Demo backend: the full business logic running in the browser on localStorage,
 * so the platform can be tried on GitHub Pages without a server.
 * The production backend (supabase/migrations) implements the same rules in SQL.
 */
import { ApiError } from './api'
import type { PayMethod, SammhaApi, SignUpInput } from './api'
import { RULES, SUPER_ADMIN_EMAIL } from './config'
import { namesCount } from './format'
import { SEED_EVENTS } from './events'
import { certNo } from './cert'
import { findMatches, normalizeName, validateName } from './names'
import { emailTicketEvent, normalizePhone, publicTicket, validateTicket } from './tickets'
import type { MatchSource } from './names'
import type {
  AppNotification, CamelEvent, Auction, Ticket, AuctionPhase, Bid, Candidate, Invoice, LogoRequest, NameCheck, NameType, ReservedName,
  User, WalletTx,
} from './types'

interface DemoUser extends User { password: string }
interface DB {
  v: number
  seq: number
  users: DemoUser[]
  requests: LogoRequest[]
  auctions: Auction[]
  bids: Bid[]
  reserved: ReservedName[]
  txs: WalletTx[]
  invoices: Invoice[]
  events: CamelEvent[]
  notes: AppNotification[]
  tickets: Ticket[]
}

const KEY = 'sammha-demo-db'
const SESSION = 'sammha-demo-session'
const VERSION = 6

const now = () => Date.now()
const iso = (t: number) => new Date(t).toISOString()
const H = 3600_000
const D = 24 * H
const round2 = (n: number) => Math.round(n * 100) / 100

function uid(db: DB, prefix: string) {
  db.seq += 1
  return `${prefix}${db.seq.toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export function phaseOf(a: Pick<Auction, 'startsAt' | 'endsAt'>, t = now()): AuctionPhase {
  if (t < Date.parse(a.startsAt)) return 'scheduled'
  if (t < Date.parse(a.endsAt)) return 'live'
  return 'ended'
}

// ───────────────────────── seed ─────────────────────────
function seed(): DB {
  const t = now()
  const db: DB = { v: VERSION, seq: 100, users: [], requests: [], auctions: [], bids: [], reserved: [], txs: [], invoices: [], events: structuredClone(SEED_EVENTS), notes: [], tickets: [] }
  const mkUser = (id: string, fullName: string, phone: string, role: User['role'], email: string): DemoUser =>
    ({ id, fullName, phone, email, role, password: '123456', createdAt: iso(t - 90 * D) })

  db.users.push(
    mkUser('u-owner', 'سعد بن ناصر العتيبي', '0500000001', 'owner', 'owner@demo.sa'),
    mkUser('u-staff', 'لجنة الاعتماد', '0500000002', 'committee', 'committee@demo.sa'),
    superAdmin(t),
    mkUser('u-b1', 'مزرعة الوسم للإبل', '0500000003', 'owner', 'b1@demo.sa'),
    mkUser('u-b2', 'فهد عبدالله الدوسري', '0500000004', 'owner', 'b2@demo.sa'),
    mkUser('u-b3', 'نايف سالم المري', '0500000005', 'owner', 'b3@demo.sa'),
  )

  const legacy: [string, NameType, string, number, number][] = [
    ['الفاخر', 'qaadan', 'مزرعة الوسم للإبل', 4200, 300],
    ['سلطان', 'qaadan', 'فهد عبدالله الدوسري', 12500, 260],
    ['مرهوب', 'qaadan', 'نايف سالم المري', 3100, 240],
    ['شامخ', 'qaadan', 'مزرعة الوسم للإبل', 2750, 200],
    ['البيرق', 'qaadan', 'فهد عبدالله الدوسري', 8800, 180],
    ['الأدهم', 'qaadan', 'نايف سالم المري', 1900, 150],
    ['راعد', 'qaadan', 'مزرعة الوسم للإبل', 650, 120],
    ['الشعلة', 'bakkar', 'فهد عبدالله الدوسري', 9600, 280],
    ['الغيمة', 'bakkar', 'مزرعة الوسم للإبل', 5400, 250],
    ['مزنة', 'bakkar', 'نايف سالم المري', 2300, 210],
    ['الهدباء', 'bakkar', 'مزرعة الوسم للإبل', 7100, 190],
    ['شقحاء', 'bakkar', 'فهد عبدالله الدوسري', 3900, 160],
    ['الوضحى', 'bakkar', 'نايف سالم المري', 1250, 110],
    ['غزلان', 'bakkar', 'مزرعة الوسم للإبل', 980, 90],
  ]
  for (const [name, type, ownerName, price, daysAgo] of legacy) {
    const owner = db.users.find((u) => u.fullName === ownerName)
    db.reserved.push({ id: uid(db, 'r'), name, normalized: normalizeName(name), type, ownerId: owner?.id, ownerName, price, acquiredAt: iso(t - daysAgo * D), source: 'legacy' })
  }

  let reqNo = 1000
  const mkRequest = (userId: string, type: NameType, names: string[], status: LogoRequest['status'], daysAgo: number): LogoRequest => {
    const u = db.users.find((x) => x.id === userId)!
    const r: LogoRequest = {
      id: uid(db, 'q'), number: `SM-${++reqNo}`, userId, ownerName: u.fullName, type,
      candidates: names.map((n) => ({ id: uid(db, 'c'), name: n, normalized: normalizeName(n), status: 'pending', similar: [] })),
      status, depositAmount: RULES.depositAmount, depositPaid: status !== 'pending_payment',
      depositState: status === 'pending_payment' ? 'none' : 'held', createdAt: iso(t - daysAgo * D),
      submittedAt: status === 'pending_payment' ? undefined : iso(t - daysAgo * D + 600_000),
    }
    db.requests.push(r)
    if (r.depositPaid) db.txs.push({ id: uid(db, 't'), userId, amount: -RULES.depositAmount, kind: 'deposit', note: `ضمان مزاد الطلب ${r.number}`, createdAt: r.submittedAt! })
    return r
  }
  const mkAuction = (r: LogoRequest, c: Candidate, startOff: number, endOff: number, bids: [string, number][]) => {
    c.status = 'accepted'
    const a: Auction = {
      id: uid(db, 'a'), requestId: r.id, candidateId: c.id, name: c.name, type: r.type, requesterId: r.userId,
      openingPrice: RULES.openingPrice, minIncrement: RULES.minIncrement, startsAt: iso(t + startOff), endsAt: iso(t + endOff),
      currentPrice: RULES.openingPrice, bidCount: 0, settled: false,
    }
    c.auctionId = a.id
    db.auctions.push(a)
    let bt = Date.parse(a.startsAt) + 20 * 60_000
    for (const [userId, amount] of bids) {
      const u = db.users.find((x) => x.id === userId)!
      db.bids.push({ id: uid(db, 'b'), auctionId: a.id, userId, bidderLabel: maskName(u.fullName), amount, createdAt: iso(Math.min(bt, t - 60_000)) })
      bt += 47 * 60_000
      a.currentPrice = amount
      a.bidCount += 1
      a.leaderId = userId
      a.leaderLabel = maskName(u.fullName)
    }
    return a
  }
  const accept = (r: LogoRequest, rejectIdx: number[] = []) => {
    r.status = 'accepted'
    r.reviewedAt = iso(Date.parse(r.submittedAt!) + D)
    r.reviewerName = 'لجنة الاعتماد'
    rejectIdx.forEach((i) => { r.candidates[i].status = 'rejected'; r.candidates[i].rejectReason = 'مشابه لاسم مسجل مسبقًا' })
  }

  // Demo owner's requests
  const r1 = mkRequest('u-owner', 'qaadan', ['الصارم', 'المهيب', 'الشامخ'], 'under_review', 5)
  accept(r1, [2])
  r1.candidates[2].similar = [{ name: 'شامخ', type: 'qaadan', source: 'reserved', score: 1 }]
  mkAuction(r1, r1.candidates[0], -2 * D, 3 * H + 14 * 60_000, [['u-b2', 120], ['u-b1', 200], ['u-b2', 260]])
  mkAuction(r1, r1.candidates[1], -2 * D, 26 * H, [])

  const r2 = mkRequest('u-owner', 'bakkar', ['المزون', 'العنود', 'غزلانه'], 'under_review', 1)
  void r2

  const r3 = mkRequest('u-owner', 'bakkar', ['شقحا', 'الشعله', 'هدبا'], 'under_review', 20)
  r3.status = 'rejected'
  r3.reviewedAt = iso(t - 19 * D)
  r3.reviewerName = 'لجنة الاعتماد'
  r3.reviewNote = 'الأسماء الثلاثة مطابقة أو شبه مطابقة لأسماء مسجلة'
  r3.candidates.forEach((c) => { c.status = 'rejected'; c.rejectReason = 'مشابه لاسم مسجل' })
  r3.depositState = 'refunded'
  db.txs.push({ id: uid(db, 't'), userId: 'u-owner', amount: RULES.depositAmount, kind: 'refund', note: `استرداد ضمان الطلب ${r3.number} (مرفوض)`, createdAt: r3.reviewedAt })
  db.txs.push({ id: uid(db, 't'), userId: 'u-owner', amount: 500, kind: 'topup', note: 'شحن المحفظة', createdAt: iso(t - 30 * D) })

  // Other owners' auctions
  const r4 = mkRequest('u-b1', 'bakkar', ['الريم', 'الوجناء', 'سحابة'], 'under_review', 4)
  accept(r4)
  mkAuction(r4, r4.candidates[0], -3 * D, 55 * 60_000, [['u-b2', 300], ['u-b3', 450], ['u-b2', 700], ['u-b3', 1150]])
  mkAuction(r4, r4.candidates[1], -3 * D, 2 * D + 5 * H, [['u-owner', 80]])
  mkAuction(r4, r4.candidates[2], D + 4 * H, 4 * D, [])

  const r5 = mkRequest('u-b3', 'qaadan', ['النمر', 'الصقر', 'هزاع'], 'under_review', 6)
  accept(r5, [1])
  r5.candidates[1].rejectReason = 'اسم شائع محجوز لفعاليات المنظمة'
  mkAuction(r5, r5.candidates[0], -4 * D, 9 * H, [['u-b1', 500], ['u-b2', 900]])
  mkAuction(r5, r5.candidates[2], -5 * D, -2 * H, []) // ended, no bids → requester wins at deposit price

  const r6 = mkRequest('u-b2', 'qaadan', ['مدعث', 'عذاب', 'الحايل'], 'under_review', 8)
  accept(r6)
  mkAuction(r6, r6.candidates[0], -6 * D, -5 * H, [['u-b3', 150], ['u-owner', 400]]) // ended, demo owner wins
  mkAuction(r6, r6.candidates[1], 2 * D, 5 * D, [])
  mkAuction(r6, r6.candidates[2], -2 * D, 2 * D, [['u-b1', 60]])

  // Waiting for the committee
  const r7 = mkRequest('u-b2', 'bakkar', ['شعلة', 'الهدبا', 'نجلاء'], 'under_review', 0.3)
  const r8 = mkRequest('u-b1', 'qaadan', ['الفاخر', 'سلطانه', 'فهاد'], 'under_review', 0.1)
  // r8 deliberately includes an exact match (seeded legacy data); real submissions block exact matches.
  void r7; void r8

  db.txs.push({ id: uid(db, 't'), userId: 'u-b2', amount: 2000, kind: 'topup', note: 'شحن المحفظة', createdAt: iso(t - 40 * D) })
  seedTickets(db, t)
  // compute similar hits for pending requests
  for (const r of db.requests) for (const c of r.candidates) if (!c.similar.length) c.similar = similarFor(db, c.normalized, r.id)
  return db
}

export function maskName(full: string) {
  const parts = full.trim().split(/\s+/)
  if (parts.length === 1) return `${parts[0].slice(0, 2)}…`
  return `${parts[0]} ${parts[parts.length - 1].slice(0, 2)}…`
}

function notify(db: DB, userId: string, kind: AppNotification['kind'], title: string, body: string, link?: string) {
  db.notes.push({ id: uid(db, 'n'), userId, kind, title, body, link, createdAt: iso(now()), read: false })
}

/** The super admin has no password in the demo: the first sign-in on the staff portal sets it. */
function superAdmin(t: number): DemoUser {
  return { id: 'u-super', fullName: 'إبراهيم صلاح', phone: '0500000010', email: SUPER_ADMIN_EMAIL, role: 'admin', password: '', createdAt: iso(t - 120 * D) }
}
const isSuper = (u: Pick<User, 'email'>) => u.email.toLowerCase() === SUPER_ADMIN_EMAIL

function seedTickets(db: DB, t: number) {
  const mk = (n: number, ago: number, x: Omit<Ticket, 'id' | 'number' | 'createdAt' | 'updatedAt' | 'messages'>, replies: [Ticket['messages'][number]['by'], string, string, boolean?][] = []) => {
    const created = t - ago
    db.tickets.push({
      ...x, id: `tk${n}`, number: `BL-26${String(n).padStart(4, '0')}`, createdAt: iso(created), updatedAt: iso(created + replies.length * H),
      messages: replies.map(([by, author, body, internal], i) => ({ id: `tm${n}${i}`, by, author, body, internal, createdAt: iso(created + (i + 1) * H) })),
    })
  }
  mk(1, 6 * D, { kind: 'inquiry', topic: 'استرداد الضمان', subject: 'متى يرجع ضمان الطلب المرفوض؟', name: 'فهد عبدالله الدوسري', phone: '0500000004', userId: 'u-b2', refNumber: 'SM-1003', message: 'رُفض طلبي ولم أجد مبلغ الضمان في المحفظة، أرجو التوضيح.', status: 'answered', priority: 'normal' },
    [['staff', 'لجنة الاعتماد', 'حياك الله، الضمان أُعيد إلى محفظتك فور رفض الطلب، وتجده في سجل الحركات بعنوان «استرداد ضمان». يمكنك استخدامه في طلب جديد.']])
  mk(2, 2 * D, { kind: 'report', topic: 'استخدام اسم بغير حق', subject: 'اسم مسجل باسمي يُستخدم في مزاين', name: 'سعد بن ناصر العتيبي', phone: '0500000001', userId: 'u-owner', email: 'owner@demo.sa', message: 'لاحظت أن اسم «الهيلع» المسجل باسمي يُستخدم على فردي آخر في مزاين محلية. أرفق اسم المشارك عند الطلب.', status: 'in_progress', priority: 'urgent', assignee: 'لجنة الاعتماد' },
    [['staff', 'لجنة الاعتماد', 'تم التحقق من الشهادة، وجارٍ التواصل مع اللجنة المنظمة.', true]])
  mk(3, 5 * H, { kind: 'complaint', topic: 'الفواتير والدفع', subject: 'الدفع بمدى لم يكتمل', name: 'نايف سالم المري', phone: '0500000005', userId: 'u-b3', message: 'حاولت سداد الفاتورة ببطاقة مدى وظهرت رسالة خطأ، ولم يُخصم المبلغ.', status: 'new', priority: 'normal' })
  db.seq += 3
}

// ───────────────────────── persistence ─────────────────────────
function load(): DB {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const db = JSON.parse(raw) as DB
      if (db.v === VERSION) return db
      if (db.v === 4) { db.tickets = []; seedTickets(db, now()); db.v = 5 }
      if (db.v === 5) {
        if (!db.users.some(isSuper)) db.users.push(superAdmin(now()))
        db.v = VERSION; save(db); return db
      }
    }
  } catch { /* storage unavailable */ }
  const db = seed()
  save(db)
  return db
}
function save(db: DB) {
  try { localStorage.setItem(KEY, JSON.stringify(db)) } catch { /* ignore */ }
}
let memSession: string | null = null
function getSession(): string | null {
  try { return localStorage.getItem(SESSION) } catch { return memSession }
}
function setSession(id: string | null) {
  memSession = id
  try { if (id) localStorage.setItem(SESSION, id); else localStorage.removeItem(SESSION) } catch { /* ignore */ }
}
export function resetDemo() {
  try { localStorage.removeItem(KEY); localStorage.removeItem(SESSION) } catch { /* ignore */ }
}

const delay = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(structuredClone(v)), 120))

// ───────────────────────── rules ─────────────────────────
function matchPool(db: DB, excludeRequestId?: string): MatchSource[] {
  const pool: MatchSource[] = db.reserved.map((r) => ({ name: r.name, normalized: r.normalized, type: r.type, source: 'reserved' }))
  for (const r of db.requests) {
    if (r.id === excludeRequestId) continue
    if (r.status !== 'under_review' && r.status !== 'accepted' && r.status !== 'pending_payment') continue
    for (const c of r.candidates) {
      if (c.status === 'rejected') continue
      const a = c.auctionId ? db.auctions.find((x) => x.id === c.auctionId) : undefined
      if (a?.settled) continue // already in reserved
      pool.push({ name: c.name, normalized: c.normalized, type: r.type, source: a ? 'auction' : 'request' })
    }
  }
  return pool
}

function similarFor(db: DB, normalized: string, excludeRequestId?: string) {
  return findMatches(normalized, matchPool(db, excludeRequestId))
}

function checkNamesIn(db: DB, names: string[], excludeRequestId?: string): NameCheck[] {
  const seen = new Map<string, number>()
  return names.map((name, i) => {
    const normalized = normalizeName(name)
    const invalid = validateName(name)
    if (invalid) return { name, normalized, verdict: 'invalid', message: invalid, hits: [] }
    const dupAt = seen.get(normalized)
    seen.set(normalized, i)
    if (dupAt !== undefined) return { name, normalized, verdict: 'duplicate', message: 'مكرر داخل نفس الطلب', hits: [] }
    const hits = similarFor(db, normalized, excludeRequestId)
    const exact = hits.find((h) => h.score === 1)
    if (exact) return { name, normalized, verdict: 'exact', message: `مطابق تمامًا لاسم ${exact.source === 'reserved' ? 'مسجل' : 'تحت الطلب أو المزاد'}: «${exact.name}»`, hits }
    if (hits.length) return { name, normalized, verdict: 'similar', message: `متاح، وستراجع اللجنة تشابهه مع ${namesCount(hits.length)}`, hits }
    return { name, normalized, verdict: 'available', message: 'متاح', hits: [] }
  })
}

function balanceOf(db: DB, userId: string) {
  return round2(db.txs.filter((t) => t.userId === userId).reduce((s, t) => s + t.amount, 0))
}

/** Owner may cancel before review, or after acceptance as long as none of its auctions has started. */
function cancellable(db: DB, r: LogoRequest, t = now()) {
  if (r.status === 'pending_payment' || r.status === 'under_review') return true
  if (r.status !== 'accepted') return false
  return r.candidates.every((c) => {
    const a = c.auctionId ? db.auctions.find((x) => x.id === c.auctionId) : undefined
    return !a || (t < Date.parse(a.startsAt) && a.bidCount === 0)
  })
}
const withCancel = (db: DB, r: LogoRequest): LogoRequest => ({ ...r, cancellable: cancellable(db, r) })

function refundDeposit(db: DB, r: LogoRequest, why: string) {
  if (r.depositState !== 'held') return
  r.depositState = 'refunded'
  db.txs.push({ id: uid(db, 't'), userId: r.userId, amount: r.depositAmount, kind: 'refund', note: `استرداد ضمان الطلب ${r.number} (${why})`, createdAt: iso(now()) })
  notify(db, r.userId, 'refund', 'أُعيد ضمان المزاد إلى محفظتك', `${r.depositAmount} ريال من الطلب ${r.number} (${why}).`, '/dashboard/wallet')
}

let invSeq = 0
function issueInvoice(db: DB, a: Auction, buyer: User, price: number, depositApplied: number) {
  invSeq = Math.max(invSeq, db.invoices.length)
  const vat = round2((price * RULES.vatRate) / (1 + RULES.vatRate))
  const inv: Invoice = {
    id: uid(db, 'i'), number: `INV-${new Date().getFullYear()}-${String(++invSeq).padStart(5, '0')}`,
    userId: buyer.id, buyerName: buyer.fullName, buyerPhone: buyer.phone, auctionId: a.id, name: a.name, type: a.type,
    total: price, vat, subtotal: round2(price - vat), depositApplied, amountDue: round2(price - depositApplied),
    status: price - depositApplied <= 0 ? 'paid' : 'unpaid', issuedAt: iso(now()),
  }
  if (inv.status === 'paid') inv.paidAt = inv.issuedAt
  db.invoices.push(inv)
  return inv
}

/** Settle every auction whose end time has passed. Mirrors public.settle_due_auctions() in SQL. */
function sweep(db: DB) {
  let changed = false
  for (const a of db.auctions) {
    if (a.settled || phaseOf(a) !== 'ended') continue
    const r = db.requests.find((x) => x.id === a.requestId)!
    const noBids = a.bidCount === 0
    const winnerId = noBids ? a.requesterId : a.leaderId!
    const winner = db.users.find((u) => u.id === winnerId)!
    const price = noBids ? a.openingPrice : a.currentPrice
    let depositApplied = 0
    if (winnerId === r.userId && r.depositState === 'held') {
      depositApplied = Math.min(r.depositAmount, price)
      r.depositState = 'applied'
    }
    issueInvoice(db, a, winner, price, depositApplied)
    db.reserved.push({ id: uid(db, 'r'), name: a.name, normalized: normalizeName(a.name), type: a.type, ownerId: winner.id, ownerName: winner.fullName, price, acquiredAt: a.endsAt, source: 'auction' })
    Object.assign(a, { settled: true, winnerId, winnerName: winner.fullName, finalPrice: price, wonByRequester: winnerId === r.userId })
    notify(db, winnerId, 'won', `رسا عليك اسم «${a.name}»`, `بسعر ${price} ريال. فاتورتك الإلكترونية جاهزة.`, '/dashboard/invoices')
    for (const uidLost of new Set(db.bids.filter((b) => b.auctionId === a.id && b.userId !== winnerId).map((b) => b.userId))) {
      notify(db, uidLost, 'lost', `انتهى مزاد «${a.name}»`, `رسا الاسم بسعر ${price} ريال.`, `/auctions/${a.id}`)
    }
    changed = true
    // all of the request's auctions settled and the requester won none → refund the guarantee
    const reqAuctions = db.auctions.filter((x) => x.requestId === r.id)
    const pendingNames = r.candidates.some((c) => c.status === 'accepted' && !c.auctionId)
    if (!pendingNames && reqAuctions.every((x) => x.settled) && r.depositState === 'held') refundDeposit(db, r, 'لم يُرسَ عليك أي اسم')
  }
  return changed
}

function tx<T>(fn: (db: DB) => T): Promise<T> {
  const db = load()
  if (sweep(db)) save(db)
  try {
    const out = fn(db)
    save(db)
    return delay(out)
  } catch (e) {
    return Promise.reject(e)
  }
}

function me(db: DB): DemoUser {
  const id = getSession()
  const u = db.users.find((x) => x.id === id)
  if (!u) throw new ApiError('سجّل الدخول أولًا')
  if (u.active === false) { setSession(null); throw new ApiError('هذا الحساب موقوف') }
  return u
}
function staff(db: DB): DemoUser {
  const u = me(db)
  if (u.role === 'owner') throw new ApiError('هذه الصفحة للجنة الاعتماد فقط')
  return u
}
function superOnly(db: DB): DemoUser {
  const u = me(db)
  if (u.role !== 'admin') throw new ApiError('هذه العملية لمدير النظام فقط')
  return u
}
function targetUser(db: DB, id: string, actor: DemoUser) {
  const t = db.users.find((x) => x.id === id)
  if (!t) throw new ApiError('المستخدم غير موجود')
  if (isSuper(t)) throw new ApiError('لا يمكن تعديل حساب مدير النظام الرئيسي')
  if (t.id === actor.id) throw new ApiError('لا يمكنك تعديل صلاحيات حسابك')
  return t
}
const publicUser = ({ password: _p, ...u }: DemoUser): User => u

// ───────────────────────── API ─────────────────────────
export const demoApi: SammhaApi = {
  currentUser: () => tx((db) => {
    const u = db.users.find((x) => x.id === getSession())
    return u ? publicUser(u) : null
  }),

  signUp: (input: SignUpInput) => tx((db) => {
    const phone = input.phone.replace(/\s/g, '')
    if (!/^05\d{8}$/.test(phone)) throw new ApiError('رقم الجوال يبدأ بـ 05 ويتكون من 10 أرقام')
    if (db.users.some((u) => u.phone === phone)) throw new ApiError('رقم الجوال مسجل مسبقًا، سجّل الدخول')
    if (db.users.some((u) => u.email.toLowerCase() === input.email.toLowerCase())) throw new ApiError('البريد الإلكتروني مسجل مسبقًا')
    if (input.password.length < 6) throw new ApiError('كلمة المرور 6 أحرف على الأقل')
    const u: DemoUser = { id: uid(db, 'u'), fullName: input.fullName.trim(), phone, email: input.email.trim(), nationalId: input.nationalId, role: 'owner', password: input.password, createdAt: iso(now()) }
    db.users.push(u)
    setSession(u.id)
    return publicUser(u)
  }),

  signIn: (login, password, portal) => tx((db) => {
    const l = login.trim().toLowerCase()
    const u = db.users.find((x) => x.phone === l || x.email.toLowerCase() === l)
    const wrong = new ApiError(portal === 'staff' ? 'البيانات غير صحيحة' : 'رقم الجوال أو كلمة المرور غير صحيحة')
    if (!u) throw wrong
    // the same generic error whichever portal is wrong, so the staff portal is not revealed
    if ((portal === 'staff') !== (u.role !== 'owner')) throw wrong
    if (portal === 'staff' && isSuper(u) && !u.password) {
      if (password.length < 8) throw new ApiError('أول دخول لحساب مدير النظام: اختر كلمة مرور من 8 أحرف على الأقل')
      u.password = password
    }
    if (u.password !== password) throw wrong
    if (u.active === false) throw new ApiError('هذا الحساب موقوف، تواصل مع مدير النظام')
    setSession(u.id)
    return publicUser(u)
  }),

  changePassword: (current, next) => tx((db) => {
    const u = me(db)
    if (u.password !== current) throw new ApiError('كلمة المرور الحالية غير صحيحة')
    if (next.length < 8) throw new ApiError('كلمة المرور الجديدة 8 أحرف على الأقل')
    u.password = next
  }),

  signOut: async () => { setSession(null) },

  stats: () => tx((db) => ({
    live: db.auctions.filter((a) => phaseOf(a) === 'live').length,
    upcoming: db.auctions.filter((a) => phaseOf(a) === 'scheduled').length,
    reserved: db.reserved.length,
    owners: new Set(db.reserved.map((r) => r.ownerName)).size,
  })),

  listAuctions: (f = {}) => tx((db) => {
    const q = f.q ? normalizeName(f.q) : ''
    return db.auctions
      .filter((a) => (f.phase && f.phase !== 'all' ? phaseOf(a) === f.phase : true))
      .filter((a) => (f.type && f.type !== 'all' ? a.type === f.type : true))
      .filter((a) => (q ? normalizeName(a.name).includes(q) : true))
      .sort((x, y) => {
        const px = phaseOf(x), py = phaseOf(y)
        const order = { live: 0, scheduled: 1, ended: 2 }
        if (px !== py) return order[px] - order[py]
        if (px === 'ended') return Date.parse(y.endsAt) - Date.parse(x.endsAt)
        if (px === 'scheduled') return Date.parse(x.startsAt) - Date.parse(y.startsAt)
        return Date.parse(x.endsAt) - Date.parse(y.endsAt)
      })
  }),

  getAuction: (id) => tx((db) => {
    const auction = db.auctions.find((a) => a.id === id)
    if (!auction) throw new ApiError('المزاد غير موجود')
    const bids = db.bids.filter((b) => b.auctionId === id).sort((a, b) => b.amount - a.amount)
    return { auction, bids }
  }),

  listReservedNames: (q, type) => tx((db) => {
    const n = q ? normalizeName(q) : ''
    const avatar = (r: ReservedName) => {
      const u = db.users.find((x) => (r.ownerId ? x.id === r.ownerId : x.fullName === r.ownerName))
      return u?.showAvatar && u.avatarUrl ? u.avatarUrl : undefined
    }
    return db.reserved.map((r) => ({ ...r, ownerAvatar: avatar(r) }))
      .filter((r) => (type && type !== 'all' ? r.type === type : true))
      .filter((r) => (n ? r.normalized.includes(n) || r.ownerName.includes(q!) : true))
      .sort((a, b) => Date.parse(b.acquiredAt) - Date.parse(a.acquiredAt))
  }),

  checkNames: (names, _type) => tx((db) => checkNamesIn(db, names)),

  listEvents: () => tx((db) => [...db.events].sort((a, b) => a.startsOn.localeCompare(b.startsOn))),

  verifyCertificate: (code) => tx((db) => {
    const c = code.trim().toUpperCase()
    return db.reserved.find((r) => certNo(r) === c) ?? null
  }),

  submitTicket: (input) => tx((db) => {
    const clean = validateTicket(input)
    const id = getSession()
    const u = db.users.find((x) => x.id === id)
    const year = new Date().getFullYear() % 100
    const seq = db.tickets.filter((k) => k.number.startsWith(`BL-${year}`)).length + 1
    const k: Ticket = {
      ...clean, id: uid(db, 'tk'), number: `BL-${year}${String(seq).padStart(4, '0')}`, userId: u?.id,
      status: 'new', priority: clean.kind === 'report' ? 'urgent' : 'normal', messages: [], createdAt: iso(now()), updatedAt: iso(now()),
    }
    db.tickets.push(k)
    emailTicketEvent('created', k)
    return publicTicket(k)
  }),

  trackTicket: (number, phone) => tx((db) => {
    const k = db.tickets.find((x) => x.number === number.trim().toUpperCase() && x.phone === normalizePhone(phone))
    return k ? publicTicket(k) : null
  }),

  followUpTicket: (number, phone, body) => tx((db) => {
    const k = db.tickets.find((x) => x.number === number.trim().toUpperCase() && x.phone === normalizePhone(phone))
    if (!k) throw new ApiError('لم نجد طلبًا بهذا الرقم والجوال')
    if (k.status === 'closed') throw new ApiError('هذا الطلب مغلق، افتح طلبًا جديدًا')
    const text = body.trim().slice(0, 3000)
    if (text.length < 2) throw new ApiError('اكتب ردك')
    k.messages.push({ id: uid(db, 'tm'), by: 'customer', author: k.name, body: text, createdAt: iso(now()) })
    if (k.status === 'answered') k.status = 'in_progress'
    k.updatedAt = iso(now())
    return publicTicket(k)
  }),

  myTickets: () => tx((db) => {
    const u = me(db)
    return db.tickets.filter((k) => k.userId === u.id || k.phone === normalizePhone(u.phone)).map(publicTicket)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  }),

  listTickets: () => tx((db) => {
    staff(db)
    return [...db.tickets].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  }),

  getTicket: (id) => tx((db) => {
    staff(db)
    const k = db.tickets.find((x) => x.id === id)
    if (!k) throw new ApiError('الطلب غير موجود')
    return k
  }),

  updateTicket: (id, patch) => tx((db) => {
    staff(db)
    const k = db.tickets.find((x) => x.id === id)
    if (!k) throw new ApiError('الطلب غير موجود')
    const statusChanged = patch.status && patch.status !== k.status
    Object.assign(k, Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)), { updatedAt: iso(now()) })
    if (statusChanged && (k.status === 'closed' || k.status === 'in_progress')) emailTicketEvent('status', k)
    return k
  }),

  replyTicket: (id, body, internal) => tx((db) => {
    const u = staff(db)
    const k = db.tickets.find((x) => x.id === id)
    if (!k) throw new ApiError('الطلب غير موجود')
    const text = body.trim().slice(0, 3000)
    if (text.length < 2) throw new ApiError('اكتب الرد')
    k.messages.push({ id: uid(db, 'tm'), by: 'staff', author: u.fullName, body: text, internal: internal || undefined, createdAt: iso(now()) })
    if (!internal) {
      k.status = 'answered'
      if (k.userId) notify(db, k.userId, 'ticket', `رد فريق سمّها على طلبك ${k.number}`, text.slice(0, 120), `/dashboard/tickets`)
      emailTicketEvent('reply', k, text)
    } else if (k.status === 'new') k.status = 'in_progress'
    if (!k.assignee) k.assignee = u.fullName
    k.updatedAt = iso(now())
    return k
  }),

  updateMyProfile: ({ avatarUrl, showAvatar }) => tx((db) => {
    const u = me(db)
    if (avatarUrl !== undefined) u.avatarUrl = avatarUrl ?? undefined
    u.showAvatar = showAvatar && !!u.avatarUrl
    return publicUser(u)
  }),

  myNotifications: () => tx((db) => {
    const u = me(db)
    return db.notes.filter((n) => n.userId === u.id).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 30)
  }),

  markNotificationsRead: () => tx((db) => {
    const u = me(db)
    db.notes.forEach((n) => { if (n.userId === u.id) n.read = true })
  }),

  myRequests: () => tx((db) => {
    const u = me(db)
    return db.requests.filter((r) => r.userId === u.id).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).map((r) => withCancel(db, r))
  }),

  createRequest: (type, names) => tx((db) => {
    const u = me(db)
    if (names.length !== RULES.namesPerRequest) throw new ApiError(`أدخل ${RULES.namesPerRequest} أسماء`)
    const checks = checkNamesIn(db, names)
    const blocked = checks.filter((c) => c.verdict === 'exact' || c.verdict === 'invalid' || c.verdict === 'duplicate')
    if (blocked.length) throw new ApiError(`غيّر الأسماء المرفوضة: ${blocked.map((b) => b.name || '—').join('، ')}`)
    const r: LogoRequest = {
      id: uid(db, 'q'), number: `SM-${1000 + db.requests.length + 1}`, userId: u.id, ownerName: u.fullName, type,
      candidates: checks.map((c) => ({ id: uid(db, 'c'), name: c.name.trim(), normalized: c.normalized, status: 'pending', similar: c.hits })),
      status: 'pending_payment', depositAmount: RULES.depositAmount, depositPaid: false, depositState: 'none', createdAt: iso(now()),
    }
    db.requests.push(r)
    return r
  }),

  payDeposit: (requestId, method: PayMethod) => tx((db) => {
    const u = me(db)
    const r = db.requests.find((x) => x.id === requestId && x.userId === u.id)
    if (!r) throw new ApiError('الطلب غير موجود')
    if (r.status !== 'pending_payment') throw new ApiError('تم سداد ضمان هذا الطلب')
    // re-check: a name may have been taken since the request was drafted
    const checks = checkNamesIn(db, r.candidates.map((c) => c.name), r.id)
    const taken = checks.filter((c) => c.verdict === 'exact')
    if (taken.length) throw new ApiError(`أصبح الاسم «${taken[0].name}» محجوزًا، ألغِ الطلب وأنشئ طلبًا جديدًا`)
    if (method === 'wallet') {
      if (balanceOf(db, u.id) < r.depositAmount) throw new ApiError('رصيد المحفظة لا يكفي، اشحن المحفظة أو ادفع بالبطاقة')
    } else {
      // card: demo simulates a successful Moyasar payment that tops up then debits
      db.txs.push({ id: uid(db, 't'), userId: u.id, amount: r.depositAmount, kind: 'topup', note: `دفع بالبطاقة للطلب ${r.number}`, createdAt: iso(now()) })
    }
    db.txs.push({ id: uid(db, 't'), userId: u.id, amount: -r.depositAmount, kind: 'deposit', note: `ضمان مزاد الطلب ${r.number}`, createdAt: iso(now()) })
    r.candidates.forEach((c, i) => { c.similar = checks[i].hits })
    Object.assign(r, { status: 'under_review', depositPaid: true, depositState: 'held', submittedAt: iso(now()) })
    return r
  }),

  cancelMyRequest: (requestId, reason) => tx((db) => {
    const u = me(db)
    const r = db.requests.find((x) => x.id === requestId && x.userId === u.id)
    if (!r) throw new ApiError('الطلب غير موجود')
    if (r.status === 'cancelled') throw new ApiError('الطلب ملغى مسبقًا')
    if (!cancellable(db, r)) throw new ApiError(r.status === 'accepted' ? 'بدأ مزاد أحد أسماء هذا الطلب، فلا يمكن إلغاؤه الآن' : 'لا يمكن إلغاء هذا الطلب')
    // remove auctions that were scheduled but have not started
    const ids = new Set(r.candidates.map((c) => c.auctionId).filter(Boolean))
    db.auctions = db.auctions.filter((a) => !ids.has(a.id))
    r.candidates.forEach((c) => { c.auctionId = undefined })
    const held = r.depositState === 'held' ? r.depositAmount : 0
    Object.assign(r, { status: 'cancelled', cancelledAt: iso(now()), cancelledBy: 'owner', cancelReason: reason?.trim().slice(0, 300) || undefined })
    refundDeposit(db, r, 'ألغاه المالك')
    return { refunded: held }
  }),

  myWallet: () => tx((db) => {
    const u = me(db)
    return { balance: balanceOf(db, u.id), txs: db.txs.filter((t) => t.userId === u.id).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)) }
  }),

  topUp: (amount) => tx((db) => {
    const u = me(db)
    if (!(amount >= 10)) throw new ApiError('أقل مبلغ للشحن 10 ريال')
    db.txs.push({ id: uid(db, 't'), userId: u.id, amount, kind: 'topup', note: 'شحن المحفظة بالبطاقة', createdAt: iso(now()) })
    return { balance: balanceOf(db, u.id), txs: db.txs.filter((t) => t.userId === u.id).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)) }
  }),

  myInvoices: () => tx((db) => {
    const u = me(db)
    return db.invoices.filter((i) => i.userId === u.id).sort((a, b) => Date.parse(b.issuedAt) - Date.parse(a.issuedAt))
  }),

  payInvoice: (id, method) => tx((db) => {
    const u = me(db)
    const inv = db.invoices.find((i) => i.id === id && (i.userId === u.id || u.role !== 'owner'))
    if (!inv) throw new ApiError('الفاتورة غير موجودة')
    if (inv.status === 'paid') return inv
    if (method === 'wallet' && balanceOf(db, inv.userId) < inv.amountDue) throw new ApiError('رصيد المحفظة لا يكفي')
    if (method === 'card') db.txs.push({ id: uid(db, 't'), userId: inv.userId, amount: inv.amountDue, kind: 'topup', note: `دفع بالبطاقة للفاتورة ${inv.number}`, createdAt: iso(now()) })
    db.txs.push({ id: uid(db, 't'), userId: inv.userId, amount: -inv.amountDue, kind: 'invoice_payment', note: `سداد الفاتورة ${inv.number} — ${inv.name}`, createdAt: iso(now()) })
    inv.status = 'paid'
    inv.paidAt = iso(now())
    return inv
  }),

  myBids: () => tx((db) => {
    const u = me(db)
    const latest = new Map<string, Bid>()
    for (const b of db.bids.filter((x) => x.userId === u.id)) {
      const cur = latest.get(b.auctionId)
      if (!cur || b.amount > cur.amount) latest.set(b.auctionId, b)
    }
    return [...latest.values()].map((b) => ({ ...b, auction: db.auctions.find((a) => a.id === b.auctionId)! }))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  }),

  myNames: () => tx((db) => {
    const u = me(db)
    return db.reserved.filter((r) => r.ownerId === u.id).sort((a, b) => Date.parse(b.acquiredAt) - Date.parse(a.acquiredAt))
  }),

  placeBid: (auctionId, amount) => tx((db) => {
    const u = me(db)
    const a = db.auctions.find((x) => x.id === auctionId)
    if (!a) throw new ApiError('المزاد غير موجود')
    const phase = phaseOf(a)
    if (phase === 'scheduled') throw new ApiError('المزاد لم يبدأ بعد')
    if (phase === 'ended') throw new ApiError('انتهى المزاد')
    const min = a.currentPrice + a.minIncrement
    if (!Number.isFinite(amount) || amount < min) throw new ApiError(`أقل مزايدة ${min} ريال`)
    if (a.leaderId === u.id) throw new ApiError('أنت صاحب أعلى مزايدة حاليًا')
    if (a.leaderId) notify(db, a.leaderId, 'outbid', `تجاوز مزايد آخر مزايدتك على «${a.name}»`, `أعلى مزايدة الآن ${amount} ريال. زايد قبل انتهاء الوقت.`, `/auctions/${a.id}`)
    const t = now()
    db.bids.push({ id: uid(db, 'b'), auctionId, userId: u.id, bidderLabel: maskName(u.fullName), amount, createdAt: iso(t) })
    a.currentPrice = amount
    a.bidCount += 1
    a.leaderId = u.id
    a.leaderLabel = maskName(u.fullName)
    const win = RULES.extendMinutes * 60_000
    if (Date.parse(a.endsAt) - t < win) a.endsAt = iso(t + win)
    return { auction: a, bids: db.bids.filter((b) => b.auctionId === auctionId).sort((x, y) => y.amount - x.amount) }
  }),

  overview: () => tx((db) => {
    staff(db)
    return {
      underReview: db.requests.filter((r) => r.status === 'under_review').length,
      awaitingSchedule: db.requests.flatMap((r) => r.candidates).filter((c) => c.status === 'accepted' && !c.auctionId).length,
      live: db.auctions.filter((a) => phaseOf(a) === 'live').length,
      scheduled: db.auctions.filter((a) => phaseOf(a) === 'scheduled').length,
      unpaidInvoices: db.invoices.filter((i) => i.status === 'unpaid').length,
      revenue: round2(db.invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.total, 0)),
      openTickets: db.tickets.filter((k) => k.status === 'new' || k.status === 'in_progress').length,
    }
  }),

  listRequests: (status = 'all') => tx((db) => {
    staff(db)
    return db.requests.filter((r) => (status === 'all' ? r.status !== 'pending_payment' : r.status === status))
      .sort((a, b) => Date.parse(b.submittedAt || b.createdAt) - Date.parse(a.submittedAt || a.createdAt))
  }),

  getRequest: (id) => tx((db) => {
    const u = me(db)
    const r = db.requests.find((x) => x.id === id)
    if (!r || (u.role === 'owner' && r.userId !== u.id)) throw new ApiError('الطلب غير موجود')
    if (u.role !== 'owner' && r.status === 'under_review') r.candidates.forEach((c) => { c.similar = similarFor(db, c.normalized, r.id) })
    return withCancel(db, r)
  }),

  reviewRequest: (id, decisions, note) => tx((db) => {
    const u = staff(db)
    const r = db.requests.find((x) => x.id === id)
    if (!r) throw new ApiError('الطلب غير موجود')
    if (r.status !== 'under_review') throw new ApiError('تمت مراجعة هذا الطلب')
    for (const d of decisions) {
      const c = r.candidates.find((x) => x.id === d.candidateId)
      if (!c) continue
      if (d.status === 'accepted') {
        const exact = similarFor(db, c.normalized, r.id).find((h) => h.score === 1)
        if (exact) throw new ApiError(`لا يمكن قبول «${c.name}»: مطابق لـ«${exact.name}»`)
      }
      c.status = d.status
      c.rejectReason = d.status === 'rejected' ? d.reason || 'مشابه لاسم مسجل' : undefined
    }
    if (r.candidates.some((c) => c.status === 'pending')) throw new ApiError('حدد قرارًا لكل اسم')
    const anyAccepted = r.candidates.some((c) => c.status === 'accepted')
    Object.assign(r, { status: anyAccepted ? 'accepted' : 'rejected', reviewedAt: iso(now()), reviewerName: u.fullName, reviewNote: note })
    const acc = r.candidates.filter((c) => c.status === 'accepted').map((c) => c.name)
    notify(db, r.userId, 'reviewed', anyAccepted ? `قُبل طلبك ${r.number}` : `لم يُقبل طلبك ${r.number}`,
      anyAccepted ? `الأسماء المقبولة: ${acc.join('، ')}. سيُحدَّد موعد المزاد قريبًا.` : 'أُعيد ضمان المزاد إلى محفظتك.', `/dashboard/requests/${r.id}`)
    if (!anyAccepted) refundDeposit(db, r, 'مرفوض')
    return r
  }),

  rejectRequest: (id, reason) => tx((db) => {
    const u = staff(db)
    const r = db.requests.find((x) => x.id === id)
    if (!r || r.status !== 'under_review') throw new ApiError('لا يمكن رفض هذا الطلب')
    r.candidates.forEach((c) => { c.status = 'rejected'; c.rejectReason = reason })
    Object.assign(r, { status: 'rejected', reviewedAt: iso(now()), reviewerName: u.fullName, reviewNote: reason })
    notify(db, r.userId, 'reviewed', `لم يُقبل طلبك ${r.number}`, reason, `/dashboard/requests/${r.id}`)
    refundDeposit(db, r, 'مرفوض')
    return r
  }),

  cancelRequest: (id, reason) => tx((db) => {
    const u = staff(db)
    const r = db.requests.find((x) => x.id === id)
    if (!r || !['under_review', 'accepted'].includes(r.status)) throw new ApiError('لا يمكن إلغاء هذا الطلب')
    if (r.candidates.some((c) => c.auctionId)) throw new ApiError('لا يمكن إلغاء طلب فُتح له مزاد')
    Object.assign(r, { status: 'cancelled', reviewedAt: iso(now()), reviewerName: u.fullName, reviewNote: reason })
    refundDeposit(db, r, 'ألغته اللجنة')
    return r
  }),

  awaitingSchedule: () => tx((db) => {
    staff(db)
    return db.requests.filter((r) => r.status === 'accepted')
      .flatMap((r) => r.candidates.filter((c) => c.status === 'accepted' && !c.auctionId).map((c) => ({ ...c, request: r })))
  }),

  scheduleAuctions: (candidateIds, startsAt, endsAt) => tx((db) => {
    staff(db)
    const s = Date.parse(startsAt), e = Date.parse(endsAt)
    if (!s || !e) throw new ApiError('حدد موعد البداية والنهاية')
    if (e <= s) throw new ApiError('موعد النهاية يجب أن يكون بعد البداية')
    if (e <= now()) throw new ApiError('موعد النهاية في الماضي')
    if (!candidateIds.length) throw new ApiError('اختر اسمًا واحدًا على الأقل')
    const out: Auction[] = []
    for (const cid of candidateIds) {
      const r = db.requests.find((x) => x.candidates.some((c) => c.id === cid))
      const c = r?.candidates.find((x) => x.id === cid)
      if (!r || !c || c.status !== 'accepted' || c.auctionId) continue
      const a: Auction = {
        id: uid(db, 'a'), requestId: r.id, candidateId: c.id, name: c.name, type: r.type, requesterId: r.userId,
        openingPrice: RULES.openingPrice, minIncrement: RULES.minIncrement, startsAt: iso(s), endsAt: iso(e),
        currentPrice: RULES.openingPrice, bidCount: 0, settled: false,
      }
      c.auctionId = a.id
      db.auctions.push(a)
      out.push(a)
      notify(db, r.userId, 'auction_opened', `حُدّد موعد مزاد «${c.name}»`, `يبدأ ${new Date(s).toLocaleString('ar-SA-u-nu-latn-ca-gregory', { timeZone: RULES.timeZone, dateStyle: 'medium', timeStyle: 'short' })}.`, `/auctions/${a.id}`)
    }
    return out
  }),

  allInvoices: () => tx((db) => {
    staff(db)
    return [...db.invoices].sort((a, b) => Date.parse(b.issuedAt) - Date.parse(a.issuedAt))
  }),

  markInvoicePaid: (id) => tx((db) => {
    staff(db)
    const inv = db.invoices.find((i) => i.id === id)
    if (!inv || inv.status === 'paid') throw new ApiError('الفاتورة غير موجودة أو مدفوعة')
    inv.status = 'paid'
    inv.paidAt = iso(now())
    return inv
  }),

  listUsers: () => tx((db) => {
    staff(db)
    return [...db.users].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).map(publicUser)
  }),

  createStaff: (input) => tx((db) => {
    superOnly(db)
    const phone = input.phone.replace(/\s/g, '')
    const email = input.email.trim()
    if (input.fullName.trim().length < 3) throw new ApiError('اكتب اسم الموظف')
    if (!/^05\d{8}$/.test(phone)) throw new ApiError('رقم الجوال يبدأ بـ 05 ويتكون من 10 أرقام')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError('البريد الإلكتروني غير صحيح')
    if (db.users.some((u) => u.phone === phone)) throw new ApiError('رقم الجوال مسجل لحساب آخر')
    if (db.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) throw new ApiError('البريد الإلكتروني مسجل لحساب آخر')
    if (input.password.length < 8) throw new ApiError('كلمة المرور المؤقتة 8 أحرف على الأقل')
    if (input.role !== 'committee' && input.role !== 'admin') throw new ApiError('اختر الصلاحية')
    const u: DemoUser = { id: uid(db, 'u'), fullName: input.fullName.trim(), phone, email, role: input.role, password: input.password, active: true, createdAt: iso(now()) }
    db.users.push(u)
    return publicUser(u)
  }),

  setUserRole: (id, role) => tx((db) => {
    const t = targetUser(db, id, superOnly(db))
    if (!['owner', 'committee', 'admin'].includes(role)) throw new ApiError('صلاحية غير معروفة')
    t.role = role
    return publicUser(t)
  }),

  setUserActive: (id, active) => tx((db) => {
    const t = targetUser(db, id, superOnly(db))
    t.active = active
    if (!active && getSession() === t.id) setSession(null)
    return publicUser(t)
  }),

  saveEvent: (e) => tx((db) => {
    staff(db)
    if (!e.title.trim() || !e.startsOn || !e.endsOn) throw new ApiError('أكمل اسم الفعالية والتواريخ')
    if (e.endsOn < e.startsOn) throw new ApiError('تاريخ النهاية قبل البداية')
    const ev = { ...e, id: e.id || uid(db, 'ev') }
    const i = db.events.findIndex((x) => x.id === ev.id)
    if (i >= 0) db.events[i] = ev; else db.events.push(ev)
    return ev
  }),

  deleteEvent: (id) => tx((db) => {
    staff(db)
    db.events = db.events.filter((e) => e.id !== id)
  }),
}
